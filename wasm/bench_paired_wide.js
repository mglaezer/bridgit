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

  var NUM_GAMES = parseInt(process.argv[2]) || 500;

  console.log('Paired: JS 4-ply (20x4x6x4) vs WASM wide-4-ply (61x14x16x12) (' + NUM_GAMES + ' games vs weakRed-0.9)');

  var jsWins = 0, wasmWins = 0, both = 0, neither = 0, jsOnly = 0, wasmOnly = 0;

  for (var gi = 0; gi < NUM_GAMES; gi++) {
    var rng1 = mulberry32(gi + 1);
    var rng2 = mulberry32(gi + 1);

    // JS 4-ply
    var gameJS = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (gameJS.gameOver) break;
      if (gameJS.turn === 'red') {
        var unclaimed = g.getUnclaimed(gameJS);
        var optimal = g.getOptimalRedMoves(gameJS);
        var move;
        if (optimal.length > 0 && rng1() < 0.9)
          move = optimal[Math.floor(rng1() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng1() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(gameJS, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        g.computerMove(gameJS);
      }
    }

    // WASM wide-4-ply (61x14x16x12)
    wasmSetDepth(4);
    wasmSetBaseWidths(61, 14, 16, 12);
    var gameWASM = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (gameWASM.gameOver) break;
      if (gameWASM.turn === 'red') {
        var unclaimed = g.getUnclaimed(gameWASM);
        var optimal = g.getOptimalRedMoves(gameWASM);
        var move;
        if (optimal.length > 0 && rng2() < 0.9)
          move = optimal[Math.floor(rng2() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng2() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(gameWASM, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        wasmMove(gameWASM);
      }
    }

    var jsW = gameJS.winner === 'blue';
    var wasmW = gameWASM.winner === 'blue';
    if (jsW) jsWins++;
    if (wasmW) wasmWins++;
    if (jsW && wasmW) both++;
    if (!jsW && !wasmW) neither++;
    if (jsW && !wasmW) jsOnly++;
    if (!jsW && wasmW) wasmOnly++;
  }

  console.log('JS 20x4x6x4:      ' + jsWins + '/' + NUM_GAMES + ' (' + (100 * jsWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('WASM 61x14x16x12:    ' + wasmWins + '/' + NUM_GAMES + ' (' + (100 * wasmWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('Both won:          ' + both);
  console.log('Neither won:       ' + neither);
  console.log('JS only:           ' + jsOnly);
  console.log('WASM only:         ' + wasmOnly);
  console.log('Net gain:          ' + (wasmOnly - jsOnly) + ' games (' + ((wasmOnly - jsOnly) / NUM_GAMES * 100).toFixed(1) + 'pp)');

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
