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

function makeBlue(mod, computerMove) {
  var bp = mod._malloc(61), lp = mod._malloc(61), rp = mod._malloc(61);
  return function(game) {
    var part = g.recomputeBluePartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), bp);
    mod.HEAPU8.set(partitionToArray(part.L), lp);
    mod.HEAPU8.set(partitionToArray(part.R), rp);
    var idx = computerMove(bp, lp, rp);
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

function makeRed(mod, redMoveFn) {
  var bp = mod._malloc(61), lp = mod._malloc(61), rp = mod._malloc(61);
  return function(game) {
    var part = g.recomputeRedPartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), bp);
    mod.HEAPU8.set(partitionToArray(part.L), lp);
    mod.HEAPU8.set(partitionToArray(part.R), rp);
    var idx = redMoveFn(bp, lp, rp);
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
  var RedBot = require('./baseline_beam.js');
  var redMod = await RedBot();
  redMod.cwrap('wasm_set_depth', null, ['number'])(8);
  redMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 8, 10, 8);
  redMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var setRedVariant = redMod.cwrap('wasm_set_red_variant', null, ['number']);
  var redMove = makeRed(redMod, redMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']));

  var BluBot = require('./bridgit_bot_beam.js');
  var bluMod = await BluBot();
  bluMod.cwrap('wasm_set_resistance', null, ['number'])(1);
  bluMod.cwrap('wasm_set_depth', null, ['number'])(6);
  bluMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  bluMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var setWeights = bluMod.cwrap('wasm_set_resistance_weights', null, ['number', 'number']);
  var computerMove = bluMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var blueMove = makeBlue(bluMod, computerMove);

  var configs = [
    { name: '1500/1000', red_w: 1500, blue_w: 1000 },
    { name: '1700/1000', red_w: 1700, blue_w: 1000 },
    { name: '2000/1000', red_w: 2000, blue_w: 1000 },
    { name: '2500/1000', red_w: 2500, blue_w: 1000 },
    { name: '1500/700',  red_w: 1500, blue_w: 700  },
  ];

  var NUM = 122;
  for (var ci = 0; ci < configs.length; ci++) {
    var cfg = configs[ci];
    setWeights(cfg.red_w, cfg.blue_w);
    var wins = 0;
    for (var opening = 0; opening < 61; opening++) {
      var openingKey = CROSSING_KEYS[opening];
      var openParts = openingKey.split(',');
      for (var variant = 0; variant < 2; variant++) {
        setRedVariant(variant);
        var game = g.createGame(6);
        g.humanMove(game, parseInt(openParts[0]), parseInt(openParts[1]));
        playGame(game, blueMove, redMove);
        if (game.winner === 'blue') wins++;
      }
    }
    console.log(cfg.name + ': ' + wins + '/' + NUM + ' (' + (100*wins/NUM).toFixed(1) + '%)');
  }
}
main().catch(function(e) { console.error(e); process.exit(1); });
