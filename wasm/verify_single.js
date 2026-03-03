var g = require('../game.js');

var CROSSINGS = g.allPlayableCrossings(g.N);
var CROSSING_KEYS = [];
for (var i = 0; i < CROSSINGS.length; i++)
  CROSSING_KEYS.push(g.k(CROSSINGS[i][0], CROSSINGS[i][1]));

async function main() {
  var BridgitBot = require('./bridgit_bot_beam.js');
  var mod = await BridgitBot();
  var boardPtr = mod._malloc(61);
  var blueLPtr = mod._malloc(61);
  var blueRPtr = mod._malloc(61);
  var wasmBd = mod.cwrap('wasm_blue_distance', 'number', ['number']);
  var wasmRdi = mod.cwrap('wasm_red_dist_info', null, ['number', 'number', 'number']);
  var minPtr = mod._malloc(4);
  var sumPtr = mod._malloc(4);

  var game = g.createGame(6);
  g.humanMove(game, 5, 5);

  var boardArr = new Uint8Array(61);
  for (var i = 0; i < 61; i++) {
    var owner = game.board.get(CROSSING_KEYS[i]);
    if (owner === 'red') boardArr[i] = 1;
    else if (owner === 'blue') boardArr[i] = 2;
  }
  mod.HEAPU8.set(boardArr, boardPtr);

  var jsBd = g.blueDistanceToWin(6, game.board);
  var jsRdi = g.redDistInfo(6, game.board);

  var cBd = wasmBd(boardPtr);
  wasmRdi(boardPtr, minPtr, sumPtr);
  var cRdMin = mod.getValue(minPtr, 'i32');
  var cRdSum = mod.getValue(sumPtr, 'i32');

  console.log('After Red plays (5,5):');
  console.log('  JS:  bd=' + jsBd + ' rdMin=' + jsRdi.min + ' rdSum=' + jsRdi.sum);
  console.log('  C:   bd=' + cBd + ' rdMin=' + cRdMin + ' rdSum=' + cRdSum);
  console.log('  Match: ' + (jsBd === cBd && jsRdi.min === cRdMin && jsRdi.sum === cRdSum));

  console.log('\nPer-crossing bd comparison (first 10):');
  var mismatches = 0;
  for (var i = 0; i < 61; i++) {
    if (game.board.has(CROSSING_KEYS[i])) continue;
    game.board.set(CROSSING_KEYS[i], 'blue');
    var jb = g.blueDistanceToWin(6, game.board);
    var jr = g.redDistInfo(6, game.board);
    game.board.delete(CROSSING_KEYS[i]);

    boardArr[i] = 2;
    mod.HEAPU8.set(boardArr, boardPtr);
    var cb = wasmBd(boardPtr);
    wasmRdi(boardPtr, minPtr, sumPtr);
    var crm = mod.getValue(minPtr, 'i32');
    var crs = mod.getValue(sumPtr, 'i32');
    boardArr[i] = 0;

    if (jb !== cb || jr.min !== crm || jr.sum !== crs) {
      mismatches++;
      console.log('  crossing ' + i + ' (' + CROSSING_KEYS[i] + '): JS bd=' + jb + ' rdMin=' + jr.min + ' rdSum=' + jr.sum + '  C bd=' + cb + ' rdMin=' + crm + ' rdSum=' + crs);
    }
  }
  console.log('BFS mismatches: ' + mismatches + '/60');

  mod._free(boardPtr); mod._free(blueLPtr); mod._free(blueRPtr);
  mod._free(minPtr); mod._free(sumPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
