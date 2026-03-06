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

function makeWasmBlueMover(mod, boardPtr, blueLPtr, blueRPtr, computerMove) {
  return function(game) {
    var part = g.recomputeBluePartition(6, game.board);
    game.blueL = part.L;
    game.blueR = part.R;
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

function makeWasmRedMover(mod, boardPtr, redLPtr, redRPtr, redMoveFn) {
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
  var moves = [];
  for (var turn = 0; turn < 122; turn++) {
    if (game.gameOver) break;
    if (game.turn === 'red') {
      var rk = redMove(game);
      if (rk) moves.push('R:' + rk);
    } else {
      var bk = blueMove(game);
      if (bk) moves.push('B:' + bk);
    }
  }
  return moves;
}

async function main() {
  var NewBot = require('./bridgit_bot_beam.js');
  var newMod = await NewBot();
  var newBoardPtr = newMod._malloc(61);
  var newBlueLPtr = newMod._malloc(61);
  var newBlueRPtr = newMod._malloc(61);
  var newComputerMove = newMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  newMod.cwrap('wasm_set_resistance', null, ['number'])(1);
  newMod.cwrap('wasm_set_depth', null, ['number'])(6);
  newMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 20, 20, 10);
  newMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var newBlueMove = makeWasmBlueMover(newMod, newBoardPtr, newBlueLPtr, newBlueRPtr, newComputerMove);

  var OldBot = require('./baseline_beam.js');
  var oldMod = await OldBot();
  var oldBoardPtr = oldMod._malloc(61);
  var oldBlueLPtr = oldMod._malloc(61);
  var oldBlueRPtr = oldMod._malloc(61);
  var oldComputerMove = oldMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  oldMod.cwrap('wasm_set_depth', null, ['number'])(8);
  oldMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(61, 8, 10, 8);
  oldMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var oldBlueMove = makeWasmBlueMover(oldMod, oldBoardPtr, oldBlueLPtr, oldBlueRPtr, oldComputerMove);

  var redBoardPtr = oldMod._malloc(61);
  var redLPtr = oldMod._malloc(61);
  var redRPtr = oldMod._malloc(61);
  var redMoveFn = oldMod.cwrap('wasm_computer_move_red', 'number', ['number', 'number', 'number']);
  var setRedVariant = oldMod.cwrap('wasm_set_red_variant', null, ['number']);
  var redMove = makeWasmRedMover(oldMod, redBoardPtr, redLPtr, redRPtr, redMoveFn);

  var NUM_VARIANTS = 2;
  var NUM_GAMES = 61 * NUM_VARIANTS;

  console.log('Generational benchmark (' + NUM_GAMES + ' games: 61 openings x ' + NUM_VARIANTS + ' Red variants)');
  console.log('Red = previous gen beam search, variant shifts tie-breaking among near-equal moves');

  var oldWins = 0, newWins = 0, both = 0, neither = 0, oldOnly = 0, newOnly = 0;
  var newTotalTime = 0, newTotalMoves = 0;
  var oldTotalTime = 0, oldTotalMoves = 0;
  var gi = 0;
  var lostGames = [];

  for (var opening = 0; opening < 61; opening++) {
    var openingKey = CROSSING_KEYS[opening];
    var openParts = openingKey.split(',');

    for (var variant = 0; variant < NUM_VARIANTS; variant++) {
      setRedVariant(variant);

      var gameOld = g.createGame(6);
      g.humanMove(gameOld, parseInt(openParts[0]), parseInt(openParts[1]));

      var t0 = Date.now();
      playGame(gameOld, oldBlueMove, redMove);
      oldTotalTime += Date.now() - t0;

      var gameNew = g.createGame(6);
      g.humanMove(gameNew, parseInt(openParts[0]), parseInt(openParts[1]));

      t0 = Date.now();
      var newMoves = playGame(gameNew, newBlueMove, redMove);
      newTotalTime += Date.now() - t0;

      var oldW = gameOld.winner === 'blue';
      var newW = gameNew.winner === 'blue';
      if (oldW) oldWins++;
      if (newW) newWins++;
      if (oldW && newW) both++;
      if (!oldW && !newW) neither++;
      if (oldW && !newW) oldOnly++;
      if (!oldW && newW) newOnly++;
      if (!newW) lostGames.push({opening: openingKey, variant: variant, moves: newMoves});
      gi++;

      if (gi % 20 === 0)
        console.log('  ' + gi + '/' + NUM_GAMES + ': old=' + oldWins + ' new=' + newWins + ' oldOnly=' + oldOnly + ' newOnly=' + newOnly);
    }
  }

  console.log('');
  console.log('Baseline:          ' + oldWins + '/' + NUM_GAMES + ' (' + (100 * oldWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('New:               ' + newWins + '/' + NUM_GAMES + ' (' + (100 * newWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('Both won:          ' + both);
  console.log('Neither won:       ' + neither);
  console.log('Old only:          ' + oldOnly);
  console.log('New only:          ' + newOnly);
  console.log('Net gain:          ' + (newOnly - oldOnly) + ' games (' + ((newOnly - oldOnly) / NUM_GAMES * 100).toFixed(1) + 'pp)');
  console.log('');
  console.log('Avg time/game old: ' + (oldTotalTime / (NUM_GAMES / 1000)).toFixed(0) + 'ms');
  console.log('Avg time/game new: ' + (newTotalTime / (NUM_GAMES / 1000)).toFixed(0) + 'ms');

  if (lostGames.length > 0) {
    console.log('');
    console.log('=== Lost games (' + lostGames.length + ') ===');
    for (var i = 0; i < lostGames.length; i++) {
      var lg = lostGames[i];
      console.log('  opening=' + lg.opening + ' var=' + lg.variant +
        ' moves=' + lg.moves.length + ' | ' + lg.moves.join(' '));
    }
  }

  newMod._free(newBoardPtr);
  newMod._free(newBlueLPtr);
  newMod._free(newBlueRPtr);
  oldMod._free(oldBoardPtr);
  oldMod._free(oldBlueLPtr);
  oldMod._free(oldBlueRPtr);
  oldMod._free(redBoardPtr);
  oldMod._free(redLPtr);
  oldMod._free(redRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
