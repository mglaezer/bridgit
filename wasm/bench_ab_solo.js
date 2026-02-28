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
  var wasmComputerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  mod.cwrap('wasm_init', null, [])();
  mod.cwrap('wasm_set_time_limit', null, ['number'])(1200);

  function wasmMove(game) {
    var part = g.recomputeBluePartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), boardPtr);
    mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
    mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);
    var idx = wasmComputerMove(boardPtr, blueLPtr, blueRPtr);
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

  var NUM_GAMES = parseInt(process.argv[2]) || 100;
  console.log('Alpha-beta solo: ' + NUM_GAMES + ' games vs weakRed-0.9');

  var wins = 0;
  var totalTime = 0, totalMoves = 0;
  var maxTime = 0;

  for (var gi = 0; gi < NUM_GAMES; gi++) {
    var rng = mulberry32(gi + 1);
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
        var t0 = Date.now();
        wasmMove(game);
        var dt = Date.now() - t0;
        totalTime += dt;
        totalMoves++;
        if (dt > maxTime) maxTime = dt;
      }
    }
    if (game.winner === 'blue') wins++;
    if ((gi + 1) % 20 === 0)
      console.log('  ' + (gi + 1) + '/' + NUM_GAMES + ': ' + wins + ' wins (' + (100 * wins / (gi + 1)).toFixed(1) + '%)');
  }

  console.log('');
  console.log('Win rate: ' + wins + '/' + NUM_GAMES + ' (' + (100 * wins / NUM_GAMES).toFixed(1) + '%)');
  console.log('Avg time/move: ' + (totalTime / totalMoves).toFixed(1) + 'ms');
  console.log('Max time/move: ' + maxTime + 'ms');

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
