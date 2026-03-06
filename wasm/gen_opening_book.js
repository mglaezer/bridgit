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

function keyToIdx(key) {
  for (var i = 0; i < CROSSING_KEYS.length; i++)
    if (CROSSING_KEYS[i] === key) return i;
  return -1;
}

async function main() {
  var Bot = require('./bridgit_bot_beam.js');
  var mod = await Bot();
  mod.cwrap('wasm_set_resistance', null, ['number'])(1);
  mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  mod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var computerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var setDepth = mod.cwrap('wasm_set_depth', null, ['number']);
  var bp = mod._malloc(61), lp = mod._malloc(61), rp = mod._malloc(61);

  function blueMove(game, depth) {
    setDepth(depth);
    var part = g.recomputeBluePartition(6, game.board);
    mod.HEAPU8.set(boardToArray(game.board), bp);
    mod.HEAPU8.set(partitionToArray(part.L), lp);
    mod.HEAPU8.set(partitionToArray(part.R), rp);
    return computerMove(bp, lp, rp);
  }

  function getRedCandidates(game, topN) {
    var unclaimed = [];
    for (var i = 0; i < 61; i++) {
      var owner = game.board.get(CROSSING_KEYS[i]);
      if (!owner) unclaimed.push(i);
    }
    var scored = [];
    for (var i = 0; i < unclaimed.length; i++) {
      var ci = unclaimed[i];
      var key = CROSSING_KEYS[ci];
      game.board.set(key, 'red');
      var part = g.recomputeBluePartition(6, game.board);
      mod.HEAPU8.set(boardToArray(game.board), bp);
      mod.HEAPU8.set(partitionToArray(part.L), lp);
      mod.HEAPU8.set(partitionToArray(part.R), rp);
      setDepth(6);
      var blueIdx = computerMove(bp, lp, rp);
      var score = mod.cwrap('wasm_get_last_score', 'number', [])();
      game.board.delete(key);
      scored.push({idx: ci, score: -score});
    }
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, topN);
  }

  var book = [];
  var getScore = mod.cwrap('wasm_get_last_score', 'number', []);

  for (var opening = 0; opening < 61; opening++) {
    var openingKey = CROSSING_KEYS[opening];
    var openParts = openingKey.split(',');

    var game1 = g.createGame(6);
    g.humanMove(game1, parseInt(openParts[0]), parseInt(openParts[1]));

    var blue1Idx = blueMove(game1, 6);
    var blue1Key = CROSSING_KEYS[blue1Idx];
    game1.board.set(blue1Key, 'blue');
    game1.turn = 'red';
    game1.moveCount++;

    var redCands = getRedCandidates(game1, 10);
    process.stderr.write('Opening ' + opening + '/61 (' + openingKey + '): ' + redCands.length + ' Red responses...');

    for (var r = 0; r < redCands.length; r++) {
      var red2Idx = redCands[r].idx;
      var red2Key = CROSSING_KEYS[red2Idx];

      var game2 = g.createGame(6);
      g.humanMove(game2, parseInt(openParts[0]), parseInt(openParts[1]));
      game2.board.set(blue1Key, 'blue');
      game2.turn = 'red';
      game2.moveCount++;
      var red2Parts = red2Key.split(',');
      g.humanMove(game2, parseInt(red2Parts[0]), parseInt(red2Parts[1]));

      var blue2Idx = blueMove(game2, 8);
      book.push({red1: opening, red2: red2Idx, blue2: blue2Idx});
    }
    process.stderr.write(' done\n');
  }

  console.log('');
  console.log('// Opening book: ' + book.length + ' entries');
  console.log('// Format: {red1_idx, red2_idx, blue2_idx}');
  console.log('static const uint8_t opening_book[][3] = {');
  for (var i = 0; i < book.length; i++) {
    var comma = (i < book.length - 1) ? ',' : '';
    console.log('  {' + book[i].red1 + ', ' + book[i].red2 + ', ' + book[i].blue2 + '}' + comma);
  }
  console.log('};');
  console.log('#define OPENING_BOOK_SIZE ' + book.length);

  mod._free(bp);
  mod._free(lp);
  mod._free(rp);
}

main().catch(function(e) { console.error(e); process.exit(1); });
