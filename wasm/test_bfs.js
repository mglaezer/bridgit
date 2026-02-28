var g = require('../game.js');
var path = require('path');

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
    else arr[i] = 0;
  }
  return arr;
}

async function main() {
  var BridgitBot = require('./bridgit_bot.js');
  var mod = await BridgitBot();

  var wasmBlueDist = mod.cwrap('wasm_blue_distance', 'number', ['number']);
  var wasmRedDistInfo = mod.cwrap('wasm_red_dist_info', null, ['number', 'number', 'number']);

  var boardPtr = mod._malloc(61);
  var minPtr = mod._malloc(4);
  var sumPtr = mod._malloc(4);

  var rng = mulberry32(42);
  var positions = [];

  for (var gi = 0; gi < 200; gi++) {
    var game = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (game.gameOver) break;
      positions.push(new Map(game.board));
      var unclaimed = g.getUnclaimed(game);
      if (unclaimed.length === 0) break;
      var move = unclaimed[Math.floor(rng() * unclaimed.length)];
      var parts = move.split(',');
      var r = parseInt(parts[0]), c = parseInt(parts[1]);
      if (game.turn === 'red') {
        g.humanMove(game, r, c);
      } else {
        game.board.set(move, 'blue');
        game.turn = 'red';
        game.moveCount++;
      }
    }
  }

  console.log('Testing ' + positions.length + ' positions...');
  var errors = 0;

  for (var i = 0; i < positions.length; i++) {
    var arr = boardToArray(positions[i]);
    mod.HEAPU8.set(arr, boardPtr);

    var jsBd = g.blueDistanceToWin(6, positions[i]);
    var wasmBd = wasmBlueDist(boardPtr);
    if (jsBd !== wasmBd) {
      console.log('BFS MISMATCH at pos ' + i + ': JS bd=' + jsBd + ' WASM bd=' + wasmBd);
      errors++;
      if (errors > 10) break;
    }

    var jsRdi = g.redDistInfo(6, positions[i]);
    wasmRedDistInfo(boardPtr, minPtr, sumPtr);
    var wasmMin = mod.getValue(minPtr, 'i32');
    var wasmSum = mod.getValue(sumPtr, 'i32');
    if (jsRdi.min !== wasmMin || jsRdi.sum !== wasmSum) {
      console.log('RDI MISMATCH at pos ' + i + ': JS min=' + jsRdi.min + ' sum=' + jsRdi.sum +
                  ' WASM min=' + wasmMin + ' sum=' + wasmSum);
      errors++;
      if (errors > 10) break;
    }
  }

  mod._free(boardPtr);
  mod._free(minPtr);
  mod._free(sumPtr);

  if (errors === 0)
    console.log('ALL ' + positions.length + ' positions match!');
  else
    console.log(errors + ' ERRORS found!');
}

main().catch(function(e) { console.error(e); process.exit(1); });
