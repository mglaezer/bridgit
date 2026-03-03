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

async function main() {
  var Bot = require('./bridgit_bot_beam.js');
  var mod = await Bot();
  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);

  var setResistance = mod.cwrap('wasm_set_resistance', null, ['number']);
  var setDepth = mod.cwrap('wasm_set_depth', null, ['number']);
  var setBaseWidths = mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number']);
  var setWidths = mod.cwrap('wasm_set_widths', null, ['number', 'number']);
  var computerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var getLastScore = mod.cwrap('wasm_get_last_score', 'number', []);

  function partitionToArray(partSet) {
    var arr = new Uint8Array(61);
    for (var i = 0; i < 61; i++)
      if (partSet.has(CROSSING_KEYS[i])) arr[i] = 1;
    return arr;
  }

  // Test 1: Empty board move with resistance at depth 4
  setResistance(1);
  setDepth(4);
  setBaseWidths(61, 20, 10, 8);
  setWidths(8, 6);

  var game = g.createGame(6);
  // Make first move (Red always goes first)
  g.humanMove(game, 1, 1);

  var part = g.recomputeBluePartition(6, game.board);
  mod.HEAPU8.set(boardToArray(game.board), boardPtr);
  mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
  mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);

  var t0 = Date.now();
  var idx = computerMove(boardPtr, blueLPtr, blueRPtr);
  var dt = Date.now() - t0;
  var score = getLastScore();
  console.log('Resistance depth-4 move: crossing ' + idx + ' (' + CROSSING_KEYS[idx] + ') score=' + score + ' time=' + dt + 'ms');

  // Test 2: Play a few moves and check timing
  var key = CROSSING_KEYS[idx];
  game.board.set(key, 'blue');
  game.turn = 'red';
  game.moveCount++;

  // Red plays
  g.humanMove(game, 3, 3);

  part = g.recomputeBluePartition(6, game.board);
  mod.HEAPU8.set(boardToArray(game.board), boardPtr);
  mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
  mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);

  t0 = Date.now();
  idx = computerMove(boardPtr, blueLPtr, blueRPtr);
  dt = Date.now() - t0;
  score = getLastScore();
  console.log('Resistance depth-4 move 2: crossing ' + idx + ' (' + CROSSING_KEYS[idx] + ') score=' + score + ' time=' + dt + 'ms');

  // Test 3: Compare with BFS at depth 8
  setResistance(0);
  setDepth(8);
  setBaseWidths(61, 8, 10, 8);
  setWidths(8, 6);

  mod.HEAPU8.set(boardToArray(game.board), boardPtr);
  mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
  mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);

  t0 = Date.now();
  var idx2 = computerMove(boardPtr, blueLPtr, blueRPtr);
  dt = Date.now() - t0;
  score = getLastScore();
  console.log('BFS depth-8 move: crossing ' + idx2 + ' (' + CROSSING_KEYS[idx2] + ') score=' + score + ' time=' + dt + 'ms');

  // Test 4: Play a full game with resistance depth 4 and time it
  setResistance(1);
  setDepth(8);
  setBaseWidths(61, 8, 10, 8);
  setWidths(8, 6);

  var redBoardPtr = mod._malloc(61);
  var redLPtr = mod._malloc(61);
  var redRPtr = mod._malloc(61);
  var redMoveFn = mod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']);
  mod.cwrap('wasm_set_red_variant', null, ['number'])(0);

  // Reset resistance for Blue, Red uses BFS (separate Red function)
  var testGame = g.createGame(6);
  g.humanMove(testGame, 1, 1);

  var totalBlueTime = 0;
  var blueMoves = 0;

  for (var turn = 0; turn < 60; turn++) {
    if (testGame.gameOver) break;

    if (testGame.turn === 'red') {
      var rpart = g.recomputeRedPartition(6, testGame.board);
      mod.HEAPU8.set(boardToArray(testGame.board), redBoardPtr);
      mod.HEAPU8.set(partitionToArray(rpart.L), redLPtr);
      mod.HEAPU8.set(partitionToArray(rpart.R), redRPtr);
      var ridx = redMoveFn(redBoardPtr, redLPtr, redRPtr);
      var rkey = CROSSING_KEYS[ridx];
      var rparts = rkey.split(',');
      g.humanMove(testGame, parseInt(rparts[0]), parseInt(rparts[1]));
    } else {
      var bpart = g.recomputeBluePartition(6, testGame.board);
      mod.HEAPU8.set(boardToArray(testGame.board), boardPtr);
      mod.HEAPU8.set(partitionToArray(bpart.L), blueLPtr);
      mod.HEAPU8.set(partitionToArray(bpart.R), blueRPtr);
      var bt0 = Date.now();
      var bidx = computerMove(boardPtr, blueLPtr, blueRPtr);
      var bdt = Date.now() - bt0;
      totalBlueTime += bdt;
      blueMoves++;
      var bkey = CROSSING_KEYS[bidx];
      testGame.board.set(bkey, 'blue');
      testGame.turn = 'red';
      testGame.moveCount++;
      var blueClaimed = [];
      testGame.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.push(kk); });
      var rc = g.checkWin(blueClaimed, 'blue', testGame.n);
      if (rc.won) { testGame.gameOver = true; testGame.winner = 'blue'; }
      console.log('  Blue move ' + blueMoves + ': ' + bkey + ' (' + bdt + 'ms)');
    }
  }

  console.log('\nFull game result: ' + (testGame.winner || 'none'));
  console.log('Total Blue time: ' + totalBlueTime + 'ms');
  console.log('Avg per move: ' + (totalBlueTime / blueMoves).toFixed(0) + 'ms');

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
  mod._free(redBoardPtr);
  mod._free(redLPtr);
  mod._free(redRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
