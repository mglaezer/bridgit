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
  var ResMod = await require('./bridgit_bot_beam.js')();
  ResMod.cwrap('wasm_set_resistance', null, ['number'])(1);
  ResMod.cwrap('wasm_set_depth', null, ['number'])(6);
  ResMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  ResMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var resBlue = makeBlue(ResMod, ResMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']));
  var resRed = makeRed(ResMod, ResMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']));
  var resSetVariant = ResMod.cwrap('wasm_set_red_variant', null, ['number']);

  var BfsMod = await require('./baseline_beam.js')();
  BfsMod.cwrap('wasm_set_depth', null, ['number'])(6);
  BfsMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  BfsMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var bfsBlue = makeBlue(BfsMod, BfsMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']));
  var bfsRed = makeRed(BfsMod, BfsMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']));
  var bfsSetVariant = BfsMod.cwrap('wasm_set_red_variant', null, ['number']);

  var resWinsAsBlue = 0, resWinsAsRed = 0;
  var bfsWinsAsBlue = 0, bfsWinsAsRed = 0;
  var gi = 0;
  var NUM = 244;

  console.log('Resistance vs BFS, both d6 [61,20,20,10]+[8,6], alternating sides');
  console.log(NUM + ' games: 61 openings x 2 variants x 2 sides');

  for (var opening = 0; opening < 61; opening++) {
    var openingKey = CROSSING_KEYS[opening];
    var openParts = openingKey.split(',');
    for (var variant = 0; variant < 2; variant++) {
      resSetVariant(variant);
      bfsSetVariant(variant);

      var g1 = g.createGame(6);
      g.humanMove(g1, parseInt(openParts[0]), parseInt(openParts[1]));
      playGame(g1, resBlue, bfsRed);
      if (g1.winner === 'blue') resWinsAsBlue++;
      else bfsWinsAsRed++;

      var g2 = g.createGame(6);
      g.humanMove(g2, parseInt(openParts[0]), parseInt(openParts[1]));
      playGame(g2, bfsBlue, resRed);
      if (g2.winner === 'blue') bfsWinsAsBlue++;
      else resWinsAsRed++;

      gi += 2;
      if (gi % 40 === 0)
        console.log('  ' + gi + '/' + NUM + ': res=' + (resWinsAsBlue + resWinsAsRed) + ' bfs=' + (bfsWinsAsBlue + bfsWinsAsRed));
    }
  }

  var resTot = resWinsAsBlue + resWinsAsRed;
  var bfsTot = bfsWinsAsBlue + bfsWinsAsRed;
  console.log('');
  console.log('Resistance total: ' + resTot + '/' + NUM + ' (' + (100*resTot/NUM).toFixed(1) + '%)');
  console.log('  as Blue: ' + resWinsAsBlue + '/122  as Red: ' + resWinsAsRed + '/122');
  console.log('BFS total:        ' + bfsTot + '/' + NUM + ' (' + (100*bfsTot/NUM).toFixed(1) + '%)');
  console.log('  as Blue: ' + bfsWinsAsBlue + '/122  as Red: ' + bfsWinsAsRed + '/122');
}
main().catch(function(e) { console.error(e); process.exit(1); });
