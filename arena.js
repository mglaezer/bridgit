var g = require('./game.js');

// --- Red opponents ---

function randomRed(game) {
  var unclaimed = g.getUnclaimed(game);
  return unclaimed[Math.floor(Math.random() * unclaimed.length)];
}

function optimalRed(game) {
  var moves = g.getOptimalRedMovesWithRecompute(game);
  if (moves.length > 0) return moves[0];
  return randomRed(game);
}

function weakRed(p) {
  return function(game) {
    return Math.random() < p ? optimalRed(game) : randomRed(game);
  };
}

// Focused Red: always picks the crossing that minimizes Red's distance to win
function focusedRed(game) {
  var n = game.n;
  var unclaimed = g.getUnclaimed(game);
  if (unclaimed.length === 0) return null;
  var bestKey = unclaimed[0];
  var bestDist = Infinity;
  for (var i = 0; i < unclaimed.length; i++) {
    game.board.set(unclaimed[i], 'red');
    var d = g.redDistanceToWin(n, game.board);
    game.board.delete(unclaimed[i]);
    if (d < bestDist) {
      bestDist = d;
      bestKey = unclaimed[i];
    }
  }
  return bestKey;
}

// Focused Red that sometimes blunders
function focusedWeakRed(p) {
  return function(game) {
    return Math.random() < p ? focusedRed(game) : randomRed(game);
  };
}

// --- Strategy helpers ---

function onPathCrossings(n, board, player) {
  var distFn = player === 'blue' ? g.blueDistanceToWin : g.redDistanceToWin;
  var currentDist = distFn(n, board);
  var result = [];
  var crossings = g.allPlayableCrossings(n);
  for (var i = 0; i < crossings.length; i++) {
    var ck = g.k(crossings[i][0], crossings[i][1]);
    if (board.has(ck)) continue;
    board.set(ck, player);
    if (distFn(n, board) < currentDist) result.push(ck);
    board.delete(ck);
  }
  return result;
}

// --- Strategy factory ---

function makeStrategy(opts) {
  var filterOnPath = !!opts.onPathFilter;
  var useRedDist = !!opts.useRedDist;
  var centerBias = opts.centerBias || 0;
  var depth2TopK = opts.depth2TopK || 0;
  var adaptive = !!opts.adaptive;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    if (filterOnPath && candidates.length > 5) {
      var blueOnPath = onPathCrossings(n, game.board, 'blue');
      var redOnPath = useRedDist ? onPathCrossings(n, game.board, 'red') : [];
      var combined = new Set();
      for (var i = 0; i < blueOnPath.length; i++) combined.add(blueOnPath[i]);
      for (var i = 0; i < redOnPath.length; i++) combined.add(redOnPath[i]);
      var filtered = [];
      for (var i = 0; i < candidates.length; i++) {
        if (combined.has(candidates[i])) filtered.push(candidates[i]);
      }
      if (filtered.length > 0) candidates = filtered;
    }

    var blueW = 1, redW = useRedDist ? 1 : 0;
    if (adaptive) {
      var curBlueDist = g.blueDistanceToWin(n, game.board);
      var curRedDist = g.redDistanceToWin(n, game.board);
      if (curRedDist <= 2) { blueW = 1; redW = 3; }
      else if (curBlueDist <= 2) { blueW = 3; redW = 1; }
      else { blueW = 1; redW = 1; }
    }

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');

      var baseBlueDist = g.blueDistanceToWin(n, game.board);
      var baseRedDist = useRedDist || adaptive ? g.redDistanceToWin(n, game.board) : 0;

      var evals = [];
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        game.board.set(unclaimed[j], 'red');
        var bd = g.blueDistanceToWin(n, game.board);
        var rd = (useRedDist || adaptive) ? g.redDistanceToWin(n, game.board) : 0;
        evals.push({ idx: j, bd: bd, rd: rd });
        game.board.delete(unclaimed[j]);
      }

      if (depth2TopK > 0 && evals.length > 0) {
        evals.sort(function(a, b) { return b.bd - a.bd; });
        var kk = Math.min(depth2TopK, evals.length);
        for (var t = 0; t < kk; t++) {
          var ji = evals[t].idx;
          game.board.set(unclaimed[ji], 'red');
          var bestCounter = Infinity;
          var bestCounterRd = 0;
          for (var m = 0; m < unclaimed.length; m++) {
            if (unclaimed[m] === candidates[i] || unclaimed[m] === unclaimed[ji]) continue;
            game.board.set(unclaimed[m], 'blue');
            var dd = g.blueDistanceToWin(n, game.board);
            if (dd < bestCounter) {
              bestCounter = dd;
              bestCounterRd = (useRedDist || adaptive) ? g.redDistanceToWin(n, game.board) : 0;
            }
            game.board.delete(unclaimed[m]);
          }
          if (bestCounter < Infinity) {
            evals[t].bd = bestCounter;
            evals[t].rd = bestCounterRd;
          }
          game.board.delete(unclaimed[ji]);
        }
      }

      var worstBlueDist = baseBlueDist;
      var sumBlueDist = 0;
      var worstRedDist = baseRedDist;
      var sumRedDist = 0;
      for (var e = 0; e < evals.length; e++) {
        if (evals[e].bd > worstBlueDist) worstBlueDist = evals[e].bd;
        sumBlueDist += evals[e].bd;
        if (evals[e].rd < worstRedDist) worstRedDist = evals[e].rd;
        sumRedDist += evals[e].rd;
      }
      var avgBlueDist = evals.length > 0 ? sumBlueDist / evals.length : baseBlueDist;
      var avgRedDist = evals.length > 0 ? sumRedDist / evals.length : baseRedDist;

      game.board.delete(candidates[i]);

      var score;
      if (opts.avgOnly) {
        score = -(blueW * avgBlueDist * 100) + (redW * avgRedDist * 100);
      } else if (opts.redHeavy) {
        score = -(blueW * worstBlueDist * 50 + blueW * avgBlueDist * 10)
              + (redW * worstRedDist * 200 + redW * avgRedDist * 20);
      } else if (opts.blueHeavy) {
        score = -(blueW * worstBlueDist * 200 + blueW * avgBlueDist * 20)
              + (redW * worstRedDist * 50 + redW * avgRedDist * 10);
      } else {
        score = -(blueW * worstBlueDist * 100 + blueW * avgBlueDist * 10)
              + (redW * worstRedDist * 100 + redW * avgRedDist * 10);
      }

      if (centerBias > 0) {
        var parts = candidates[i].split(',');
        var cr = parseInt(parts[0]);
        score -= centerBias * Math.abs(cr - n) / n;
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }

    return bestKey;
  };
}

// --- Game execution ---

function playGame(n, redFn, blueFn) {
  var game = g.createGame(n);
  var maxMoves = 61;

  for (var turn = 0; turn < maxMoves * 2; turn++) {
    if (game.gameOver) break;

    if (game.turn === 'red') {
      var moveKey = redFn(game);
      if (!moveKey) break;
      var parts = moveKey.split(',');
      g.humanMove(game, parseInt(parts[0]), parseInt(parts[1]));
    }

    if (game.turn === 'blue' && !game.gameOver) {
      var candidates = g.getCandidates(game);
      var unclaimed = g.getUnclaimed(game);

      var moveKey;
      if (candidates.length <= 1) {
        moveKey = candidates[0];
      } else {
        moveKey = blueFn(game, candidates, unclaimed);
      }

      if (!moveKey) break;
      game.board.set(moveKey, 'blue');
      game.moveCount++;

      var blueClaimed = new Set();
      game.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.add(kk); });
      var result = g.checkWin(blueClaimed, 'blue', n);
      if (result.won) {
        game.gameOver = true;
        game.winner = 'blue';
        game.winPath = result.path;
      } else {
        game.turn = 'red';
      }
    }
  }

  return { winner: game.winner, moves: game.moveCount };
}

function runMatchup(n, redFn, blueFn, numGames) {
  var blueWins = 0, totalMoves = 0, blueWinMoves = 0;
  for (var i = 0; i < numGames; i++) {
    var result = playGame(n, redFn, blueFn);
    if (result.winner === 'blue') {
      blueWins++;
      blueWinMoves += result.moves;
    }
    totalMoves += result.moves;
  }
  return {
    games: numGames,
    blueWins: blueWins,
    winRate: blueWins / numGames,
    avgMovesWin: blueWins > 0 ? (blueWinMoves / blueWins).toFixed(1) : '-',
    avgMoves: (totalMoves / numGames).toFixed(1)
  };
}

// --- Strategies ---

// Simple eval: no minimax, just direct distance after claiming
function simpleStrategy(opts) {
  var useRedDist = !!opts.useRedDist;
  var filterOnPath = !!opts.onPathFilter;
  var dualBonus = opts.dualBonus || 0;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    var blueOnPath, redOnPath;
    if (filterOnPath || dualBonus > 0) {
      blueOnPath = new Set(onPathCrossings(n, game.board, 'blue'));
      redOnPath = useRedDist ? new Set(onPathCrossings(n, game.board, 'red')) : new Set();
      if (filterOnPath) {
        var filtered = [];
        for (var i = 0; i < candidates.length; i++) {
          if (blueOnPath.has(candidates[i]) || redOnPath.has(candidates[i])) filtered.push(candidates[i]);
        }
        if (filtered.length > 0) candidates = filtered;
      }
    }

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = useRedDist ? g.redDistanceToWin(n, game.board) : 0;
      game.board.delete(candidates[i]);

      var score = -bd * 100 + rd * 100;
      if (dualBonus > 0 && blueOnPath.has(candidates[i]) && redOnPath.has(candidates[i])) {
        score += dualBonus;
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Weighted simple strategy with configurable blue/red ratio
function weightedSimple(opts) {
  var filterOnPath = !!opts.onPathFilter;
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 100;
  var neighborBonus = opts.neighborBonus || 0;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    if (filterOnPath && candidates.length > 5) {
      var blueOnPath = onPathCrossings(n, game.board, 'blue');
      var redOnPath = onPathCrossings(n, game.board, 'red');
      var combined = new Set();
      for (var i = 0; i < blueOnPath.length; i++) combined.add(blueOnPath[i]);
      for (var i = 0; i < redOnPath.length; i++) combined.add(redOnPath[i]);
      var filtered = [];
      for (var i = 0; i < candidates.length; i++) {
        if (combined.has(candidates[i])) filtered.push(candidates[i]);
      }
      if (filtered.length > 0) candidates = filtered;
    }

    var bestScore = -Infinity;
    var bestKey = candidates[0];
    var preBlueDist = g.blueDistanceToWin(n, game.board);
    var preRedDist = g.redDistanceToWin(n, game.board);

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var score = -bd * bw + rd * rw;

      if (neighborBonus > 0) {
        var parts = candidates[i].split(',');
        var cr = parseInt(parts[0]), cc = parseInt(parts[1]);
        var neighbors = [[cr-2,cc],[cr+2,cc],[cr,cc-2],[cr,cc+2]];
        for (var j = 0; j < neighbors.length; j++) {
          var nk = g.k(neighbors[j][0], neighbors[j][1]);
          if (game.board.get(nk) === 'blue') { score += neighborBonus; break; }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Adaptive defense: boost Red weight when Red is close to winning
function adaptiveDefense(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var filterOnPath = !!opts.onPathFilter;
  var urgentRedW = opts.urgentRedWeight || rw * 2;
  var urgentThreshold = opts.urgentThreshold || 2;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    if (filterOnPath && candidates.length > 5) {
      var blueOnPath = onPathCrossings(n, game.board, 'blue');
      var redOnPath = onPathCrossings(n, game.board, 'red');
      var combined = new Set();
      for (var i = 0; i < blueOnPath.length; i++) combined.add(blueOnPath[i]);
      for (var i = 0; i < redOnPath.length; i++) combined.add(redOnPath[i]);
      var filtered = [];
      for (var i = 0; i < candidates.length; i++) {
        if (combined.has(candidates[i])) filtered.push(candidates[i]);
      }
      if (filtered.length > 0) candidates = filtered;
    }

    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var score = -bd * bw + rd * effRedW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Average-case depth-2: for each Blue move, sample Red responses, take average score
function avgCaseDepth2(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var urgentRedW = opts.urgentRedWeight || 400;
  var urgentThreshold = opts.urgentThreshold || 4;
  var sampleSize = opts.sampleSize || 10;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');

      var redResponses = [];
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        redResponses.push(unclaimed[j]);
      }

      var sampled;
      if (redResponses.length <= sampleSize) {
        sampled = redResponses;
      } else {
        sampled = [];
        var copy = redResponses.slice();
        for (var s = 0; s < sampleSize; s++) {
          var idx = Math.floor(Math.random() * copy.length);
          sampled.push(copy[idx]);
          copy[idx] = copy[copy.length - 1];
          copy.pop();
        }
      }

      var sumBd = 0, sumRd = 0;
      for (var j = 0; j < sampled.length; j++) {
        game.board.set(sampled[j], 'red');
        sumBd += g.blueDistanceToWin(n, game.board);
        sumRd += g.redDistanceToWin(n, game.board);
        game.board.delete(sampled[j]);
      }
      var avgBd = sampled.length > 0 ? sumBd / sampled.length : g.blueDistanceToWin(n, game.board);
      var avgRd = sampled.length > 0 ? sumRd / sampled.length : g.redDistanceToWin(n, game.board);

      game.board.delete(candidates[i]);

      var score = -avgBd * bw + avgRd * effRedW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Threat-count strategy: prefer moves that create multiple ways to advance
function threatCount(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var urgentRedW = opts.urgentRedWeight || 400;
  var urgentThreshold = opts.urgentThreshold || 4;
  var threatW = opts.threatWeight || 50;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);

      var blueThreats = 0;
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        game.board.set(unclaimed[j], 'blue');
        if (g.blueDistanceToWin(n, game.board) < bd) blueThreats++;
        game.board.delete(unclaimed[j]);
      }

      game.board.delete(candidates[i]);

      var score = -bd * bw + rd * effRedW + blueThreats * threatW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Delta scoring: score by improvement, not absolute position
function deltaStrategy(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var urgentRedW = opts.urgentRedWeight || 400;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preBlueDist = g.blueDistanceToWin(n, game.board);
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var blueImprove = preBlueDist - bd;
      var redWorsen = rd - preRedDist;
      var score = blueImprove * bw + redWorsen * effRedW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Red-response strategy: for each Blue move, check Red's best reply, then score
function redResponse(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var urgentRedW = opts.urgentRedWeight || 400;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');

      var worstBd = 0;
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        game.board.set(unclaimed[j], 'red');
        var bd = g.blueDistanceToWin(n, game.board);
        if (bd > worstBd) worstBd = bd;
        game.board.delete(unclaimed[j]);
      }

      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var score = -worstBd * bw + rd * effRedW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Denial strategy: score includes how much Red would benefit from each crossing
function denialStrategy(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var dw = opts.denialWeight || 300;
  var urgentRedW = opts.urgentRedWeight || 400;
  var urgentDenialW = opts.urgentDenialWeight || dw * 2;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var urgent = preRedDist <= urgentThreshold;
    var effRedW = urgent ? urgentRedW : rw;
    var effDenialW = urgent ? urgentDenialW : dw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var denial = preRedDist - rdIfRed;

      var score = -bd * bw + rd * effRedW + denial * effDenialW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Continuous denial: scales denial weight inversely with Red's distance
function continuousDenial(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var baseDenialW = opts.baseDenialWeight || 700;
  var maxDist = opts.maxDist || 6;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var scale = Math.max(0, maxDist - preRedDist + 1) / maxDist;
    var effDenialW = baseDenialW * (1 + scale * 2);
    var effRedW = rw * (1 + scale);

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var denial = preRedDist - rdIfRed;
      var score = -bd * bw + rd * effRedW + denial * effDenialW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Denial + threat counting: measure denial AND how many advances Blue has after claiming
function denialThreats(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var dw = opts.denialWeight || 500;
  var tw = opts.threatWeight || 30;
  var urgentRedW = opts.urgentRedWeight || 300;
  var urgentDenialW = opts.urgentDenialWeight || 1000;
  var urgentThreshold = opts.urgentThreshold || 3;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var urgent = preRedDist <= urgentThreshold;
    var effRedW = urgent ? urgentRedW : rw;
    var effDenialW = urgent ? urgentDenialW : dw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);

      var threats = 0;
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        game.board.set(unclaimed[j], 'blue');
        if (g.blueDistanceToWin(n, game.board) < bd) threats++;
        game.board.delete(unclaimed[j]);
      }

      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var denial = preRedDist - rdIfRed;
      var score = -bd * bw + rd * effRedW + denial * effDenialW + threats * tw;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Denial + sampled depth-2: after evaluating denial, sample a few Red responses for top-K candidates
function denialDepth2(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var dw = opts.denialWeight || 500;
  var urgentRedW = opts.urgentRedWeight || 300;
  var urgentDenialW = opts.urgentDenialWeight || 1000;
  var urgentThreshold = opts.urgentThreshold || 3;
  var sampleSize = opts.sampleSize || 8;
  var topK = opts.topK || 5;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var urgent = preRedDist <= urgentThreshold;
    var effRedW = urgent ? urgentRedW : rw;
    var effDenialW = urgent ? urgentDenialW : dw;

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var denial = preRedDist - rdIfRed;
      var score = -bd * bw + rd * effRedW + denial * effDenialW;
      scored.push({ key: candidates[i], score: score, bd: bd });
    }

    scored.sort(function(a, b) { return b.score - a.score; });
    var k = Math.min(topK, scored.length);

    for (var i = 0; i < k; i++) {
      game.board.set(scored[i].key, 'blue');

      var redResponses = [];
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === scored[i].key) continue;
        redResponses.push(unclaimed[j]);
      }
      var sampled;
      if (redResponses.length <= sampleSize) {
        sampled = redResponses;
      } else {
        sampled = [];
        var copy = redResponses.slice();
        for (var s = 0; s < sampleSize; s++) {
          var idx = Math.floor(Math.random() * copy.length);
          sampled.push(copy[idx]);
          copy[idx] = copy[copy.length - 1];
          copy.pop();
        }
      }

      var sumBd = 0;
      for (var j = 0; j < sampled.length; j++) {
        game.board.set(sampled[j], 'red');
        sumBd += g.blueDistanceToWin(n, game.board);
        game.board.delete(sampled[j]);
      }
      var avgBd = sampled.length > 0 ? sumBd / sampled.length : scored[i].bd;

      game.board.delete(scored[i].key);
      scored[i].score += -(avgBd - scored[i].bd) * bw * 0.5;
    }

    scored.sort(function(a, b) { return b.score - a.score; });
    return scored[0].key;
  };
}

// Bidirectional denial: also consider how much Blue needs each crossing
function biDenial(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var rdw = opts.redDenialWeight || 500;
  var bdw = opts.blueDenialWeight || 200;
  var urgentRedW = opts.urgentRedWeight || 300;
  var urgentRDW = opts.urgentRedDenialWeight || 1000;
  var urgentThreshold = opts.urgentThreshold || 3;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var preBlueDist = g.blueDistanceToWin(n, game.board);
    var urgent = preRedDist <= urgentThreshold;
    var effRedW = urgent ? urgentRedW : rw;
    var effRDW = urgent ? urgentRDW : rdw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      var bdIfRed = g.blueDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var redDenial = preRedDist - rdIfRed;
      var blueDenial = bdIfRed - preBlueDist;

      var score = -bd * bw + rd * effRedW + redDenial * effRDW + blueDenial * bdw;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Continuous bidirectional denial
function contBiDenial(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var baseDenialW = opts.baseDenialWeight || 500;
  var blueDenialW = opts.blueDenialWeight || 200;
  var maxDist = opts.maxDist || 5;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var preBlueDist = g.blueDistanceToWin(n, game.board);
    var scale = Math.max(0, maxDist - preRedDist + 1) / maxDist;
    var effDenialW = baseDenialW * (1 + scale * 2);
    var effRedW = rw * (1 + scale);

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      var bdIfRed = g.blueDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var redDenial = preRedDist - rdIfRed;
      var blueDenial = bdIfRed - preBlueDist;

      var score = -bd * bw + rd * effRedW + redDenial * effDenialW + blueDenial * blueDenialW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Minimax depth-2 with move ordering
function minimaxStrategy(opts) {
  var topBlue = opts.topBlue || 12;
  var topRedCount = opts.topRed || 8;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * 100 + g.redDistanceToWin(n, board) * 200;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });
    var topR = Math.min(topRedCount, redMoves.length);

    var bestScore = -Infinity;
    var bestKey = scored[0].key;
    var topB = Math.min(topBlue, scored.length);
    for (var i = 0; i < topB; i++) {
      game.board.set(scored[i].key, 'blue');

      var worstScore = Infinity;
      for (var j = 0; j < topR; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');
        var s = evaluate(game.board);
        if (s < worstScore) worstScore = s;
        game.board.delete(redMoves[j].key);
      }

      game.board.delete(scored[i].key);

      var finalScore = worstScore === Infinity ? scored[i].score : worstScore;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// Minimax with configurable eval weights
function minimaxWeighted(opts) {
  var topBlue = opts.topBlue || 10;
  var topRedCount = opts.topRed || 6;
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });
    var topR = Math.min(topRedCount, redMoves.length);

    var bestScore = -Infinity;
    var bestKey = scored[0].key;
    var topB = Math.min(topBlue, scored.length);
    for (var i = 0; i < topB; i++) {
      game.board.set(scored[i].key, 'blue');

      var worstScore = Infinity;
      for (var j = 0; j < topR; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');
        var s = evaluate(game.board);
        if (s < worstScore) worstScore = s;
        game.board.delete(redMoves[j].key);
      }

      game.board.delete(scored[i].key);

      var finalScore = worstScore === Infinity ? scored[i].score : worstScore;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// Adaptive minimax: heuristic early, real minimax late
function adaptiveMinimax(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var mmThreshold = opts.mmThreshold || 25;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    if (unclaimed.length > mmThreshold) {
      return scored[0].key;
    }

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });
    var topR = Math.min(unclaimed.length <= 15 ? unclaimed.length : 6, redMoves.length);

    var bestScore = -Infinity;
    var bestKey = scored[0].key;
    var topB = Math.min(10, scored.length);
    for (var i = 0; i < topB; i++) {
      game.board.set(scored[i].key, 'blue');

      var worstScore = Infinity;
      for (var j = 0; j < topR; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');
        var s = evaluate(game.board);
        if (s < worstScore) worstScore = s;
        game.board.delete(redMoves[j].key);
      }

      game.board.delete(scored[i].key);

      var finalScore = worstScore === Infinity ? scored[i].score : worstScore;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// Graduated minimax: always look ahead, vary depth based on game phase
function graduatedMinimax(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var topR;
    if (unclaimed.length > 25) topR = 3;
    else if (unclaimed.length > 15) topR = 5;
    else topR = Math.min(unclaimed.length, 10);

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });
    topR = Math.min(topR, redMoves.length);

    var bestScore = -Infinity;
    var bestKey = scored[0].key;
    var topB = Math.min(10, scored.length);
    for (var i = 0; i < topB; i++) {
      game.board.set(scored[i].key, 'blue');

      var worstScore = Infinity;
      for (var j = 0; j < topR; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');
        var s = evaluate(game.board);
        if (s < worstScore) worstScore = s;
        game.board.delete(redMoves[j].key);
      }

      game.board.delete(scored[i].key);

      var finalScore = worstScore === Infinity ? scored[i].score : worstScore;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// 3-ply expectimax: Blue → avg(Red top-K) → Blue best counter
function expectimax3(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var topB = opts.topBlue || 8;
  var topR = opts.topRed || 5;
  var topC = opts.topCounter || 5;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });

    var nR = Math.min(topR, redMoves.length);
    var nB = Math.min(topB, scored.length);
    var nC = Math.min(topC, scored.length);
    var bestScore = -Infinity;
    var bestKey = scored[0].key;

    for (var i = 0; i < nB; i++) {
      game.board.set(scored[i].key, 'blue');

      var sumScore = 0;
      var counted = 0;
      for (var j = 0; j < nR; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');

        var bestBlueCounter = -Infinity;
        for (var m = 0; m < nC; m++) {
          if (scored[m].key === scored[i].key || scored[m].key === redMoves[j].key) continue;
          game.board.set(scored[m].key, 'blue');
          var s3 = evaluate(game.board);
          if (s3 > bestBlueCounter) bestBlueCounter = s3;
          game.board.delete(scored[m].key);
        }

        game.board.delete(redMoves[j].key);
        sumScore += bestBlueCounter > -Infinity ? bestBlueCounter : evaluate(game.board);
        counted++;
      }

      game.board.delete(scored[i].key);

      var finalScore = counted > 0 ? sumScore / counted : scored[i].score;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// 4-ply: Blue → avg(Red) → max(Blue) → avg(Red) → eval
function expectimax4(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var topB1 = opts.topBlue1 || 8;
  var topR1 = opts.topRed1 || 4;
  var topB2 = opts.topBlue2 || 4;
  var topR2 = opts.topRed2 || 3;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });

    var nB1 = Math.min(topB1, scored.length);
    var nR1 = Math.min(topR1, redMoves.length);
    var nB2 = Math.min(topB2, scored.length);
    var nR2 = Math.min(topR2, redMoves.length);
    var bestScore = -Infinity;
    var bestKey = scored[0].key;

    for (var i = 0; i < nB1; i++) {
      game.board.set(scored[i].key, 'blue');

      var sumR1 = 0;
      var cntR1 = 0;
      for (var j = 0; j < nR1; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');

        var bestB2 = -Infinity;
        for (var m = 0; m < nB2; m++) {
          if (scored[m].key === scored[i].key || scored[m].key === redMoves[j].key) continue;
          game.board.set(scored[m].key, 'blue');

          var sumR2 = 0;
          var cntR2 = 0;
          for (var r2 = 0; r2 < nR2; r2++) {
            if (redMoves[r2].key === scored[i].key || redMoves[r2].key === redMoves[j].key || redMoves[r2].key === scored[m].key) continue;
            game.board.set(redMoves[r2].key, 'red');
            sumR2 += evaluate(game.board);
            cntR2++;
            game.board.delete(redMoves[r2].key);
          }

          game.board.delete(scored[m].key);
          var ply4Score = cntR2 > 0 ? sumR2 / cntR2 : evaluate(game.board);
          if (ply4Score > bestB2) bestB2 = ply4Score;
        }

        game.board.delete(redMoves[j].key);
        sumR1 += bestB2 > -Infinity ? bestB2 : evaluate(game.board);
        cntR1++;
      }

      game.board.delete(scored[i].key);

      var finalScore = cntR1 > 0 ? sumR1 / cntR1 : scored[i].score;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// 4-ply minimax: Blue max → Red min → Blue max → Red min → eval
function minimax4(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var topB1 = opts.topBlue1 || 8;
  var topR1 = opts.topRed1 || 4;
  var topB2 = opts.topBlue2 || 4;
  var topR2 = opts.topRed2 || 3;

  return function(game, candidates, unclaimed) {
    var n = game.n;

    function evaluate(board) {
      return -g.blueDistanceToWin(n, board) * bw + g.redDistanceToWin(n, board) * rw;
    }

    var scored = [];
    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      scored.push({ key: candidates[i], score: evaluate(game.board) });
      game.board.delete(candidates[i]);
    }
    scored.sort(function(a, b) { return b.score - a.score; });

    var redMoves = [];
    for (var i = 0; i < unclaimed.length; i++) {
      game.board.set(unclaimed[i], 'red');
      redMoves.push({ key: unclaimed[i], score: evaluate(game.board) });
      game.board.delete(unclaimed[i]);
    }
    redMoves.sort(function(a, b) { return a.score - b.score; });

    var nB1 = Math.min(topB1, scored.length);
    var nR1 = Math.min(topR1, redMoves.length);
    var nB2 = Math.min(topB2, scored.length);
    var nR2 = Math.min(topR2, redMoves.length);
    var bestScore = -Infinity;
    var bestKey = scored[0].key;

    for (var i = 0; i < nB1; i++) {
      game.board.set(scored[i].key, 'blue');

      var worstR1 = Infinity;
      for (var j = 0; j < nR1; j++) {
        if (redMoves[j].key === scored[i].key) continue;
        game.board.set(redMoves[j].key, 'red');

        var bestB2 = -Infinity;
        for (var m = 0; m < nB2; m++) {
          if (scored[m].key === scored[i].key || scored[m].key === redMoves[j].key) continue;
          game.board.set(scored[m].key, 'blue');

          var worstR2 = Infinity;
          for (var r2 = 0; r2 < nR2; r2++) {
            if (redMoves[r2].key === scored[i].key || redMoves[r2].key === redMoves[j].key || redMoves[r2].key === scored[m].key) continue;
            game.board.set(redMoves[r2].key, 'red');
            var s = evaluate(game.board);
            if (s < worstR2) worstR2 = s;
            game.board.delete(redMoves[r2].key);
          }

          game.board.delete(scored[m].key);
          var ply3Score = worstR2 < Infinity ? worstR2 : evaluate(game.board);
          if (ply3Score > bestB2) bestB2 = ply3Score;
        }

        game.board.delete(redMoves[j].key);
        var ply2Score = bestB2 > -Infinity ? bestB2 : evaluate(game.board);
        if (ply2Score < worstR1) worstR1 = ply2Score;
      }

      game.board.delete(scored[i].key);

      var finalScore = worstR1 < Infinity ? worstR1 : scored[i].score;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestKey = scored[i].key;
      }
    }
    return bestKey;
  };
}

// Path-width eval: how many crossings lie on shortest paths (more = harder to block)
function pathWidthStrategy(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var bpw = opts.bluePathWidth || 20;
  var rpw = opts.redPathWidth || 20;
  var urgentRedW = opts.urgentRedWeight || rw * 2;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var preBlueDist = g.blueDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);

      var blueWidth = 0;
      var redWidth = 0;
      for (var j = 0; j < unclaimed.length; j++) {
        if (unclaimed[j] === candidates[i]) continue;
        game.board.set(unclaimed[j], 'blue');
        if (g.blueDistanceToWin(n, game.board) < bd) blueWidth++;
        game.board.delete(unclaimed[j]);
        game.board.set(unclaimed[j], 'red');
        if (g.redDistanceToWin(n, game.board) < rd) redWidth++;
        game.board.delete(unclaimed[j]);
      }

      game.board.delete(candidates[i]);

      var score = -bd * bw + rd * effRedW + blueWidth * bpw - redWidth * rpw;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Connectivity eval: count crossings adjacent to existing Blue chains
function connectivityStrategy(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var connW = opts.connWeight || 30;
  var urgentRedW = opts.urgentRedWeight || rw * 2;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var parts = candidates[i].split(',');
      var cr = parseInt(parts[0]), cc = parseInt(parts[1]);
      var blueNeighbors = 0;
      var neighbors = [[cr-2,cc],[cr+2,cc],[cr,cc-2],[cr,cc+2]];
      for (var j = 0; j < neighbors.length; j++) {
        var nk = g.k(neighbors[j][0], neighbors[j][1]);
        if (game.board.get(nk) === 'blue') blueNeighbors++;
      }

      var score = -bd * bw + rd * effRedW + blueNeighbors * connW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Monte Carlo: simulate random playouts from each candidate
function monteCarloStrategy(opts) {
  var numPlayouts = opts.numPlayouts || 20;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var bestWins = -1;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      var wins = 0;
      for (var p = 0; p < numPlayouts; p++) {
        var simBoard = new Map(game.board);
        simBoard.set(candidates[i], 'blue');

        var remaining = [];
        for (var j = 0; j < unclaimed.length; j++) {
          if (unclaimed[j] !== candidates[i]) remaining.push(unclaimed[j]);
        }

        for (var r = remaining.length - 1; r > 0; r--) {
          var swap = Math.floor(Math.random() * (r + 1));
          var tmp = remaining[r]; remaining[r] = remaining[swap]; remaining[swap] = tmp;
        }

        var turn = 'red';
        for (var r = 0; r < remaining.length; r++) {
          simBoard.set(remaining[r], turn);
          turn = turn === 'red' ? 'blue' : 'red';
        }

        if (g.blueDistanceToWin(n, simBoard) === 0) wins++;
      }
      if (wins > bestWins) {
        bestWins = wins;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Steal Red's exchange moves: prioritize crossings Red's optimal strategy wants
function stealStrategy(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 200;
  var stealW = opts.stealWeight || 300;
  var urgentRedW = opts.urgentRedWeight || rw * 2;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var effRedW = preRedDist <= urgentThreshold ? urgentRedW : rw;

    var redOptimal = new Set(g.getOptimalRedMovesWithRecompute(game));

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      var score = -bd * bw + rd * effRedW;
      if (redOptimal.has(candidates[i])) score += stealW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

// Combined: steal + denial
function stealDenial(opts) {
  var bw = opts.blueWeight || 100;
  var rw = opts.redWeight || 150;
  var stealW = opts.stealWeight || 500;
  var dw = opts.denialWeight || 300;
  var urgentRedW = opts.urgentRedWeight || 300;
  var urgentDenialW = opts.urgentDenialWeight || 600;
  var urgentThreshold = opts.urgentThreshold || 4;

  return function(game, candidates, unclaimed) {
    var n = game.n;
    var preRedDist = g.redDistanceToWin(n, game.board);
    var urgent = preRedDist <= urgentThreshold;
    var effRedW = urgent ? urgentRedW : rw;
    var effDenialW = urgent ? urgentDenialW : dw;

    var redOptimal = new Set(g.getOptimalRedMovesWithRecompute(game));

    var bestScore = -Infinity;
    var bestKey = candidates[0];

    for (var i = 0; i < candidates.length; i++) {
      game.board.set(candidates[i], 'blue');
      var bd = g.blueDistanceToWin(n, game.board);
      var rd = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);

      game.board.set(candidates[i], 'red');
      var rdIfRed = g.redDistanceToWin(n, game.board);
      game.board.delete(candidates[i]);
      var denial = preRedDist - rdIfRed;

      var score = -bd * bw + rd * effRedW + denial * effDenialW;
      if (redOptimal.has(candidates[i])) score += stealW;
      if (score > bestScore) {
        bestScore = score;
        bestKey = candidates[i];
      }
    }
    return bestKey;
  };
}

var strategies = {
  'D-thr4': adaptiveDefense({ blueWeight: 100, redWeight: 200, urgentRedWeight: 400, urgentThreshold: 4 }),
  'st-r150': stealStrategy({ blueWeight: 100, redWeight: 150, stealWeight: 500, urgentRedWeight: 300, urgentThreshold: 4 }),
  'sd-a': stealDenial({ blueWeight: 100, redWeight: 150, stealWeight: 500, denialWeight: 300, urgentRedWeight: 300, urgentDenialWeight: 600, urgentThreshold: 4 }),
  'sd-b': stealDenial({ blueWeight: 100, redWeight: 150, stealWeight: 300, denialWeight: 500, urgentRedWeight: 300, urgentDenialWeight: 1000, urgentThreshold: 4 }),
  'sd-c': stealDenial({ blueWeight: 100, redWeight: 200, stealWeight: 500, denialWeight: 300, urgentRedWeight: 400, urgentDenialWeight: 600, urgentThreshold: 4 }),
  'sd-d': stealDenial({ blueWeight: 100, redWeight: 150, stealWeight: 500, denialWeight: 300, urgentRedWeight: 300, urgentDenialWeight: 600, urgentThreshold: 3 }),
};

var opponents = {
  'weak-0.7': weakRed(0.7),
  'weak-0.8': weakRed(0.8),
  'weak-0.9': weakRed(0.9),
};

// --- Tournament ---

function pad(s, len) { while (s.length < len) s += ' '; return s; }

function runTournament(numGames) {
  numGames = numGames || 100;
  console.log('=== Arena: ' + numGames + ' games per matchup ===\n');

  var stratNames = Object.keys(strategies);
  var oppNames = Object.keys(opponents);
  var results = [];

  for (var si = 0; si < stratNames.length; si++) {
    for (var oi = 0; oi < oppNames.length; oi++) {
      var t0 = Date.now();
      var r = runMatchup(6, opponents[oppNames[oi]], strategies[stratNames[si]], numGames);
      var ms = Date.now() - t0;
      r.strategy = stratNames[si];
      r.opponent = oppNames[oi];
      results.push(r);
      console.log(
        pad(stratNames[si], 14) + ' vs ' + pad(oppNames[oi], 10) + ': ' +
        pad((r.winRate * 100).toFixed(1) + '%', 7) +
        '(' + r.blueWins + '/' + r.games + ')  ' +
        'avg-win: ' + pad(r.avgMovesWin + '', 6) +
        ms + 'ms'
      );
    }
    console.log('');
  }

  // Summary table
  console.log('\n=== Summary (sorted by composite score) ===\n');
  var weights = { 'random': 0.05, 'weak-0.5': 0.15, 'weak-0.7': 0.25, 'weak-0.8': 0.25, 'weak-0.9': 0.2, 'optimal': 0.1 };
  var composites = {};
  var byStrat = {};
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (!byStrat[r.strategy]) byStrat[r.strategy] = {};
    byStrat[r.strategy][r.opponent] = r.winRate;
    composites[r.strategy] = (composites[r.strategy] || 0) + r.winRate * (weights[r.opponent] || 0);
  }

  var ranked = Object.keys(composites).sort(function(a, b) { return composites[b] - composites[a]; });
  var oppCols = Object.keys(opponents);
  var header = pad('Strategy', 14);
  for (var i = 0; i < oppCols.length; i++) header += pad(oppCols[i].replace('weak-','w-'), 8);
  header += 'composite';
  console.log(header);
  console.log('-'.repeat(62));
  for (var i = 0; i < ranked.length; i++) {
    var s = ranked[i];
    var row = pad(s, 14);
    for (var j = 0; j < oppCols.length; j++) {
      row += pad(((byStrat[s][oppCols[j]] || 0) * 100).toFixed(0) + '%', 8);
    }
    row += (composites[s] * 100).toFixed(1);
    console.log(row);
  }
}

// --- Main ---

var numGames = 100;
if (process.argv[2]) numGames = parseInt(process.argv[2]);
runTournament(numGames);
