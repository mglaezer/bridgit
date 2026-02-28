var g = require('../game.js');

var CROSSINGS = g.allPlayableCrossings(g.N);
var CROSSING_KEYS = [];
for (var i = 0; i < CROSSINGS.length; i++)
  CROSSING_KEYS.push(g.k(CROSSINGS[i][0], CROSSINGS[i][1]));

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

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
  var BridgitBot = require('./bridgit_bot.js');
  var mod = await BridgitBot();

  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);
  var minPtr = mod._malloc(4);
  var sumPtr = mod._malloc(4);

  var wasmBlueDist = mod.cwrap('wasm_blue_distance', 'number', ['number']);
  var wasmRedDistInfo = mod.cwrap('wasm_red_dist_info', null, ['number', 'number', 'number']);
  var wasmComputerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var wasmSetDepth = mod.cwrap('wasm_set_depth', null, ['number']);

  // Collect positions from random games
  var rng = mulberry32(42);
  var positions = [];
  for (var gi = 0; gi < 50; gi++) {
    var game = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (game.gameOver) break;
      if (game.turn === 'red') {
        var unclaimed = g.getUnclaimed(game);
        var optimal = g.getOptimalRedMoves(game);
        var move;
        if (optimal.length > 0 && rng() < 0.9)
          move = optimal[Math.floor(rng() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        positions.push(new Map(game.board));
        g.computerMove(game);
      }
    }
  }
  console.log('Collected ' + positions.length + ' positions');

  // Benchmark leaf eval: JS vs WASM
  var ITERS = 50;
  var n = g.N;

  var t0 = Date.now();
  for (var iter = 0; iter < ITERS; iter++) {
    for (var i = 0; i < positions.length; i++) {
      g.redDistInfo(n, positions[i]);
      g.blueDistanceToWin(n, positions[i]);
    }
  }
  var jsMs = Date.now() - t0;
  var jsPerEval = (jsMs / (positions.length * ITERS) * 1000).toFixed(1);

  t0 = Date.now();
  for (var iter = 0; iter < ITERS; iter++) {
    for (var i = 0; i < positions.length; i++) {
      var arr = boardToArray(positions[i]);
      mod.HEAPU8.set(arr, boardPtr);
      wasmBlueDist(boardPtr);
      wasmRedDistInfo(boardPtr, minPtr, sumPtr);
    }
  }
  var wasmMs = Date.now() - t0;
  var wasmPerEval = (wasmMs / (positions.length * ITERS) * 1000).toFixed(1);

  console.log('Leaf eval (bd + rdi):');
  console.log('  JS:   ' + jsMs + 'ms total, ' + jsPerEval + 'us/eval');
  console.log('  WASM: ' + wasmMs + 'ms total, ' + wasmPerEval + 'us/eval');
  console.log('  Speedup: ' + (jsMs / wasmMs).toFixed(1) + 'x');

  // Benchmark full computerMove: JS 4-ply vs WASM 4-ply vs WASM 6-ply
  var testPositions = positions.slice(0, 20);

  // JS 4-ply
  t0 = Date.now();
  var jsMoves = [];
  for (var i = 0; i < testPositions.length; i++) {
    var game = g.createGame(6);
    game.board = new Map(testPositions[i]);
    game.turn = 'blue';
    var part = g.recomputeBluePartition(6, game.board);
    game.blueL = part.L;
    game.blueR = part.R;
    g.computerMove(game);
    jsMoves.push(game.board);
  }
  var js4ms = Date.now() - t0;
  console.log('\nFull computerMove (' + testPositions.length + ' positions):');
  console.log('  JS 4-ply:   ' + js4ms + 'ms (' + (js4ms / testPositions.length).toFixed(1) + 'ms/move)');

  // WASM 4-ply
  wasmSetDepth(4);
  t0 = Date.now();
  for (var i = 0; i < testPositions.length; i++) {
    var arr = boardToArray(testPositions[i]);
    var game2 = g.createGame(6);
    game2.board = new Map(testPositions[i]);
    var part2 = g.recomputeBluePartition(6, game2.board);
    var blueL = partitionToArray(part2.L);
    var blueR = partitionToArray(part2.R);
    mod.HEAPU8.set(arr, boardPtr);
    mod.HEAPU8.set(blueL, blueLPtr);
    mod.HEAPU8.set(blueR, blueRPtr);
    wasmComputerMove(boardPtr, blueLPtr, blueRPtr);
  }
  var wasm4ms = Date.now() - t0;
  console.log('  WASM 4-ply: ' + wasm4ms + 'ms (' + (wasm4ms / testPositions.length).toFixed(1) + 'ms/move)');
  console.log('  Speedup: ' + (js4ms / wasm4ms).toFixed(1) + 'x');

  // WASM 6-ply
  wasmSetDepth(6);
  t0 = Date.now();
  for (var i = 0; i < testPositions.length; i++) {
    var arr = boardToArray(testPositions[i]);
    var game3 = g.createGame(6);
    game3.board = new Map(testPositions[i]);
    var part3 = g.recomputeBluePartition(6, game3.board);
    var blueL = partitionToArray(part3.L);
    var blueR = partitionToArray(part3.R);
    mod.HEAPU8.set(arr, boardPtr);
    mod.HEAPU8.set(blueL, blueLPtr);
    mod.HEAPU8.set(blueR, blueRPtr);
    wasmComputerMove(boardPtr, blueLPtr, blueRPtr);
  }
  var wasm6ms = Date.now() - t0;
  console.log('  WASM 6-ply: ' + wasm6ms + 'ms (' + (wasm6ms / testPositions.length).toFixed(1) + 'ms/move)');

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
  mod._free(minPtr);
  mod._free(sumPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
