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

function indexToKey(idx) {
  return CROSSING_KEYS[idx];
}

async function main() {
  var BridgitBot = require('./bridgit_bot.js');
  var mod = await BridgitBot();

  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);

  var wasmComputerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var wasmSetDepth = mod.cwrap('wasm_set_depth', null, ['number']);

  var NUM_GAMES = parseInt(process.argv[2]) || 200;
  var depth = parseInt(process.argv[3]) || 4;
  wasmSetDepth(depth);

  function wasmMove(game) {
    var part = g.recomputeBluePartition(6, game.board);
    game.blueL = part.L;
    game.blueR = part.R;
    var arr = boardToArray(game.board);
    var blueL = partitionToArray(part.L);
    var blueR = partitionToArray(part.R);
    mod.HEAPU8.set(arr, boardPtr);
    mod.HEAPU8.set(blueL, blueLPtr);
    mod.HEAPU8.set(blueR, blueRPtr);
    var idx = wasmComputerMove(boardPtr, blueLPtr, blueRPtr);
    if (idx < 0) return null;
    var key = indexToKey(idx);
    game.board.set(key, 'blue');
    game.turn = 'red';
    game.moveCount++;
    var blueClaimed = [];
    game.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.push(kk); });
    var rc = g.checkWin(blueClaimed, 'blue', game.n);
    if (rc.won) { game.gameOver = true; game.winner = 'blue'; }
    return key;
  }

  // Compare at 4-ply: WASM should match JS move-for-move
  if (depth === 4) {
    console.log('Move comparison: JS 4-ply vs WASM 4-ply (' + NUM_GAMES + ' games)');
    var mismatches = 0;
    var totalMoves = 0;

    for (var gi = 0; gi < NUM_GAMES; gi++) {
      var rng = mulberry32(gi + 1);
      var gameJS = g.createGame(6);
      var gameWASM = g.createGame(6);

      for (var turn = 0; turn < 122; turn++) {
        if (gameJS.gameOver) break;
        if (gameJS.turn === 'red') {
          var unclaimed = g.getUnclaimed(gameJS);
          var optimal = g.getOptimalRedMoves(gameJS);
          var move;
          if (optimal.length > 0 && rng() < 0.9)
            move = optimal[Math.floor(rng() * optimal.length)];
          else {
            if (unclaimed.length === 0) break;
            move = unclaimed[Math.floor(rng() * unclaimed.length)];
          }
          var parts = move.split(',');
          g.humanMove(gameJS, parseInt(parts[0]), parseInt(parts[1]));
          g.humanMove(gameWASM, parseInt(parts[0]), parseInt(parts[1]));
        } else {
          totalMoves++;
          var jsResult = g.computerMove(gameJS);
          var jsMove = jsResult ? jsResult.key : null;
          var wasmMoveKey = wasmMove(gameWASM);
          if (jsMove !== wasmMoveKey) {
            mismatches++;
            if (mismatches <= 5)
              console.log('  Game ' + gi + ' turn ' + turn + ': JS=' + jsMove + ' WASM=' + wasmMoveKey);
          }
        }
      }
    }
    console.log('Total moves: ' + totalMoves + ', mismatches: ' + mismatches +
                ' (' + (100 * mismatches / totalMoves).toFixed(1) + '%)');
  }

  // Win rate benchmark
  console.log('\nWin rate: WASM ' + depth + '-ply vs weakRed-0.9 (' + NUM_GAMES + ' games)');
  var wins = 0;
  for (var gi = 0; gi < NUM_GAMES; gi++) {
    var rng2 = mulberry32(gi + 1000);
    var game = g.createGame(6);

    for (var turn = 0; turn < 122; turn++) {
      if (game.gameOver) break;
      if (game.turn === 'red') {
        var unclaimed = g.getUnclaimed(game);
        var optimal = g.getOptimalRedMoves(game);
        var move;
        if (optimal.length > 0 && rng2() < 0.9)
          move = optimal[Math.floor(rng2() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng2() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        wasmMove(game);
      }
    }
    if (game.winner === 'blue') wins++;
  }
  console.log('Blue wins: ' + wins + '/' + NUM_GAMES + ' (' + (100 * wins / NUM_GAMES).toFixed(1) + '%)');

  mod._free(boardPtr);
  mod._free(blueLPtr);
  mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
