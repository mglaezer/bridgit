const N = 6;
const GRID = 2 * N + 1;

// --- Coordinate utilities ---

function cellType(r, c) {
  if (r % 2 === 0 && c % 2 === 1) return 'red-dot';
  if (r % 2 === 1 && c % 2 === 0) return 'blue-dot';
  if (r % 2 === 0 && c % 2 === 0) return 'edge-ee';
  return 'edge-oo';
}

function redDotToUnified(x, y) { return [2 * y, 2 * x + 1]; }
function blueDotToUnified(x, y) { return [2 * x + 1, 2 * y]; }

function unifiedToRedDot(r, c) { return [(c - 1) / 2, r / 2]; }
function unifiedToBlueDot(r, c) { return [(r - 1) / 2, c / 2]; }

function crossingEndpoints(r, c) {
  if (r % 2 === 0 && c % 2 === 0) {
    return {
      red: [[r, c - 1], [r, c + 1]],
      blue: [[r - 1, c], [r + 1, c]]
    };
  }
  return {
    red: [[r - 1, c], [r + 1, c]],
    blue: [[r, c - 1], [r, c + 1]]
  };
}

function inBounds(r, c) {
  return r >= 0 && r < GRID && c >= 0 && c < GRID;
}

function boundaryType(r, c, n) {
  var g = 2 * n;
  if (r % 2 !== 0 || c % 2 !== 0) return null;
  if (r === 0 && c >= 2 && c <= g - 2 && c % 2 === 0) return 'red';
  if (r === g && c >= 2 && c <= g - 2 && c % 2 === 0) return 'red';
  if (c === 0 && r >= 2 && r <= g - 2 && r % 2 === 0) return 'blue';
  if (c === g && r >= 2 && r <= g - 2 && r % 2 === 0) return 'blue';
  return null;
}

function isPlayable(r, c, n) {
  var g = 2 * n;
  if (r < 0 || r > g || c < 0 || c > g) return false;
  if (r % 2 === 1 && c % 2 === 1) {
    return r >= 1 && r <= g - 1 && c >= 1 && c <= g - 1;
  }
  if (r % 2 === 0 && c % 2 === 0) {
    return r >= 2 && r <= g - 2 && c >= 2 && c <= g - 2;
  }
  return false;
}

function allPlayableCrossings(n) {
  var result = [];
  var g = 2 * n;
  for (var r = 0; r <= g; r++) {
    for (var c = 0; c <= g; c++) {
      if (isPlayable(r, c, n)) result.push([r, c]);
    }
  }
  return result;
}

function allBoundaryEdges(n) {
  var red = [], blue = [];
  var g = 2 * n;
  for (var j = 1; j <= n - 1; j++) {
    red.push([0, 2 * j]);
    red.push([g, 2 * j]);
  }
  for (var i = 1; i <= n - 1; i++) {
    blue.push([2 * i, 0]);
    blue.push([2 * i, g]);
  }
  return { red: red, blue: blue };
}

function allRedCrossingEdges(n) {
  var result = [];
  var g = 2 * n;
  for (var r = 2; r <= g - 2; r += 2) {
    for (var c = 2; c <= g - 2; c += 2) {
      result.push([r, c]);
    }
  }
  for (var r = 1; r <= g - 1; r += 2) {
    for (var c = 1; c <= g - 1; c += 2) {
      result.push([r, c]);
    }
  }
  return result;
}

function allBlueCrossingEdges(n) {
  return allRedCrossingEdges(n);
}

// --- Union-Find ---

function createUF(n) {
  var parent = new Array(n);
  var rank = new Array(n);
  for (var i = 0; i < n; i++) { parent[i] = i; rank[i] = 0; }
  return { parent: parent, rank: rank, size: n };
}

function find(uf, x) {
  while (uf.parent[x] !== x) {
    uf.parent[x] = uf.parent[uf.parent[x]];
    x = uf.parent[x];
  }
  return x;
}

function union(uf, x, y) {
  var rx = find(uf, x), ry = find(uf, y);
  if (rx === ry) return false;
  if (uf.rank[rx] < uf.rank[ry]) { var t = rx; rx = ry; ry = t; }
  uf.parent[ry] = rx;
  if (uf.rank[rx] === uf.rank[ry]) uf.rank[rx]++;
  return true;
}

function connected(uf, x, y) { return find(uf, x) === find(uf, y); }

// --- Staircase tree ---

function buildStaircaseTree(cols, rows) {
  var edges = [];
  for (var x = 0; x < cols; x++) {
    edges.push([[x, 0], [x, 1]]);
  }
  for (var n = 1; n < cols; n++) {
    for (var k = 1; k <= n; k++) {
      edges.push([[n, k], [n, k + 1]]);
    }
    for (var k = 0; k < n; k++) {
      edges.push([[k, n + 1], [k + 1, n + 1]]);
    }
  }
  return edges;
}

function redDotSpaceEdgeToCrossing(from, to) {
  var x1 = from[0], y1 = from[1], x2 = to[0], y2 = to[1];
  if (x1 === x2) {
    var minY = Math.min(y1, y2);
    return [2 * minY + 1, 2 * x1 + 1];
  }
  var minX = Math.min(x1, x2);
  return [2 * y1, 2 * minX + 2];
}

function blueDotSpaceEdgeToCrossing(from, to) {
  var x1 = from[0], y1 = from[1], x2 = to[0], y2 = to[1];
  if (x1 === x2) {
    var minY = Math.min(y1, y2);
    return [2 * x1 + 1, 2 * minY + 1];
  }
  var minX = Math.min(x1, x2);
  return [2 * minX + 2, 2 * y1];
}

function k(r, c) { return r + ',' + c; }

function buildRedPartition(n) {
  var edges = buildStaircaseTree(n, n + 1);
  var L = new Set();
  var boundaryInTree = new Set();
  var bnd = allBoundaryEdges(n);
  var bndSet = new Set(bnd.red.map(function(e) { return k(e[0], e[1]); }));

  for (var i = 0; i < edges.length; i++) {
    var cr = redDotSpaceEdgeToCrossing(edges[i][0], edges[i][1]);
    var key = k(cr[0], cr[1]);
    if (bndSet.has(key)) {
      boundaryInTree.add(key);
    } else {
      L.add(key);
    }
  }

  var allCrossings = allRedCrossingEdges(n);
  var R = new Set();
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (!L.has(key)) R.add(key);
  }

  return { L: L, R: R };
}

function buildBluePartition(n) {
  var edges = buildStaircaseTree(n, n + 1);
  var L = new Set();
  var boundaryInTree = new Set();
  var bnd = allBoundaryEdges(n);
  var bndSet = new Set(bnd.blue.map(function(e) { return k(e[0], e[1]); }));

  for (var i = 0; i < edges.length; i++) {
    var cr = blueDotSpaceEdgeToCrossing(edges[i][0], edges[i][1]);
    var key = k(cr[0], cr[1]);
    if (bndSet.has(key)) {
      boundaryInTree.add(key);
    } else {
      L.add(key);
    }
  }

  var allCrossings = allBlueCrossingEdges(n);
  var R = new Set();
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (!L.has(key)) R.add(key);
  }

  return { L: L, R: R };
}

function recomputeRedPartition(n, board) {
  var bnd = allBoundaryEdges(n);
  var bndKeys = bnd.red.map(function(e) { return k(e[0], e[1]); });
  var numDots = (n + 1) * n;
  var uf = createUF(numDots);

  for (var i = 0; i < bndKeys.length; i++) {
    var parts = bndKeys[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).red;
    union(uf, redDotIndex(ep[0][0], ep[0][1], n), redDotIndex(ep[1][0], ep[1][1], n));
  }

  var allCrossings = allRedCrossingEdges(n);
  var available = [];
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (board.get(key) !== 'blue') available.push(key);
  }

  var L = new Set();
  var R = new Set();
  for (var i = 0; i < available.length; i++) {
    var parts = available[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).red;
    var a = redDotIndex(ep[0][0], ep[0][1], n);
    var b = redDotIndex(ep[1][0], ep[1][1], n);
    if (find(uf, a) !== find(uf, b)) {
      union(uf, a, b);
      L.add(available[i]);
    } else {
      R.add(available[i]);
    }
  }

  return { L: L, R: R };
}

function recomputeBluePartition(n, board) {
  var bnd = allBoundaryEdges(n);
  var bndKeys = bnd.blue.map(function(e) { return k(e[0], e[1]); });
  var numDots = n * (n + 1);
  var uf = createUF(numDots);

  for (var i = 0; i < bndKeys.length; i++) {
    var parts = bndKeys[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).blue;
    union(uf, blueDotIndex(ep[0][0], ep[0][1], n), blueDotIndex(ep[1][0], ep[1][1], n));
  }

  var allCrossings = allBlueCrossingEdges(n);
  var available = [];
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (board.get(key) !== 'red') available.push(key);
  }

  var L = new Set();
  var R = new Set();
  for (var i = 0; i < available.length; i++) {
    var parts = available[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).blue;
    var a = blueDotIndex(ep[0][0], ep[0][1], n);
    var b = blueDotIndex(ep[1][0], ep[1][1], n);
    if (find(uf, a) !== find(uf, b)) {
      union(uf, a, b);
      L.add(available[i]);
    } else {
      R.add(available[i]);
    }
  }

  return { L: L, R: R };
}

// --- Tree connectivity helpers ---

function redDotIndex(r, c, n) { return (r / 2) * n + (c - 1) / 2; }
function blueDotIndex(r, c, n) { return ((r - 1) / 2) * (n + 1) + c / 2; }

function buildRedUF(edgeKeys, boundaryKeys, n) {
  var numDots = (n + 1) * n;
  var uf = createUF(numDots);
  var allKeys = boundaryKeys.concat(Array.from(edgeKeys));
  for (var i = 0; i < allKeys.length; i++) {
    var parts = allKeys[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).red;
    var a = redDotIndex(ep[0][0], ep[0][1], n);
    var b = redDotIndex(ep[1][0], ep[1][1], n);
    union(uf, a, b);
  }
  return uf;
}

function buildBlueUF(edgeKeys, boundaryKeys, n) {
  var numDots = n * (n + 1);
  var uf = createUF(numDots);
  var allKeys = boundaryKeys.concat(Array.from(edgeKeys));
  for (var i = 0; i < allKeys.length; i++) {
    var parts = allKeys[i].split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c).blue;
    var a = blueDotIndex(ep[0][0], ep[0][1], n);
    var b = blueDotIndex(ep[1][0], ep[1][1], n);
    union(uf, a, b);
  }
  return uf;
}

function countComponents(uf) {
  var roots = new Set();
  for (var i = 0; i < uf.size; i++) roots.add(find(uf, i));
  return roots.size;
}

// --- Win detection ---

function checkWin(claimed, player, n) {
  var g = 2 * n;
  var adj = {};

  function addEdge(dotA, dotB) {
    var ka = k(dotA[0], dotA[1]), kb = k(dotB[0], dotB[1]);
    if (!adj[ka]) adj[ka] = [];
    if (!adj[kb]) adj[kb] = [];
    adj[ka].push(kb);
    adj[kb].push(ka);
  }

  var bnd = allBoundaryEdges(n);
  var bndList = player === 'red' ? bnd.red : bnd.blue;
  for (var i = 0; i < bndList.length; i++) {
    var ep = crossingEndpoints(bndList[i][0], bndList[i][1]);
    var dots = player === 'red' ? ep.red : ep.blue;
    addEdge(dots[0], dots[1]);
  }

  claimed.forEach(function(cr) {
    var parts = cr.split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var ep = crossingEndpoints(r, c);
    var dots = player === 'red' ? ep.red : ep.blue;
    if (inBounds(dots[0][0], dots[0][1]) && inBounds(dots[1][0], dots[1][1])) {
      addEdge(dots[0], dots[1]);
    }
  });

  var starts = [], goals = new Set();
  if (player === 'red') {
    for (var x = 0; x < n; x++) {
      starts.push(k(0, 2 * x + 1));
      goals.add(k(g, 2 * x + 1));
    }
  } else {
    for (var x = 0; x < n; x++) {
      starts.push(k(2 * x + 1, 0));
      goals.add(k(2 * x + 1, g));
    }
  }

  for (var si = 0; si < starts.length; si++) {
    var start = starts[si];
    if (!adj[start]) continue;
    var visited = new Set();
    var prev = {};
    var queue = [start];
    visited.add(start);
    var found = null;

    while (queue.length > 0) {
      var cur = queue.shift();
      if (goals.has(cur)) { found = cur; break; }
      var neighbors = adj[cur] || [];
      for (var ni = 0; ni < neighbors.length; ni++) {
        if (!visited.has(neighbors[ni])) {
          visited.add(neighbors[ni]);
          prev[neighbors[ni]] = cur;
          queue.push(neighbors[ni]);
        }
      }
    }

    if (found) {
      var path = [];
      var cur = found;
      while (prev[cur] !== undefined) {
        path.push([cur, prev[cur]]);
        cur = prev[cur];
      }
      return { won: true, path: path };
    }
  }

  return { won: false, path: [] };
}

// --- Strategy ---

function buildGraphUF(setA, setB, player, n, board) {
  var bnd = allBoundaryEdges(n);
  var bndKeys = (player === 'red' ? bnd.red : bnd.blue).map(function(e) { return k(e[0], e[1]); });
  var bldUF = player === 'red' ? buildRedUF : buildBlueUF;
  var opponent = player === 'red' ? 'blue' : 'red';

  var edges = new Set();
  setA.forEach(function(key) {
    if (board.get(key) !== opponent) edges.add(key);
  });
  setB.forEach(function(key) {
    if (board.get(key) === player) edges.add(key);
  });

  return bldUF(edges, bndKeys, n);
}

function findBridgingEdges(sourceSet, brokenUF, player, n, board) {
  var dotIdx = player === 'red' ? redDotIndex : blueDotIndex;
  var moves = [];

  sourceSet.forEach(function(key) {
    if (!board.has(key)) {
      var parts = key.split(',');
      var r = parseInt(parts[0]), c = parseInt(parts[1]);
      var ep = crossingEndpoints(r, c);
      var dots = player === 'red' ? ep.red : ep.blue;
      var a = dotIdx(dots[0][0], dots[0][1], n);
      var b = dotIdx(dots[1][0], dots[1][1], n);
      if (find(brokenUF, a) !== find(brokenUF, b)) {
        moves.push(key);
      }
    }
  });

  return moves;
}

function getOptimalRedMoves(game) {
  if (game.gameOver || game.turn !== 'red') return [];

  var n = game.n;
  var leftUF = buildGraphUF(game.redL, game.redR, 'red', n, game.board);
  var rightUF = buildGraphUF(game.redR, game.redL, 'red', n, game.board);
  var leftComp = countComponents(leftUF);
  var rightComp = countComponents(rightUF);

  if (leftComp === 1 && rightComp > 1) {
    return findBridgingEdges(game.redL, rightUF, 'red', n, game.board);
  }
  if (rightComp === 1 && leftComp > 1) {
    return findBridgingEdges(game.redR, leftUF, 'red', n, game.board);
  }

  return [];
}

function getOptimalRedMovesWithRecompute(game) {
  var moves = getOptimalRedMoves(game);
  if (moves.length > 0) return moves;
  if (game.gameOver || game.turn !== 'red') return [];

  var newPart = recomputeRedPartition(game.n, game.board);
  game.redL = newPart.L;
  game.redR = newPart.R;
  return getOptimalRedMoves(game);
}

function getOptimalBlueMoves(game) {
  if (game.gameOver || game.turn !== 'blue') return [];

  var n = game.n;
  var leftUF = buildGraphUF(game.blueL, game.blueR, 'blue', n, game.board);
  var rightUF = buildGraphUF(game.blueR, game.blueL, 'blue', n, game.board);
  var leftComp = countComponents(leftUF);
  var rightComp = countComponents(rightUF);

  if (leftComp === 1 && rightComp > 1) {
    return findBridgingEdges(game.blueL, rightUF, 'blue', n, game.board);
  }
  if (rightComp === 1 && leftComp > 1) {
    return findBridgingEdges(game.blueR, leftUF, 'blue', n, game.board);
  }

  return [];
}

function getOptimalBlueMovesWithRecompute(game) {
  var moves = getOptimalBlueMoves(game);
  if (moves.length > 0) return moves;
  if (game.gameOver || game.turn !== 'blue') return [];

  var newPart = recomputeBluePartition(game.n, game.board);
  game.blueL = newPart.L;
  game.blueR = newPart.R;
  return getOptimalBlueMoves(game);
}

// --- Game state ---

function createGame(n) {
  var redPart = buildRedPartition(n);
  var bluePart = buildBluePartition(n);
  return {
    n: n,
    board: new Map(),
    turn: 'red',
    gameOver: false,
    winner: null,
    winPath: [],
    redL: redPart.L,
    redR: redPart.R,
    blueL: bluePart.L,
    blueR: bluePart.R,
    moveCount: 0
  };
}

function humanMove(game, r, c) {
  if (game.gameOver || game.turn !== 'red') return null;
  var key = k(r, c);
  if (!isPlayable(r, c, game.n) || game.board.has(key)) return null;

  game.board.set(key, 'red');
  game.moveCount++;

  var redClaimed = new Set();
  game.board.forEach(function(v, kk) { if (v === 'red') redClaimed.add(kk); });
  var result = checkWin(redClaimed, 'red', game.n);
  if (result.won) {
    game.gameOver = true;
    game.winner = 'red';
    game.winPath = result.path;
    return { winner: 'red', path: result.path };
  }

  game.turn = 'blue';
  return { winner: null };
}

function blueDistanceToWin(n, board) {
  var g = 2 * n;
  var numDots = n * (n + 1);
  var dist = new Array(numDots);
  for (var i = 0; i < numDots; i++) dist[i] = Infinity;
  var adj = new Array(numDots);
  for (var i = 0; i < numDots; i++) adj[i] = [];

  function addEdge(r1, c1, r2, c2, w) {
    var a = blueDotIndex(r1, c1, n), b = blueDotIndex(r2, c2, n);
    adj[a].push({ to: b, w: w });
    adj[b].push({ to: a, w: w });
  }

  var bnd = allBoundaryEdges(n);
  for (var i = 0; i < bnd.blue.length; i++) {
    var ep = crossingEndpoints(bnd.blue[i][0], bnd.blue[i][1]).blue;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], 0);
  }

  var crossings = allPlayableCrossings(n);
  for (var i = 0; i < crossings.length; i++) {
    var ck = k(crossings[i][0], crossings[i][1]);
    var owner = board.get(ck);
    if (owner === 'red') continue;
    var ep = crossingEndpoints(crossings[i][0], crossings[i][1]).blue;
    if (!inBounds(ep[0][0], ep[0][1]) || !inBounds(ep[1][0], ep[1][1])) continue;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], owner === 'blue' ? 0 : 1);
  }

  var deque = [];
  for (var x = 0; x < n; x++) {
    var idx = x * (n + 1);
    dist[idx] = 0;
    deque.push(idx);
  }

  while (deque.length > 0) {
    var cur = deque.shift();
    var neighbors = adj[cur];
    for (var i = 0; i < neighbors.length; i++) {
      var nd = dist[cur] + neighbors[i].w;
      if (nd < dist[neighbors[i].to]) {
        dist[neighbors[i].to] = nd;
        if (neighbors[i].w === 0) deque.unshift(neighbors[i].to);
        else deque.push(neighbors[i].to);
      }
    }
  }

  var minDist = Infinity;
  for (var x = 0; x < n; x++) {
    var idx = x * (n + 1) + n;
    if (dist[idx] < minDist) minDist = dist[idx];
  }
  return minDist;
}

function redDistanceToWin(n, board) {
  var g = 2 * n;
  var numDots = (n + 1) * n;
  var dist = new Array(numDots);
  for (var i = 0; i < numDots; i++) dist[i] = Infinity;
  var adj = new Array(numDots);
  for (var i = 0; i < numDots; i++) adj[i] = [];

  function addEdge(r1, c1, r2, c2, w) {
    var a = redDotIndex(r1, c1, n), b = redDotIndex(r2, c2, n);
    adj[a].push({ to: b, w: w });
    adj[b].push({ to: a, w: w });
  }

  var bnd = allBoundaryEdges(n);
  for (var i = 0; i < bnd.red.length; i++) {
    var ep = crossingEndpoints(bnd.red[i][0], bnd.red[i][1]).red;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], 0);
  }

  var crossings = allPlayableCrossings(n);
  for (var i = 0; i < crossings.length; i++) {
    var ck = k(crossings[i][0], crossings[i][1]);
    var owner = board.get(ck);
    if (owner === 'blue') continue;
    var ep = crossingEndpoints(crossings[i][0], crossings[i][1]).red;
    if (!inBounds(ep[0][0], ep[0][1]) || !inBounds(ep[1][0], ep[1][1])) continue;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], owner === 'red' ? 0 : 1);
  }

  var deque = [];
  for (var x = 0; x < n; x++) {
    dist[x] = 0;
    deque.push(x);
  }

  while (deque.length > 0) {
    var cur = deque.shift();
    var neighbors = adj[cur];
    for (var i = 0; i < neighbors.length; i++) {
      var nd = dist[cur] + neighbors[i].w;
      if (nd < dist[neighbors[i].to]) {
        dist[neighbors[i].to] = nd;
        if (neighbors[i].w === 0) deque.unshift(neighbors[i].to);
        else deque.push(neighbors[i].to);
      }
    }
  }

  var minDist = Infinity;
  for (var x = 0; x < n; x++) {
    var idx = n * n + x;
    if (dist[idx] < minDist) minDist = dist[idx];
  }
  return minDist;
}

function redDistInfo(n, board) {
  var g = 2 * n;
  var numDots = (n + 1) * n;
  var dist = new Array(numDots);
  for (var i = 0; i < numDots; i++) dist[i] = Infinity;
  var adj = new Array(numDots);
  for (var i = 0; i < numDots; i++) adj[i] = [];

  function addEdge(r1, c1, r2, c2, w) {
    var a = redDotIndex(r1, c1, n), b = redDotIndex(r2, c2, n);
    adj[a].push({ to: b, w: w });
    adj[b].push({ to: a, w: w });
  }

  var bnd = allBoundaryEdges(n);
  for (var i = 0; i < bnd.red.length; i++) {
    var ep = crossingEndpoints(bnd.red[i][0], bnd.red[i][1]).red;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], 0);
  }

  var crossings = allPlayableCrossings(n);
  for (var i = 0; i < crossings.length; i++) {
    var ck = k(crossings[i][0], crossings[i][1]);
    var owner = board.get(ck);
    if (owner === 'blue') continue;
    var ep = crossingEndpoints(crossings[i][0], crossings[i][1]).red;
    if (!inBounds(ep[0][0], ep[0][1]) || !inBounds(ep[1][0], ep[1][1])) continue;
    addEdge(ep[0][0], ep[0][1], ep[1][0], ep[1][1], owner === 'red' ? 0 : 1);
  }

  var deque = [];
  for (var x = 0; x < n; x++) {
    dist[x] = 0;
    deque.push(x);
  }

  while (deque.length > 0) {
    var cur = deque.shift();
    var neighbors = adj[cur];
    for (var i = 0; i < neighbors.length; i++) {
      var nd = dist[cur] + neighbors[i].w;
      if (nd < dist[neighbors[i].to]) {
        dist[neighbors[i].to] = nd;
        if (neighbors[i].w === 0) deque.unshift(neighbors[i].to);
        else deque.push(neighbors[i].to);
      }
    }
  }

  var minDist = Infinity;
  var sumDist = 0;
  for (var x = 0; x < n; x++) {
    var idx = n * n + x;
    var d = dist[idx] < 100 ? dist[idx] : 100;
    if (d < minDist) minDist = d;
    sumDist += d;
  }
  return { min: minDist, sum: sumDist };
}

function getUnclaimed(game) {
  var result = [];
  var crossings = allPlayableCrossings(game.n);
  for (var i = 0; i < crossings.length; i++) {
    var ck = k(crossings[i][0], crossings[i][1]);
    if (!game.board.has(ck)) result.push(ck);
  }
  return result;
}

function getBlueBridgingCandidates(game) {
  var n = game.n;
  var leftUF = buildGraphUF(game.blueL, game.blueR, 'blue', n, game.board);
  var rightUF = buildGraphUF(game.blueR, game.blueL, 'blue', n, game.board);
  var leftComp = countComponents(leftUF);
  var rightComp = countComponents(rightUF);

  if (leftComp === 1 && rightComp === 1) return null;

  var sourceSet, brokenUF;
  if (leftComp === 1 && rightComp > 1) {
    sourceSet = game.blueL; brokenUF = rightUF;
  } else if (rightComp === 1 && leftComp > 1) {
    sourceSet = game.blueR; brokenUF = leftUF;
  } else if (rightComp >= leftComp && rightComp > 1) {
    sourceSet = game.blueL; brokenUF = rightUF;
  } else if (leftComp > 1) {
    sourceSet = game.blueR; brokenUF = leftUF;
  }

  if (sourceSet && brokenUF) {
    var edges = findBridgingEdges(sourceSet, brokenUF, 'blue', n, game.board);
    if (edges.length > 0) return edges;
  }
  return null;
}

function getCandidates(game) {
  var candidates = getBlueBridgingCandidates(game);
  if (candidates) return candidates;

  var newPart = recomputeBluePartition(game.n, game.board);
  game.blueL = newPart.L;
  game.blueR = newPart.R;
  candidates = getBlueBridgingCandidates(game);
  if (candidates) return candidates;

  return getUnclaimed(game);
}

var blueEvalWeights = null;
var lastMinimaxScore = 0;
var leafCollector = null;
var blueEvalCrossings = null;
var blueEvalScale = 200;
var nnWidths = [8, 8, 6, 5];

function setBlueEvalWeights(w, scale) {
  blueEvalWeights = w;
  blueEvalScale = scale || 200;
  blueEvalCrossings = allPlayableCrossings(N);
}

function nnSparseChannel(input, groups, w1, b1) {
  var h = new Array(b1.length);
  for (var j = 0; j < b1.length; j++) {
    var sum = b1[j];
    var group = groups[j];
    var wts = w1[j];
    for (var ki = 0; ki < group.length; ki++) {
      sum += input[group[ki]] * wts[ki];
    }
    h[j] = sum > 0 ? sum : 0;
  }
  return h;
}

function nnBlueEvalLogit(n, board) {
  if (!blueEvalWeights || !blueEvalCrossings) return 0;
  var w = blueEvalWeights;

  if (w.type === 'dual_sparse') {
    var input = new Array(61);
    for (var i = 0; i < blueEvalCrossings.length; i++) {
      var v = board.get(k(blueEvalCrossings[i][0], blueEvalCrossings[i][1]));
      input[i] = v === 'red' ? 1 : (v === 'blue' ? -1 : 0);
    }
    var rd = redDistanceToWin(n, board) / 10;
    var bd = blueDistanceToWin(n, board) / 10;

    var h1r = nnSparseChannel(input, w.red_groups, w.red_w1, w.red_b1);
    var h1b = nnSparseChannel(input, w.blue_groups, w.blue_w1, w.blue_b1);

    var h1Len = h1r.length + h1b.length;
    var h2 = new Array(w.b2.length);
    for (var j = 0; j < w.b2.length; j++) {
      var sum = w.b2[j];
      for (var i = 0; i < h1r.length; i++) sum += h1r[i] * w.w2[i * w.b2.length + j];
      var off = h1r.length;
      for (var i = 0; i < h1b.length; i++) sum += h1b[i] * w.w2[(off + i) * w.b2.length + j];
      sum += rd * w.w2[h1Len * w.b2.length + j];
      sum += bd * w.w2[(h1Len + 1) * w.b2.length + j];
      h2[j] = sum > 0 ? sum : 0;
    }
    var logit = w.b3[0];
    for (var i = 0; i < h2.length; i++) logit += h2[i] * w.w3[i];
    return logit;
  }

  if (w.type === 'sparse') {
    var input = new Array(61);
    for (var i = 0; i < blueEvalCrossings.length; i++) {
      var v = board.get(k(blueEvalCrossings[i][0], blueEvalCrossings[i][1]));
      input[i] = v === 'red' ? 1 : (v === 'blue' ? -1 : 0);
    }
    var rd = redDistanceToWin(n, board) / 10;
    var bd = blueDistanceToWin(n, board) / 10;

    var h1 = nnSparseChannel(input, w.groups, w.w1, w.b1);
    var h1Len = h1.length;
    var h2 = new Array(w.b2.length);
    for (var j = 0; j < w.b2.length; j++) {
      var sum = w.b2[j];
      for (var i = 0; i < h1Len; i++) sum += h1[i] * w.w2[i * w.b2.length + j];
      sum += rd * w.w2[h1Len * w.b2.length + j];
      sum += bd * w.w2[(h1Len + 1) * w.b2.length + j];
      h2[j] = sum > 0 ? sum : 0;
    }
    var logit = w.b3[0];
    for (var i = 0; i < h2.length; i++) logit += h2[i] * w.w3[i];
    return logit;
  }

  var nLayers = 1;
  while (w['w' + (nLayers + 1)]) nLayers++;

  var numInputs = w.w1.length / w.b1.length;
  var input = new Array(numInputs);
  for (var i = 0; i < blueEvalCrossings.length; i++) {
    var v = board.get(k(blueEvalCrossings[i][0], blueEvalCrossings[i][1]));
    input[i] = v === 'red' ? 1 : (v === 'blue' ? -1 : 0);
  }
  if (numInputs === 63) {
    input[61] = redDistanceToWin(n, board) / 10;
    input[62] = blueDistanceToWin(n, board) / 10;
  }

  var prev = input;
  for (var L = 1; L <= nLayers; L++) {
    var wL = w['w' + L], bL = w['b' + L];
    var outSize = bL.length;
    var cur = new Array(outSize);
    for (var j = 0; j < outSize; j++) {
      var sum = bL[j];
      for (var i = 0; i < prev.length; i++) sum += prev[i] * wL[i * outSize + j];
      cur[j] = (L < nLayers) ? (sum > 0 ? sum : 0) : sum;
    }
    prev = cur;
  }
  return prev[0];
}

function nnComputerMove(game) {
  var n = game.n;
  var unclaimed = getUnclaimed(game);
  if (unclaimed.length === 0) return null;

  var blueScored = [];
  for (var i = 0; i < unclaimed.length; i++) {
    game.board.set(unclaimed[i], 'blue');
    var bd = blueDistanceToWin(n, game.board);
    blueScored.push({ key: unclaimed[i], score: nnBlueEvalLogit(n, game.board), bd: bd });
    game.board.delete(unclaimed[i]);
  }

  for (var i = 0; i < blueScored.length; i++) {
    if (blueScored[i].bd === 0) return makeMove(game, blueScored[i].key);
  }

  blueScored.sort(function(a, b) { return b.score - a.score; });

  var redScored = [];
  for (var i = 0; i < unclaimed.length; i++) {
    game.board.set(unclaimed[i], 'red');
    redScored.push({ key: unclaimed[i], score: nnBlueEvalLogit(n, game.board) });
    game.board.delete(unclaimed[i]);
  }
  redScored.sort(function(a, b) { return a.score - b.score; });

  var topBlue = Math.min(nnWidths[0], blueScored.length);
  var topRed = Math.min(nnWidths[1], redScored.length);
  var topBlue2 = nnWidths[2];
  var topRed2 = Math.min(nnWidths[3], redScored.length);

  for (var i = 0; i < topBlue; i++) {
    game.board.set(blueScored[i].key, 'blue');
    var worstD1 = Infinity;

    var redCands = [];
    for (var j = 0; j < redScored.length && redCands.length < topRed; j++) {
      if (redScored[j].key !== blueScored[i].key) redCands.push(redScored[j].key);
    }

    for (var j = 0; j < redCands.length; j++) {
      game.board.set(redCands[j], 'red');

      var blue2 = [];
      for (var m = 0; m < blueScored.length; m++) {
        if (blueScored[m].key !== blueScored[i].key && blueScored[m].key !== redCands[j]) {
          game.board.set(blueScored[m].key, 'blue');
          blue2.push({ key: blueScored[m].key, score: nnBlueEvalLogit(n, game.board) });
          game.board.delete(blueScored[m].key);
        }
      }
      blue2.sort(function(a, b) { return b.score - a.score; });

      var bestD2 = -Infinity;
      var b2Len = Math.min(topBlue2, blue2.length);
      for (var m = 0; m < b2Len; m++) {
        game.board.set(blue2[m].key, 'blue');
        var worstD2 = Infinity;

        var red2 = [];
        for (var q = 0; q < redScored.length && red2.length < topRed2; q++) {
          if (redScored[q].key !== blueScored[i].key && redScored[q].key !== redCands[j] && redScored[q].key !== blue2[m].key) red2.push(redScored[q].key);
        }

        for (var q = 0; q < red2.length; q++) {
          game.board.set(red2[q], 'red');
          var s = nnBlueEvalLogit(n, game.board);
          if (s < worstD2) worstD2 = s;
          game.board.delete(red2[q]);
        }

        if (worstD2 > bestD2) bestD2 = worstD2;
        game.board.delete(blue2[m].key);
      }

      if (bestD2 < worstD1) worstD1 = bestD2;
      game.board.delete(redCands[j]);
    }

    blueScored[i].minimax = worstD1;
    game.board.delete(blueScored[i].key);
  }

  blueScored.sort(function(a, b) { return (b.minimax || -Infinity) - (a.minimax || -Infinity); });
  lastMinimaxScore = blueScored[0].minimax;
  return makeMove(game, blueScored[0].key);
}

var wasmBot = null;
var wasmCrossingKeys = null;

function initWasmCrossingKeys() {
  if (wasmCrossingKeys) return;
  var crossings = allPlayableCrossings(N);
  wasmCrossingKeys = [];
  for (var i = 0; i < crossings.length; i++)
    wasmCrossingKeys.push(k(crossings[i][0], crossings[i][1]));
}

function wasmComputerMove(game) {
  initWasmCrossingKeys();
  var part = recomputeBluePartition(game.n, game.board);
  game.blueL = part.L;
  game.blueR = part.R;

  var boardArr = new Uint8Array(61);
  var blueLArr = new Uint8Array(61);
  var blueRArr = new Uint8Array(61);
  for (var i = 0; i < 61; i++) {
    var owner = game.board.get(wasmCrossingKeys[i]);
    if (owner === 'red') boardArr[i] = 1;
    else if (owner === 'blue') boardArr[i] = 2;
    if (part.L.has(wasmCrossingKeys[i])) blueLArr[i] = 1;
    if (part.R.has(wasmCrossingKeys[i])) blueRArr[i] = 1;
  }

  wasmBot.HEAPU8.set(boardArr, wasmBot._boardPtr);
  wasmBot.HEAPU8.set(blueLArr, wasmBot._blueLPtr);
  wasmBot.HEAPU8.set(blueRArr, wasmBot._blueRPtr);
  var t0 = performance.now();
  var idx = wasmBot._computerMove(wasmBot._boardPtr, wasmBot._blueLPtr, wasmBot._blueRPtr);
  var elapsed = (performance.now() - t0).toFixed(0);
  var depth = wasmBot.cwrap('wasm_get_last_depth', 'number', [])();
  var nodes = wasmBot.cwrap('wasm_get_last_nodes', 'number', [])();
  console.log('wasm move: depth=' + depth + ' nodes=' + nodes + ' time=' + elapsed + 'ms');
  if (idx < 0) return null;
  return makeMove(game, wasmCrossingKeys[idx]);
}

function computerMove(game) {
  if (game.gameOver || game.turn !== 'blue') return null;
  var n = game.n;
  lastMinimaxScore = null;

  if (wasmBot) return wasmComputerMove(game);
  if (blueEvalWeights) return nnComputerMove(game);
  console.log('wasm not loaded');

  var unclaimed = getUnclaimed(game);
  if (unclaimed.length === 0) return null;

  var newPart = recomputeBluePartition(n, game.board);
  game.blueL = newPart.L;
  game.blueR = newPart.R;

  var redDist = redDistanceToWin(n, game.board);

  var scored = [];
  for (var i = 0; i < unclaimed.length; i++) {
    game.board.set(unclaimed[i], 'blue');
    var rdi = redDistInfo(n, game.board);
    scored.push({
      key: unclaimed[i],
      bd: blueDistanceToWin(n, game.board),
      rd: rdi.min,
      rdSum: rdi.sum
    });
    game.board.delete(unclaimed[i]);
  }

  for (var i = 0; i < scored.length; i++) {
    if (scored[i].bd === 0) return makeMove(game, scored[i].key);
  }

  if (redDist <= 1) {
    scored.sort(function(a, b) { return (b.rd * 200 - b.bd * 100) - (a.rd * 200 - a.bd * 100) || b.rdSum - a.rdSum; });
    return makeMove(game, scored[0].key);
  }

  var leftUF = buildGraphUF(game.blueL, game.blueR, 'blue', n, game.board);
  var rightUF = buildGraphUF(game.blueR, game.blueL, 'blue', n, game.board);
  var leftComp = countComponents(leftUF);
  var rightComp = countComponents(rightUF);

  var repairSet = new Set();
  if (leftComp === 1 && rightComp > 1) {
    var repairs = findBridgingEdges(game.blueL, rightUF, 'blue', n, game.board);
    for (var i = 0; i < repairs.length; i++) repairSet.add(repairs[i]);
  } else if (rightComp === 1 && leftComp > 1) {
    var repairs = findBridgingEdges(game.blueR, leftUF, 'blue', n, game.board);
    for (var i = 0; i < repairs.length; i++) repairSet.add(repairs[i]);
  }

  var gapBridgeSet = new Set();
  if (leftComp === 1 && rightComp > 1) {
    var leftBndRoot = find(rightUF, 0);
    var rightBndRoot = find(rightUF, n);
    if (leftBndRoot !== rightBndRoot) {
      repairSet.forEach(function(key) {
        var parts = key.split(',');
        var r = parseInt(parts[0]), c = parseInt(parts[1]);
        var ep = crossingEndpoints(r, c).blue;
        var a = blueDotIndex(ep[0][0], ep[0][1], n);
        var b = blueDotIndex(ep[1][0], ep[1][1], n);
        var rootA = find(rightUF, a);
        var rootB = find(rightUF, b);
        if ((rootA === leftBndRoot && rootB === rightBndRoot) ||
            (rootA === rightBndRoot && rootB === leftBndRoot)) {
          gapBridgeSet.add(key);
        }
      });
    }
  }

  var repairBonus = Math.min(redDist - 1, 4) * 500;
  var gapBridgeBonus = Math.min(redDist - 1, 4) * 1250;
  for (var i = 0; i < scored.length; i++) {
    scored[i].score = -scored[i].bd * 200 + scored[i].rdSum * 100;
    if (repairSet.has(scored[i].key)) scored[i].score += repairBonus;
    if (gapBridgeSet.has(scored[i].key)) scored[i].score += gapBridgeBonus;
  }
  scored.sort(function(a, b) { return b.score - a.score; });

  var bestBd = Infinity;
  for (var i = 0; i < scored.length; i++) {
    if (scored[i].bd < bestBd) bestBd = scored[i].bd;
  }
  var top20HasBdBest = false;
  for (var i = 0; i < Math.min(20, scored.length); i++) {
    if (scored[i].bd === bestBd) { top20HasBdBest = true; break; }
  }
  if (!top20HasBdBest) {
    var injected = [];
    for (var i = 20; i < scored.length; i++) {
      if (scored[i].bd === bestBd && injected.length < 3) injected.push(scored[i]);
    }
    scored = scored.slice(0, 20).concat(injected);
  }

  var redPriority = [];
  for (var i = 0; i < unclaimed.length; i++) {
    game.board.set(unclaimed[i], 'red');
    var rrd = redDistanceToWin(n, game.board);
    var rbd = blueDistanceToWin(n, game.board);
    redPriority.push({ key: unclaimed[i], dist: rrd, score: -rrd * 200 + rbd * 100 });
    game.board.delete(unclaimed[i]);
  }
  redPriority.sort(function(a, b) { return b.score - a.score; });

  var topN = Math.min(top20HasBdBest ? 20 : 23, scored.length);
  var redW = Math.min(4, redPriority.length);
  var blueW2 = Math.min(6, scored.length);
  var redW2 = Math.min(4, redPriority.length);

  for (var i = 0; i < topN; i++) {
    game.board.set(scored[i].key, 'blue');
    var worstD1 = Infinity;

    var redTop = [];
    for (var j = 0; j < redPriority.length && redTop.length < redW; j++) {
      if (redPriority[j].key !== scored[i].key) redTop.push(redPriority[j].key);
    }

    for (var j = 0; j < redTop.length; j++) {
      game.board.set(redTop[j], 'red');

      var bestD2 = -Infinity;
      var blueFollow = [];
      for (var m = 0; m < scored.length; m++) {
        if (scored[m].key !== scored[i].key && scored[m].key !== redTop[j]) {
          game.board.set(scored[m].key, 'blue');
          blueFollow.push({ key: scored[m].key, bd: blueDistanceToWin(n, game.board) });
          game.board.delete(scored[m].key);
        }
      }
      blueFollow.sort(function(a, b) { return a.bd - b.bd; });
      var blueTop2 = [];
      for (var m = 0; m < blueFollow.length && blueTop2.length < blueW2; m++) {
        blueTop2.push(blueFollow[m].key);
      }

      for (var m = 0; m < blueTop2.length; m++) {
        game.board.set(blueTop2[m], 'blue');
        var worstD2 = Infinity;

        var redTop2 = [];
        for (var q = 0; q < redPriority.length && redTop2.length < redW2; q++) {
          if (redPriority[q].key !== scored[i].key && redPriority[q].key !== redTop[j] && redPriority[q].key !== blueTop2[m]) redTop2.push(redPriority[q].key);
        }

        for (var q = 0; q < redTop2.length; q++) {
          game.board.set(redTop2[q], 'red');
          var rdi2 = redDistInfo(n, game.board);
          var leafBd = blueDistanceToWin(n, game.board);
          var bdWeight = redDist <= 2 ? 400 : 200;
          var s = -leafBd * bdWeight + rdi2.sum * 100 + rdi2.min * 500 - Math.max(0, leafBd - 5) * 300;
          if (leafCollector) leafCollector(game.board, s);
          if (s < worstD2) worstD2 = s;
          game.board.delete(redTop2[q]);
        }

        if (worstD2 > bestD2) bestD2 = worstD2;
        game.board.delete(blueTop2[m]);
      }

      if (bestD2 < worstD1) worstD1 = bestD2;
      game.board.delete(redTop[j]);
    }

    scored[i].minimax = worstD1;
    game.board.delete(scored[i].key);
  }

  var topScored = scored.slice(0, topN);
  var curBd = blueDistanceToWin(n, game.board);
  var bdBias = 300;
  for (var i = 0; i < topScored.length; i++) {
    topScored[i].finalScore = topScored[i].minimax - topScored[i].bd * bdBias;
  }
  topScored.sort(function(a, b) { return b.finalScore - a.finalScore; });
  lastMinimaxScore = topScored[0].minimax;
  return makeMove(game, topScored[0].key);
}

function makeMove(game, moveKey) {
  if (!moveKey) return null;
  game.board.set(moveKey, 'blue');
  game.moveCount++;
  var blueClaimed = new Set();
  game.board.forEach(function(v, kk) { if (v === 'blue') blueClaimed.add(kk); });
  var result = checkWin(blueClaimed, 'blue', game.n);
  if (result.won) {
    game.gameOver = true;
    game.winner = 'blue';
    game.winPath = result.path;
    return { key: moveKey, winner: 'blue', path: result.path };
  }
  game.turn = 'red';
  return { key: moveKey, winner: null };
}

// --- Win indicator ---

function getWinIndicator(game) {
  if (game.gameOver) return game.winner;

  var n = game.n;
  var bnd = allBoundaryEdges(n);
  var allCrossings = allRedCrossingEdges(n);

  var redBndKeys = bnd.red.map(function(e) { return k(e[0], e[1]); });
  var availableRed = [];
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (game.board.get(key) !== 'blue') availableRed.push(key);
  }
  if (countComponents(buildRedUF(availableRed, redBndKeys, n)) > 1) return 'blue';

  var blueBndKeys = bnd.blue.map(function(e) { return k(e[0], e[1]); });
  var availableBlue = [];
  for (var i = 0; i < allCrossings.length; i++) {
    var key = k(allCrossings[i][0], allCrossings[i][1]);
    if (game.board.get(key) !== 'red') availableBlue.push(key);
  }
  if (countComponents(buildBlueUF(availableBlue, blueBndKeys, n)) > 1) return 'red';

  var leftUF = buildGraphUF(game.redL, game.redR, 'red', n, game.board);
  var rightUF = buildGraphUF(game.redR, game.redL, 'red', n, game.board);
  var lc = countComponents(leftUF);
  var rc = countComponents(rightUF);
  if (lc === 1 && rc <= 2) return 'red';
  if (rc === 1 && lc <= 2) return 'red';

  var crossings = allPlayableCrossings(n);
  var worstBlueDist = blueDistanceToWin(n, game.board);
  for (var i = 0; i < crossings.length; i++) {
    var ck = k(crossings[i][0], crossings[i][1]);
    if (game.board.has(ck)) continue;
    game.board.set(ck, 'red');
    var d = blueDistanceToWin(n, game.board);
    if (d > worstBlueDist) worstBlueDist = d;
    game.board.delete(ck);
  }
  if (worstBlueDist <= 1) return 'blue';

  return null;
}

// --- Exports for testing ---

if (typeof module !== 'undefined') {
  module.exports = {
    N: N, GRID: GRID, cellType: cellType,
    redDotToUnified: redDotToUnified, blueDotToUnified: blueDotToUnified,
    unifiedToRedDot: unifiedToRedDot, unifiedToBlueDot: unifiedToBlueDot,
    crossingEndpoints: crossingEndpoints, inBounds: inBounds,
    boundaryType: boundaryType, isPlayable: isPlayable,
    allPlayableCrossings: allPlayableCrossings, allBoundaryEdges: allBoundaryEdges,
    allRedCrossingEdges: allRedCrossingEdges, allBlueCrossingEdges: allBlueCrossingEdges,
    createUF: createUF, find: find, union: union, connected: connected,
    buildStaircaseTree: buildStaircaseTree,
    redDotSpaceEdgeToCrossing: redDotSpaceEdgeToCrossing,
    blueDotSpaceEdgeToCrossing: blueDotSpaceEdgeToCrossing,
    k: k, buildRedPartition: buildRedPartition, buildBluePartition: buildBluePartition,
    recomputeRedPartition: recomputeRedPartition, recomputeBluePartition: recomputeBluePartition,
    redDotIndex: redDotIndex, blueDotIndex: blueDotIndex,
    buildRedUF: buildRedUF, buildBlueUF: buildBlueUF, countComponents: countComponents,
    checkWin: checkWin,
    buildGraphUF: buildGraphUF, findBridgingEdges: findBridgingEdges,
    getOptimalRedMoves: getOptimalRedMoves, getOptimalRedMovesWithRecompute: getOptimalRedMovesWithRecompute,
    getOptimalBlueMoves: getOptimalBlueMoves, getOptimalBlueMovesWithRecompute: getOptimalBlueMovesWithRecompute,
    createGame: createGame, humanMove: humanMove, computerMove: computerMove,
    blueDistanceToWin: blueDistanceToWin, redDistanceToWin: redDistanceToWin, redDistInfo: redDistInfo,
    getUnclaimed: getUnclaimed, getCandidates: getCandidates,
    getWinIndicator: getWinIndicator,
    setBlueEvalWeights: setBlueEvalWeights, nnBlueEvalLogit: nnBlueEvalLogit,
    setNNWidths: function(w) { nnWidths = w; },
    getLastMinimaxScore: function() { return lastMinimaxScore; },
    setLeafCollector: function(fn) { leafCollector = fn; }
  };
}

// --- WASM loader ---

if (typeof document !== 'undefined' && typeof WebAssembly !== 'undefined') {
  var script = document.createElement('script');
  script.src = 'wasm/bridgit_bot.js';
  script.onload = function() {
    if (typeof BridgitBot === 'function') {
      BridgitBot().then(function(mod) {
        var boardPtr = mod._malloc(61);
        var blueLPtr = mod._malloc(61);
        var blueRPtr = mod._malloc(61);
        mod._boardPtr = boardPtr;
        mod._blueLPtr = blueLPtr;
        mod._blueRPtr = blueRPtr;
        mod._computerMove = mod.cwrap('wasm_computer_move', 'number', ['number', 'number', 'number']);
        mod.cwrap('wasm_init', null, [])();
        mod._setTimeLimit = mod.cwrap('wasm_set_time_limit', null, ['number']);
        var sel = document.getElementById('strengthSelect');
        mod._setTimeLimit(sel ? parseInt(sel.value) : 200);
        wasmBot = mod;
        console.log('wasm loaded');
      }).catch(function(e) { console.log('wasm not loaded'); });
    }
  };
  document.head.appendChild(script);
}

// --- Browser rendering & events ---

if (typeof document !== 'undefined') {
(function() {

var CELL = 40;
var DOT_R = 5.5;
var PAD = 2;
var EDGE_W = 3;
var WIN_W = 8;
var CANVAS_SIZE = (GRID - 1) * CELL + 2 * PAD;

var canvas = document.getElementById('board');
var ctx = canvas.getContext('2d');
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;
function sizeCanvas() {
  canvas.style.width = '0';
  canvas.style.height = '0';
  var avail = canvas.parentElement.clientWidth;
  var displaySize = Math.min(CANVAS_SIZE, avail);
  canvas.style.width = displaySize + 'px';
  canvas.style.height = displaySize + 'px';
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

var humanScoreEl = document.getElementById('humanScore');
var botScoreEl = document.getElementById('botScore');
var newGameBtn = document.getElementById('newGameBtn');

var humanScore = 0, botScore = 0;
var game, hoverCell, inputDisabled, blinkingKey, blinkAnimating;
var showL = false, showR = false, showOptimal = false;
var gameLog = []; window.gameLog = gameLog; window.gameLogCurrentMoves = null;

function startGame() {
  game = createGame(N);
  hoverCell = null;
  inputDisabled = false;
  blinkingKey = null;
  blinkAnimating = false;
  if (wasmBot) wasmBot.cwrap('wasm_init', null, [])();
  draw();
}

function px(gridIdx) { return PAD + gridIdx * CELL; }

function maybeRecomputeRedPartition() {
  if (game.gameOver || game.turn !== 'red') return;
  var leftUF = buildGraphUF(game.redL, game.redR, 'red', game.n, game.board);
  var rightUF = buildGraphUF(game.redR, game.redL, 'red', game.n, game.board);
  var leftComp = countComponents(leftUF);
  var rightComp = countComponents(rightUF);
  if ((leftComp === 1 && rightComp > 1) || (rightComp === 1 && leftComp > 1)) return;
  var newPart = recomputeRedPartition(game.n, game.board);
  game.redL = newPart.L;
  game.redR = newPart.R;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (showL || showR || showOptimal) maybeRecomputeRedPartition();

  drawBoundaryEdges();
  drawClaimedEdges();

  if (showL) drawTreeOverlay(game.redL, '#999');
  if (showR) drawTreeOverlay(game.redR, '#999');
  if (showOptimal && !game.gameOver && game.turn === 'red') drawOptimalOverlay();

  if (game.winPath.length > 0 && !blinkAnimating) drawWinPath();

  if (hoverCell && !inputDisabled && !game.gameOver && game.turn === 'red') {
    drawPreview(hoverCell[0], hoverCell[1]);
  }

  drawDots();
}

function drawDots() {
  var g = 2 * N;
  for (var r = 0; r < GRID; r++) {
    for (var c = 0; c < GRID; c++) {
      var type = cellType(r, c);
      if (type === 'red-dot') {
        var isBoundary = (r === 0 || r === g);
        ctx.beginPath();
        ctx.arc(px(c), px(r), isBoundary ? DOT_R + 2 : DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
      } else if (type === 'blue-dot') {
        var isBoundary = (c === 0 || c === g);
        ctx.beginPath();
        ctx.arc(px(c), px(r), isBoundary ? DOT_R + 2 : DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = '#0000ff';
        ctx.fill();
      }
    }
  }
}

function drawEdgeLine(r, c, player, color, width) {
  var ep = crossingEndpoints(r, c);
  var dots = player === 'red' ? ep.red : ep.blue;
  ctx.beginPath();
  ctx.moveTo(px(dots[0][1]), px(dots[0][0]));
  ctx.lineTo(px(dots[1][1]), px(dots[1][0]));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawBoundaryEdges() {
  var bnd = allBoundaryEdges(N);
  for (var i = 0; i < bnd.red.length; i++) {
    drawEdgeLine(bnd.red[i][0], bnd.red[i][1], 'red', '#ff0000', EDGE_W);
  }
  for (var i = 0; i < bnd.blue.length; i++) {
    drawEdgeLine(bnd.blue[i][0], bnd.blue[i][1], 'blue', '#0000ff', EDGE_W);
  }
}

function drawClaimedEdges() {
  game.board.forEach(function(player, key) {
    if (key === blinkingKey && blinkAnimating) return;
    var parts = key.split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var color = player === 'red' ? '#ff0000' : (key === blinkingKey ? '#aaaaff' : '#0000ff');
    drawEdgeLine(r, c, player, color, EDGE_W);
  });
}

function drawPreview(r, c) {
  drawEdgeLine(r, c, 'red', 'rgba(255, 150, 150, 0.5)', EDGE_W);
}

function drawOptimalOverlay() {
  var moves = getOptimalRedMoves(game);
  for (var i = 0; i < moves.length; i++) {
    var parts = moves[i].split(',');
    drawEdgeLine(parseInt(parts[0]), parseInt(parts[1]), 'red', 'rgba(100, 220, 100, 0.5)', EDGE_W);
  }
}

function drawTreeOverlay(treeSet, color) {
  ctx.save();
  treeSet.forEach(function(key) {
    var claimed = game.board.get(key);
    if (claimed === 'blue') return;
    var parts = key.split(',');
    var r = parseInt(parts[0]), c = parseInt(parts[1]);
    var drawColor = claimed === 'red' ? '#ff0000' : color;
    drawEdgeLine(r, c, 'red', drawColor, 2);
  });
  ctx.restore();
}

function drawWinPath() {
  var color = game.winner === 'red' ? '#ff0000' : '#0000ff';

  for (var i = 0; i < game.winPath.length; i++) {
    var dotA = game.winPath[i][0].split(',');
    var dotB = game.winPath[i][1].split(',');
    var rA = parseInt(dotA[0]), cA = parseInt(dotA[1]);
    var rB = parseInt(dotB[0]), cB = parseInt(dotB[1]);
    var cr = [(rA + rB) / 2, (cA + cB) / 2];
    if (boundaryType(cr[0], cr[1], N)) continue;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(px(cA), px(rA));
    ctx.lineTo(px(cB), px(rB));
    ctx.strokeStyle = color;
    ctx.lineWidth = WIN_W;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

function hitTest(mx, my) {
  var bestDist = Infinity;
  var bestCell = null;
  var crossings = allPlayableCrossings(N);
  for (var i = 0; i < crossings.length; i++) {
    var r = crossings[i][0], c = crossings[i][1];
    if (game.board.has(k(r, c))) continue;
    var ep = crossingEndpoints(r, c).red;
    var x1 = px(ep[0][1]), y1 = px(ep[0][0]);
    var x2 = px(ep[1][1]), y2 = px(ep[1][0]);
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = ((mx - x1) * dx + (my - y1) * dy) / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var nx = x1 + t * dx, ny = y1 + t * dy;
    var d = (mx - nx) * (mx - nx) + (my - ny) * (my - ny);
    if (d < bestDist) {
      bestDist = d;
      bestCell = [r, c];
    }
  }
  if (bestDist > CELL * CELL * 0.25) return null;
  return bestCell;
}

function canvasCoords(e) {
  var rect = canvas.getBoundingClientRect();
  var scale = canvas.width / rect.width;
  return [(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale];
}

canvas.addEventListener('mousemove', function(e) {
  var coords = canvasCoords(e);
  var mx = coords[0], my = coords[1];
  var cell = hitTest(mx, my);
  if (cell && hoverCell && cell[0] === hoverCell[0] && cell[1] === hoverCell[1]) return;
  hoverCell = cell;
  draw();
});

canvas.addEventListener('mouseleave', function() {
  hoverCell = null;
  draw();
});

canvas.addEventListener('click', function(e) {
  if (inputDisabled || game.gameOver || game.turn !== 'red') return;
  var coords = canvasCoords(e);
  var mx = coords[0], my = coords[1];
  var cell = hitTest(mx, my);
  if (!cell) return;

  var result = humanMove(game, cell[0], cell[1]);
  if (!result) return;

  if (!window.gameLogCurrentMoves) window.gameLogCurrentMoves = [];
  window.gameLogCurrentMoves.push({ player: 'red', move: k(cell[0], cell[1]) });

  blinkingKey = null;
  hoverCell = null;
  draw();

  if (result.winner) {
    humanScore++;
    humanScoreEl.textContent = humanScore;
    gameLog.push({ moves: window.gameLogCurrentMoves, winner: 'red' });
    window.gameLogCurrentMoves = null;
    return;
  }

  inputDisabled = true;
  setTimeout(function() {
    var blueResult = computerMove(game);
    if (!blueResult) {
      game.turn = 'red';
      inputDisabled = false;
      return;
    }

    if (window.gameLogCurrentMoves) window.gameLogCurrentMoves.push({ player: 'blue', move: blueResult.key });

    blinkAnimation(blueResult.key, function() {
      inputDisabled = false;
      draw();
      if (blueResult.winner) {
        botScore++;
        botScoreEl.textContent = botScore;
        gameLog.push({ moves: window.gameLogCurrentMoves, winner: 'blue' });
        window.gameLogCurrentMoves = null;
      }
    });
  }, 0);
});

function blinkAnimation(moveKey, callback) {
  blinkingKey = moveKey;
  blinkAnimating = true;
  var parts = moveKey.split(',');
  var r = parseInt(parts[0]), c = parseInt(parts[1]);
  var blinks = 0;
  var visible = true;
  var interval = setInterval(function() {
    visible = !visible;
    draw();
    if (visible) {
      drawEdgeLine(r, c, 'blue', '#6666ff', EDGE_W);
    }
    blinks++;
    if (blinks >= 10) {
      clearInterval(interval);
      blinkAnimating = false;
      callback();
    }
  }, 180);
}

function updateOverlayBtns() {
  document.getElementById('btnL').classList.toggle('active', showL);
  document.getElementById('btnR').classList.toggle('active', showR);
  document.getElementById('btnW').classList.toggle('active', showOptimal);
}

function toggleOverlay(which) {
  if (which === 'L') { showL = !showL; showR = false; showOptimal = false; }
  else if (which === 'R') { showR = !showR; showL = false; showOptimal = false; }
  else if (which === 'W') { showOptimal = !showOptimal; showL = false; showR = false; }
  updateOverlayBtns();
  draw();
}

document.getElementById('btnL').addEventListener('click', function() { toggleOverlay('L'); });
document.getElementById('btnR').addEventListener('click', function() { toggleOverlay('R'); });
document.getElementById('btnW').addEventListener('click', function() { toggleOverlay('W'); });

var nnActive = false;
var nnBtn = document.getElementById('btnNN');
if (nnBtn) {
  nnBtn.addEventListener('click', function() {
    if (nnActive) {
      setBlueEvalWeights(null);
      nnActive = false;
      nnBtn.classList.remove('active');
    } else {
      fetch('nn/td_weights_best.json').then(function(r) { return r.json(); }).then(function(w) {
        setBlueEvalWeights(w);
        nnActive = true;
        nnBtn.classList.add('active');
      }).catch(function() {});
    }
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === '1') toggleOverlay('L');
  else if (e.key === '2') toggleOverlay('R');
  else if (e.key === '3') toggleOverlay('W');
  else if (e.key === '4' && nnBtn) nnBtn.click();
});

newGameBtn.addEventListener('click', function() {
  if (!game.gameOver) {
    botScore++;
    botScoreEl.textContent = botScore;
    if (window.gameLogCurrentMoves && window.gameLogCurrentMoves.length > 0) {
      gameLog.push({ moves: window.gameLogCurrentMoves, winner: 'forfeit' });
    }
    window.gameLogCurrentMoves = null;
  }
  startGame();
});

document.getElementById('strengthSelect').addEventListener('change', function() {
  if (wasmBot && wasmBot._setTimeLimit) {
    wasmBot._setTimeLimit(parseInt(this.value));
  }
});

window.downloadGameLog = function() {
  var blob = new Blob([JSON.stringify(gameLog, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'game_log.json';
  a.click();
};

startGame();

})();
}
