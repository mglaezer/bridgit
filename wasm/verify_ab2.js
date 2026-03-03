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
  var idx = computerMove(boardPtr, blueLPtr, blueRPtr);
  if (idx < 0) return null;
  var key = CROSSING_KEYS[idx];
  game.board.set(key, 'blue');
  game.turn = 'red';
  game.moveCount++;
  var blueClaimed = [];
  game.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.push(kk); });
  var rc = g.checkWin(blueClaimed, 'blue', game.n);
  if (rc.won) { game.gameOver = true; game.winner = 'blue'; }
  return key;
}

function makeRedMover(mod, boardPtr, redLPtr, redRPtr, redMoveFn) {
  return function(game) {
    var part = g.recomputeRedPartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), boardPtr);
    mod.HEAPU8.set(partitionToArray(part.L), redLPtr);
    mod.HEAPU8.set(partitionToArray(part.R), redRPtr);
    var idx = redMoveFn(boardPtr, redLPtr, redRPtr);
    if (idx < 0) return null;
    var key = CROSSING_KEYS[idx];
    var parts = key.split(',');
    g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
    return key;
  };
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

  var redBoardPtr = oldMod._malloc(61);
  var redLPtr = oldMod._malloc(61);
  var redRPtr = oldMod._malloc(61);
  var redMoveFn = oldMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']);
  oldMod.cwrap('wasm_set_red_variant', null, ['number'])(0);
  var redMove = makeRedMover(oldMod, redBoardPtr, redLPtr, redRPtr, redMoveFn);

  var opening = 0;
  var openingKey = CROSSING_KEYS[opening];
  var openParts = openingKey.split(',');

  var gameOld = g.createGame(6);
  g.humanMove(gameOld, parseInt(openParts[0]), parseInt(openParts[1]));
  var gameNew = g.createGame(6);
  g.humanMove(gameNew, parseInt(openParts[0]), parseInt(openParts[1]));

  console.log('Playing opening ' + opening + ' (' + openingKey + ')');

  for (var turn = 0; turn < 60; turn++) {
    if (gameOld.gameOver && gameNew.gameOver) break;

    if (gameOld.turn === 'red') {
      var oldRedKey = redMove(gameOld);
      // Apply same Red move to new game
      var rparts = oldRedKey.split(',');
      g.humanMove(gameNew, parseInt(rparts[0]), parseInt(rparts[1]));
      console.log('Turn ' + turn + ' Red: ' + oldRedKey);
    } else {
      var oldKey = getBlueMove(oldMod, oldBoardPtr, oldBlueLPtr, oldBlueRPtr, oldComputerMove, gameOld);
      var newKey = getBlueMove(newMod, newBoardPtr, newBlueLPtr, newBlueRPtr, newComputerMove, gameNew);
      var match = oldKey === newKey ? '' : ' *** MISMATCH ***';
      console.log('Turn ' + turn + ' Blue: old=' + oldKey + ' new=' + newKey + match);
      if (oldKey !== newKey) {
        console.log('FIRST MISMATCH at turn ' + turn);
        break;
      }
    }
  }

  console.log('Old winner: ' + (gameOld.winner || 'none'));
  console.log('New winner: ' + (gameNew.winner || 'none'));
}

main().catch(function(e) { console.error(e); process.exit(1); });
