var g = require('../game.js');

var CROSSINGS = g.allPlayableCrossings(g.N);
var CROSSING_KEYS = [];
for (var i = 0; i < CROSSINGS.length; i++)
  CROSSING_KEYS.push(g.k(CROSSINGS[i][0], CROSSINGS[i][1]));

function boardToArray(board) {
  var arr = new Uint8Array(61);
  for (var i = 0; i < 61; i++) {
    var owner = board.get(CROSSING_KEYS[i]);
    if (owner === 'red') arr[i] = 1;
    else if (owner === 'blue') arr[i] = 2;
  }
  return arr;
}

function partitionToArray(partSet) {
  var arr = new Uint8Array(61);
  for (var i = 0; i < 61; i++)
    if (partSet.has(CROSSING_KEYS[i])) arr[i] = 1;
  return arr;
}

function getBlueMove(mod, boardPtr, blueLPtr, blueRPtr, computerMove, game) {
  var part = g.recomputeBluePartition(6, game.board);
  mod.HEAPU8.set(boardToArray(game.board), boardPtr);
  mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
  mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);
  return computerMove(boardPtr, blueLPtr, blueRPtr);
}

async function main() {
  var NewBot = require('./bridgit_bot_beam.js');
  var newMod = await NewBot();
  var newBoardPtr = newMod._malloc(61);
  var newBlueLPtr = newMod._malloc(61);
  var newBlueRPtr = newMod._malloc(61);
  var newComputerMove = newMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  newMod.cwrap('wasm_set_depth', null, ['number'])(8);
  newMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 8, 10, 8);
  newMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);

  var OldBot = require('./baseline_beam.js');
  var oldMod = await OldBot();
  var oldBoardPtr = oldMod._malloc(61);
  var oldBlueLPtr = oldMod._malloc(61);
  var oldBlueRPtr = oldMod._malloc(61);
  var oldComputerMove = oldMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  oldMod.cwrap('wasm_set_depth', null, ['number'])(8);
  oldMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 8, 10, 8);
  oldMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);

  var mismatches = 0;
  for (var opening = 0; opening < 10; opening++) {
    var openingKey = CROSSING_KEYS[opening];
    var openParts = openingKey.split(',');

    var game1 = g.createGame(6);
    g.humanMove(game1, parseInt(openParts[0]), parseInt(openParts[1]));
    var game2 = g.createGame(6);
    g.humanMove(game2, parseInt(openParts[0]), parseInt(openParts[1]));

    var oldIdx = getBlueMove(oldMod, oldBoardPtr, oldBlueLPtr, oldBlueRPtr, oldComputerMove, game1);
    var newIdx = getBlueMove(newMod, newBoardPtr, newBlueLPtr, newBlueRPtr, newComputerMove, game2);

    var match = oldIdx === newIdx ? 'MATCH' : 'MISMATCH';
    if (oldIdx !== newIdx) mismatches++;
    console.log('Opening ' + opening + ' (' + openingKey + '): old=' + oldIdx + ' (' + CROSSING_KEYS[oldIdx] + ') new=' + newIdx + ' (' + CROSSING_KEYS[newIdx] + ') ' + match);
  }
  console.log('\nMismatches: ' + mismatches + '/10');
}

main().catch(function(e) { console.error(e); process.exit(1); });
