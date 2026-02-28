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

function makeWasmMover(mod, boardPtr, blueLPtr, blueRPtr, computerMove) {
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

async function main() {
  // Load new alpha-beta WASM
  var NewBot = require('./bridgit_bot.js');
  var newMod = await NewBot();
  var newBoardPtr = newMod._malloc(61);
  var newBlueLPtr = newMod._malloc(61);
  var newBlueRPtr = newMod._malloc(61);
  var newComputerMove = newMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  newMod.cwrap('wasm_init', null, [])();
  newMod.cwrap('wasm_set_time_limit', null, ['number'])(1200);
  var newMove = makeWasmMover(newMod, newBoardPtr, newBlueLPtr, newBlueRPtr, newComputerMove);

  // Load old beam-search WASM
  var OldBot = require('./old_bridgit_bot.js');
  var oldMod = await OldBot();
  var oldBoardPtr = oldMod._malloc(61);
  var oldBlueLPtr = oldMod._malloc(61);
  var oldBlueRPtr = oldMod._malloc(61);
  var oldComputerMove = oldMod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
  oldMod.cwrap('wasm_set_depth', null, ['number'])(6);
  oldMod.cwrap('wasm_set_base_widths', null, ['number', 'number', 'number', 'number'])(40, 8, 10, 8);
  oldMod.cwrap('wasm_set_widths', null, ['number', 'number'])(8, 6);
  var oldMove = makeWasmMover(oldMod, oldBoardPtr, oldBlueLPtr, oldBlueRPtr, oldComputerMove);

  var NUM_GAMES = parseInt(process.argv[2]) || 200;

  console.log('Paired: Old 6-ply beam (40x8x10x8+8x6) vs New alpha-beta (' + NUM_GAMES + ' games vs weakRed-0.9)');

  var oldWins = 0, newWins = 0, both = 0, neither = 0, oldOnly = 0, newOnly = 0;
  var newTotalTime = 0, newTotalMoves = 0;
  var oldTotalTime = 0, oldTotalMoves = 0;

  for (var gi = 0; gi < NUM_GAMES; gi++) {
    var rng1 = mulberry32(gi + 1);
    var rng2 = mulberry32(gi + 1);

    // Old beam search 6-ply
    var gameOld = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (gameOld.gameOver) break;
      if (gameOld.turn === 'red') {
        var unclaimed = g.getUnclaimed(gameOld);
        var optimal = g.getOptimalRedMoves(gameOld);
        var move;
        if (optimal.length > 0 && rng1() < 0.9)
          move = optimal[Math.floor(rng1() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng1() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(gameOld, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        var t0 = Date.now();
        oldMove(gameOld);
        oldTotalTime += Date.now() - t0;
        oldTotalMoves++;
      }
    }

    // New alpha-beta
    var gameNew = g.createGame(6);
    for (var turn = 0; turn < 122; turn++) {
      if (gameNew.gameOver) break;
      if (gameNew.turn === 'red') {
        var unclaimed = g.getUnclaimed(gameNew);
        var optimal = g.getOptimalRedMoves(gameNew);
        var move;
        if (optimal.length > 0 && rng2() < 0.9)
          move = optimal[Math.floor(rng2() * optimal.length)];
        else {
          if (unclaimed.length === 0) break;
          move = unclaimed[Math.floor(rng2() * unclaimed.length)];
        }
        var parts = move.split(',');
        g.humanMove(gameNew, parseInt(parts[0]), parseInt(parts[1]));
      } else {
        var t0 = Date.now();
        newMove(gameNew);
        newTotalTime += Date.now() - t0;
        newTotalMoves++;
      }
    }

    var oldW = gameOld.winner === 'blue';
    var newW = gameNew.winner === 'blue';
    if (oldW) oldWins++;
    if (newW) newWins++;
    if (oldW && newW) both++;
    if (!oldW && !newW) neither++;
    if (oldW && !newW) oldOnly++;
    if (!oldW && newW) newOnly++;

    if ((gi + 1) % 10 === 0)
      console.log('  ' + (gi + 1) + '/' + NUM_GAMES + ': old=' + oldWins + ' new=' + newWins + ' oldOnly=' + oldOnly + ' newOnly=' + newOnly);
  }

  console.log('');
  console.log('Old 6-ply beam:    ' + oldWins + '/' + NUM_GAMES + ' (' + (100 * oldWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('New alpha-beta:    ' + newWins + '/' + NUM_GAMES + ' (' + (100 * newWins / NUM_GAMES).toFixed(1) + '%)');
  console.log('Both won:          ' + both);
  console.log('Neither won:       ' + neither);
  console.log('Old only:          ' + oldOnly);
  console.log('New only:          ' + newOnly);
  console.log('Net gain:          ' + (newOnly - oldOnly) + ' games (' + ((newOnly - oldOnly) / NUM_GAMES * 100).toFixed(1) + 'pp)');
  console.log('');
  console.log('Avg time/move old: ' + (oldTotalTime / oldTotalMoves).toFixed(1) + 'ms');
  console.log('Avg time/move new: ' + (newTotalTime / newTotalMoves).toFixed(1) + 'ms');

  newMod._free(newBoardPtr);
  newMod._free(newBlueLPtr);
  newMod._free(newBlueRPtr);
  oldMod._free(oldBoardPtr);
  oldMod._free(oldBlueLPtr);
  oldMod._free(oldBlueRPtr);
}

main().catch(function(e) { console.error(e); process.exit(1); });
