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

  function runGames(numGames, label) {
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
    var msPerMove = (elapsed / numGames).toFixed(0);
    console.log(label + ': ' + wins + '/' + numGames + ' (' +
                (100 * wins / numGames).toFixed(1) + '%) ' + msPerMove + 'ms/game');
    return wins;
  }

  var NUM_GAMES = parseInt(process.argv[2]) || 200;

  var configs = [
    {depth: 4, bw3: 4, rw3: 4, label: '4-ply'},
    {depth: 6, bw3: 4, rw3: 4, label: '6-ply 4x4'},
    {depth: 6, bw3: 6, rw3: 4, label: '6-ply 6x4'},
    {depth: 6, bw3: 8, rw3: 6, label: '6-ply 8x6'},
    {depth: 6, bw3: 10, rw3: 8, label: '6-ply 10x8'},
    {depth: 6, bw3: 12, rw3: 8, label: '6-ply 12x8'},
  ];

  console.log('Width sweep: WASM vs weakRed-0.9 (' + NUM_GAMES + ' games each)');
  console.log('Base search: 20x4x6x4 = 1920 leaves');
  console.log('');

  for (var c = 0; c < configs.length; c++) {
    wasmSetDepth(configs[c].depth);
    wasmSetWidths(configs[c].bw3, configs[c].rw3);
    runGames(NUM_GAMES, configs[c].label);
  }

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
