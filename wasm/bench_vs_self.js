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

function partitionToArray(partSet) {
  var arr = new Uint8Array(61);
  for (var i = 0; i < 61; i++)
    if (partSet.has(CROSSING_KEYS[i])) arr[i] = 1;
  return arr;
}

function makeBlue(mod, boardPtr, blueLPtr, blueRPtr, computerMove) {
  return function(game) {
    var part = g.recomputeBluePartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), boardPtr);
    mod.HEAPU8.set(partitionToArray(part.L), blueLPtr);
    mod.HEAPU8.set(partitionToArray(part.R), blueRPtr);
    var idx = computerMove(boardPtr, blueLPtr, blueRPtr);
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
  };
}

function makeRed(mod, boardPtr, redLPtr, redRPtr, redMoveFn) {
  return function(game) {
    var part = g.recomputeRedPartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), boardPtr);
    mod.HEAPU8.set(partitionToArray(part.L), redLPtr);
    mod.HEAPU8.set(partitionToArray(part.R), redRPtr);
    var idx = redMoveFn(boardPtr, redLPtr, redRPtr);
    if (idx < 0) return null;
    var key = CROSSING_KEYS[idx];
    var parts = key.split(',');
    g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
    return key;
  };
}

function playGame(game, blueMove, redMove) {
  for (var turn = 0; turn < 122; turn++) {
    if (game.gameOver) break;
    if (game.turn === 'red') redMove(game);
    else blueMove(game);
  }
}

async function main() {
  var Bot = require('./bridgit_bot_beam.js');

  var bluMod = await Bot();
  bluMod.cwrap('wasm_set_resistance', null, ['number'])(1);
  bluMod.cwrap('wasm_set_depth', null, ['number'])(6);
  bluMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  bluMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var bP = bluMod._malloc(61), blP = bluMod._malloc(61), brP = bluMod._malloc(61);
  var blueMove = makeBlue(bluMod, bP, blP, brP,
    bluMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']));

  var redMod = await Bot();
  redMod.cwrap('wasm_set_resistance', null, ['number'])(1);
  redMod.cwrap('wasm_set_depth', null, ['number'])(6);
  redMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  redMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var setRedVariant = redMod.cwrap('wasm_set_red_variant', null, ['number']);
  var rbP = redMod._malloc(61), rlP = redMod._malloc(61), rrP = redMod._malloc(61);
  var redMove = makeRed(redMod, rbP, rlP, rrP,
    redMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']));

  var NUM = 122;
  var blueWins = 0, redWins = 0;
  var blueTime = 0, redTime = 0;
  var gi = 0;

  console.log('Resistance Blue (d6 [61,20,20,10]+[8,6]) vs Resistance Red (d6 [61,20,20,10]+[8,6])');
  console.log(NUM + ' games: 61 openings x 2 Red variants');

  for (var opening = 0; opening < 61; opening++) {
    var openingKey = CROSSING_KEYS[opening];
    var openParts = openingKey.split(',');
    for (var variant = 0; variant < 2; variant++) {
      setRedVariant(variant);
      var game = g.createGame(6);
      g.humanMove(game, parseInt(openParts[0]), parseInt(openParts[1]));
      playGame(game, blueMove, redMove);
      if (game.winner === 'blue') blueWins++;
      else redWins++;
      gi++;
      if (gi % 20 === 0)
        console.log('  ' + gi + '/' + NUM + ': blue=' + blueWins + ' red=' + redWins);
    }
  }

  console.log('');
  console.log('Blue wins: ' + blueWins + '/' + NUM + ' (' + (100*blueWins/NUM).toFixed(1) + '%)');
  console.log('Red wins:  ' + redWins + '/' + NUM + ' (' + (100*redWins/NUM).toFixed(1) + '%)');

  bluMod._free(bP); bluMod._free(blP); bluMod._free(brP);
  redMod._free(rbP); redMod._free(rlP); redMod._free(rrP);
}
main().catch(function(e) { console.error(e); process.exit(1); });
