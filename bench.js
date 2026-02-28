var g = require('./game.js');

// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeSeededWeakRed(p, rng) {
  return function(game) {
    if (rng() < p) {
      var moves = g.getOptimalRedMovesWithRecompute(game);
      if (moves.length > 0) return moves[0];
    }
    var unclaimed = g.getUnclaimed(game);
    return unclaimed[Math.floor(rng() * unclaimed.length)];
  };
}

function playGameWithBot(n, redFn, botModule) {
  var game = botModule.createGame(n);
  for (var turn = 0; turn < 122; turn++) {
    if (game.gameOver) break;
    if (game.turn === 'red') {
      var moveKey = redFn(game);
      if (!moveKey) break;
      var parts = moveKey.split(',');
      botModule.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
    }
    if (game.turn === 'blue' && !game.gameOver) {
      botModule.computerMove(game);
    }
  }
  return game.winner === 'blue';
}

function pairedTest(botA, botB, p, numGames, baseSeed) {
  var aWins = 0, bWins = 0, bothWin = 0, bothLose = 0;
  var aNotB = 0, bNotA = 0;

  for (var i = 0; i < numGames; i++) {
    var seed = baseSeed + i;
    var rngA = mulberry32(seed);
    var rngB = mulberry32(seed);
    var redA = makeSeededWeakRed(p, rngA);
    var redB = makeSeededWeakRed(p, rngB);

    var winA = playGameWithBot(6, redA, botA);
    var winB = playGameWithBot(6, redB, botB);

    if (winA) aWins++;
    if (winB) bWins++;
    if (winA && winB) bothWin++;
    if (!winA && !winB) bothLose++;
    if (winA && !winB) aNotB++;
    if (!winA && winB) bNotA++;
  }

  return { aWins: aWins, bWins: bWins, bothWin: bothWin, bothLose: bothLose, aNotB: aNotB, bNotA: bNotA, games: numGames };
}

function runBench(botA, botB, labelA, labelB, numGames) {
  numGames = numGames || 200;
  var baseSeed = 42;
  var opponents = [0.5, 0.7, 0.8, 0.9, 1.0];
  var weights =   [0.1, 0.2, 0.25, 0.35, 0.1];

  console.log('=== Paired Benchmark: ' + labelA + ' vs ' + labelB + ' (' + numGames + ' games/opponent) ===\n');

  var compositeA = 0, compositeB = 0;
  for (var oi = 0; oi < opponents.length; oi++) {
    var p = opponents[oi];
    var t0 = Date.now();
    var r = pairedTest(botA, botB, p, numGames, baseSeed + oi * 10000);
    var ms = Date.now() - t0;

    var pctA = (r.aWins / r.games * 100).toFixed(1);
    var pctB = (r.bWins / r.games * 100).toFixed(1);
    var diff = ((r.aWins - r.bWins) / r.games * 100).toFixed(1);

    console.log('weak-' + p + ': ' + labelA + '=' + pctA + '% ' + labelB + '=' + pctB + '% diff=' + (diff > 0 ? '+' : '') + diff + 'pp');
    console.log('  A-not-B=' + r.aNotB + ' B-not-A=' + r.bNotA + ' both-win=' + r.bothWin + ' both-lose=' + r.bothLose + ' (' + ms + 'ms)');

    compositeA += (r.aWins / r.games) * weights[oi];
    compositeB += (r.bWins / r.games) * weights[oi];
  }

  console.log('\nComposite: ' + labelA + '=' + (compositeA * 100).toFixed(1) + '% ' + labelB + '=' + (compositeB * 100).toFixed(1) + '% diff=' + ((compositeA - compositeB) * 100 > 0 ? '+' : '') + ((compositeA - compositeB) * 100).toFixed(1) + 'pp');
}

// --- Main ---

var botA = g;
var labelA = 'NEW';
var labelB = 'OLD';

var botBPath = process.argv[2] || '/tmp/game_old.js';
var botB;
try {
  botB = require(botBPath);
} catch(e) {
  console.log('Usage: node bench.js [path-to-old-game.js]');
  console.log('Default: /tmp/game_old.js');
  console.log('Error: ' + e.message);
  process.exit(1);
}

var numGames = parseInt(process.argv[3]) || 200;
runBench(botA, botB, labelA, labelB, numGames);
