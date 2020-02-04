/**
* # Logic code for Meritocracy Game
* Copyright(c) 2017 Stefano Balietti
* MIT Licensed
*
* http://www.nodegame.org
* ---
*/

var path = require('path');
var fs   = require('fs-extra');

var ngc = require('nodegame-client');
var GameStage = ngc.GameStage;
var J = ngc.JSUS;


module.exports = function(treatmentName, settings, stager, setup, gameRoom) {

    var channel = gameRoom.channel;
    var node = gameRoom.node;

    var treatments;


    // Require treatments file.
    treatments = channel.require(__dirname + '/includes/treatments.js', {
        node: node,
        settings: settings
    }, true);

    var groupSize = gameRoom.game.waitroom.GROUP_SIZE;

    stager.setDefaultProperty('minPlayers', [ groupSize ]);

    // Event handler registered in the init function are always valid.
    stager.setOnInit(function() {
        console.log('********************** meritocracy ' + gameRoom.name);

        // Keep tracks of results sent to players in case of disconnections.
        node.game.savedResults = {};
        node.game.incomes = {};

        // Add session name to data in DB.
        node.game.memory.on('insert', function(o) {
            o.session = node.nodename;
        });
    });

    // Extends Stages and Steps where needed.

    stager.extendStep('effort', {
        init: function() {
            var efforts = [];
            node.game.efforts = efforts;
        },
        cb: function() {
            node.on.data('done', function(msg) {
                node.game.efforts.push({
                    id: msg.from,
                    effort: msg.data.effort
                });
                //debugger
            });
        }
    });

    //THIS IS BID IN MERIT-BASED TREATMENT (Treatment 1)
    stager.extendStep('bid', {
        cb: function() {
            // Sort them
            var sorted = node.game.efforts.sort(function(a, b) {
                return b.effort - a.effort;
            });
            // to get from game.settings

            var m = node.game.settings.N_HIGH;
            var H = node.game.settings.HIGH;
            var L = node.game.settings.LOW;

            var Income = [];
            var PId = "";
            for (var i = 0; i < groupSize; i++) {
                if (i<m) {
                    Income.push(H);
                }
                else {
                    Income.push(L);
                }
                var income = Income[i];
                node.say('income', sorted[i].id, income);
                PId = sorted[i].id;
                this.incomes[PId] = income;
            }
        }
    });

    stager.extendStep('results', {
        init: function() {
            this.savedResults = {};
        },
        cb: function() {
            // Computes the values for all players and all groups,
            // sends them to the clients, and save results into database.
            treatments[treatmentName].sendResults();
        }
    });

    stager.extendStep('end', {
        cb: function() {

            console.log('FINAL PAYOFF PER PLAYER');
            console.log('***********************');

            gameRoom.computeBonus({
                say: true,   // default false
                dump: true,  // default false
                print: true  // default false

            });

            // Dump all memory.
            node.game.memory.save('memory_all.json');
        }
    });

};
