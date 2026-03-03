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
  var BridgitBot = require('./bridgit_bot_beam.js');
  var mod = await BridgitBot();
  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);
  var wasmComputerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  mod.cwrap('wasm_set_depth', null, ['number'])(4);
  mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(20, 4, 6, 4);
  mod.cwrap('wasm_set_widths', null, ['number', 'number'])(4, 3);

  var NUM_GAMES = 20;
  var totalMoves = 0, mismatches = 0;

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
        var part = g.recomputeBluePartition(6, game.board);
        game.blueL = part.L;
        game.blueR = part.R;
        mod.HEAPU8.set(boardToArray(game.board), boardPtr);
        mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
        mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);
        var wasmIdx = wasmComputerMove(boardPtr, blueLPtr, blueRPtr);
        var wasmKey = CROSSING_KEYS[wasmIdx];

        var jsResult = g.computerMove(game);
        var jsKey = jsResult ? jsResult.key : null;

        totalMoves++;
        if (wasmKey !== jsKey) {
          mismatches++;
          if (mismatches <= 10)
            console.log('Game ' + (gi+1) + ' move ' + game.moveCount + ': JS=' + jsKey + ' WASM=' + wasmKey);
        }
      }
    }
  }

  console.log('Total moves: ' + totalMoves + ', mismatches: ' + mismatches + ' (' + (100 * mismatches / totalMoves).toFixed(1) + '%)');
  mod._free(boardPtr); mod._free(blueLPtr); mod._free(blueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
