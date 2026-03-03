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

var gameMoves = [
  {p:"red",m:"4,6"},{p:"blue",m:"1,1"},{p:"red",m:"2,6"},{p:"blue",m:"5,5"},
  {p:"red",m:"5,7"},{p:"blue",m:"7,7"},{p:"red",m:"7,9"},{p:"blue",m:"9,9"},
  {p:"red",m:"9,11"},{p:"blue",m:"11,11"},{p:"red",m:"10,10"},{p:"blue",m:"11,9"},
  {p:"red",m:"10,8"},{p:"blue",m:"11,7"},{p:"red",m:"10,6"},{p:"blue",m:"11,5"},
  {p:"red",m:"11,3"},{p:"blue",m:"10,4"},{p:"red",m:"9,3"},{p:"blue",m:"8,4"},
  {p:"red",m:"7,3"},{p:"blue",m:"5,3"},{p:"red",m:"5,1"},{p:"blue",m:"6,4"},
  {p:"red",m:"4,2"},{p:"blue",m:"6,2"},{p:"red",m:"7,1"},{p:"blue",m:"8,2"},
  {p:"red",m:"9,1"},{p:"blue",m:"4,4"},{p:"red",m:"3,3"},{p:"blue",m:"1,3"},
  {p:"red",m:"2,4"},{p:"blue",m:"1,5"},{p:"red",m:"1,7"},{p:"blue",m:"10,2"},
  {p:"red",m:"11,1"}
];

async function main() {
  var Bot = require('./bridgit_bot_beam.js');
  var mod = await Bot();
  mod.cwrap('wasm_set_resistance', null, ['number'])(1);
  var preset = process.argv[2] || 'expert';
  if (preset === 'intermediate') {
    console.log('Using INTERMEDIATE preset: d6 [61,14,14,8]+[6,4]');
    mod.cwrap('wasm_set_depth', null, ['number'])(6);
    mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 14, 14, 8);
    mod.cwrap('wasm_set_widths', null, ['number', 'number'])(6, 4);
  } else {
    console.log('Using EXPERT preset: d6 [61,20,20,10]+[8,6]');
    mod.cwrap('wasm_set_depth', null, ['number'])(6);
    mod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
    mod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  }
  var computerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  var getScore = mod.cwrap('wasm_get_last_score', 'number', []);
  var bp = mod._malloc(61), lp = mod._malloc(61), rp = mod._malloc(61);

  var game = g.createGame(6);

  for (var i = 0; i < gameMoves.length; i++) {
    var entry = gameMoves[i];
    if (entry.p === 'red') {
      var parts = entry.m.split(',');
      g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
      console.log((i+1) + '. Red:  ' + entry.m);
    } else {
      var part = g.recomputeBluePartition(6, game.board);
      mod.HEAPU8.set(boardToArray(game.board), bp);
      mod.HEAPU8.set(partitionToArray(part.L), lp);
      mod.HEAPU8.set(partitionToArray(part.R), rp);
      var t0 = Date.now();
      var idx = computerMove(bp, lp, rp);
      var elapsed = Date.now() - t0;
      var score = getScore();
      var botMove = idx >= 0 ? CROSSING_KEYS[idx] : 'none';
      var match = botMove === entry.m ? '' : ' MISMATCH! bot=' + botMove;
      console.log((i+1) + '. Blue: ' + entry.m + ' (bot=' + botMove + ' score=' + score + ' ' + elapsed + 'ms)' + match);

      game.board.set(entry.m, 'blue');
      game.turn = 'red';
      game.moveCount++;
    }
  }
}
main().catch(function(e) { console.error(e); process.exit(1); });
