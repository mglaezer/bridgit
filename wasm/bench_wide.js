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
  var wasmSetDepth = mod.cwrap('wasm_set_depth', null, ['number']);
  var wasmSetWidths = mod.cwrap('wasm_set_widths', null, ['number', 'number']);
  var wasmSetBaseWidths = mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number']);

  function wasmMove(game) {
    var part = g.recomputeBluePartition(6, game.board);
    game.blueL = part.L;
    game.blueR = part.R;
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

  function runGames(numGames) {
    var wins = 0;
    var t0 = Date.now();
    for (var gi = 0; gi < numGames; gi++) {
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
          wasmMove(game);
        }
      }
      if (game.winner === 'blue') wins++;
    }
    var elapsed = Date.now() - t0;
    return {wins: wins, elapsed: elapsed};
  }

  var NUM_GAMES = parseInt(process.argv[2]) || 200;

  // topN x redW x blueW2 x redW2
  var configs = [
    {tn: 20, rw: 4, bw2: 6, rw2: 4, depth: 4, label: '20x4x6x4 (JS baseline)'},
    {tn: 30, rw: 6, bw2: 8, rw2: 6, depth: 4, label: '30x6x8x6'},
    {tn: 30, rw: 6, bw2: 10, rw2: 6, depth: 4, label: '30x6x10x6'},
    {tn: 40, rw: 8, bw2: 10, rw2: 8, depth: 4, label: '40x8x10x8'},
    {tn: 40, rw: 8, bw2: 12, rw2: 8, depth: 4, label: '40x8x12x8'},
    {tn: 20, rw: 4, bw2: 6, rw2: 4, depth: 6, label: '20x4x6x4 +6ply 8x6'},
  ];

  console.log('Width sweep: WASM 4-ply with wider beams (' + NUM_GAMES + ' games each)');
  console.log('');

  for (var c = 0; c < configs.length; c++) {
    var cfg = configs[c];
    wasmSetBaseWidths(cfg.tn, cfg.rw, cfg.bw2, cfg.rw2);
    wasmSetDepth(cfg.depth);
    if (cfg.depth >= 6) wasmSetWidths(8, 6);
    var r = runGames(NUM_GAMES);
    var msPerGame = (r.elapsed / NUM_GAMES).toFixed(0);
    console.log(cfg.label + ': ' + r.wins + '/' + NUM_GAMES + ' (' +
                (100 * r.wins / NUM_GAMES).toFixed(1) + '%) ' + msPerGame + 'ms/game');
  }

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
