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

async function main() {
  var Bot = require('./bridgit_bot_beam.js');
  var mod = await Bot();
  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);
  var computerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  mod.cwrap('wasm_set_depth', null, ['number'])(8);
  mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 8, 10, 8);
  mod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);

  var redBoardPtr = mod._malloc(61);
  var redLPtr = mod._malloc(61);
  var redRPtr = mod._malloc(61);
  var redMoveFn = mod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']);
  mod.cwrap('wasm_set_red_variant', null, ['number'])(0);

  var game = g.createGame(6);
  var openingKey = CROSSING_KEYS[0];
  var openParts = openingKey.split(',');
  g.humanMove(game, parseInt(openParts[0]), parseInt(openParts[1]));

  var totalBlueTime = 0;
  var blueMoves = 0;

  for (var turn = 0; turn < 60; turn++) {
    if (game.gameOver) break;

    if (game.turn === 'red') {
      var part = g.recomputeRedPartition(6, game.board);
      mod.HEAPU8.set(boardToArray(game.board), redBoardPtr);
      mod.HEAPU8.set(partitionToArray(part.L), redLPtr);
      mod.HEAPU8.set(partitionToArray(part.R), redRPtr);
      var idx = redMoveFn(redBoardPtr, redLPtr, redRPtr);
      var key = CROSSING_KEYS[idx];
      var parts = key.split(',');
      g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
    } else {
      var part = g.recomputeBluePartition(6, game.board);
      mod.HEAPU8.set(boardToArray(game.board), boardPtr);
      mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
      mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);
      var t0 = Date.now();
      var idx = computerMove(boardPtr, blueLPtr, blueRPtr);
      var dt = Date.now() - t0;
      totalBlueTime += dt;
      blueMoves++;
      var key = CROSSING_KEYS[idx];
      game.board.set(key, 'blue');
      game.turn = 'red';
      game.moveCount++;
      var blueClaimed = [];
      game.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.push(kk); });
      var rc = g.checkWin(blueClaimed, 'blue', game.n);
      if (rc.won) { game.gameOver = true; game.winner = 'blue'; }
      console.log('Blue move ' + blueMoves + ': ' + key + ' (' + dt + 'ms)');
    }
  }

  console.log('\nWinner: ' + (game.winner || 'none'));
  console.log('Total Blue time: ' + totalBlueTime + 'ms');
  console.log('Avg per move: ' + (totalBlueTime / blueMoves).toFixed(0) + 'ms');
  console.log('Blue moves: ' + blueMoves);
}

main().catch(function(e) { console.error(e); process.exit(1); });
