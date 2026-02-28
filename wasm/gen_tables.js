var g = require('../game.js');
var N = 6;

var crossings = g.allPlayableCrossings(N);
var bnd = g.allBoundaryEdges(N);

// crossing_rc: maps index -> [r,c]
console.log('// ' + crossings.length + ' crossings');
console.log('static const uint8_t crossing_rc[NUM_CROSSINGS][2] = {');
for (var i = 0; i < crossings.length; i++) {
  var sep = i < crossings.length - 1 ? ',' : '';
  console.log('  {' + crossings[i][0] + ',' + crossings[i][1] + '}' + sep + ' // ' + i);
}
console.log('};');
console.log('');

// rc_to_index: maps "r,c" -> index
var rcToIdx = {};
for (var i = 0; i < crossings.length; i++) {
  rcToIdx[g.k(crossings[i][0], crossings[i][1])] = i;
}

// blue endpoints: for each crossing, the two blue dot indices
console.log('static const uint8_t blue_ep[NUM_CROSSINGS][2] = {');
for (var i = 0; i < crossings.length; i++) {
  var r = crossings[i][0], c = crossings[i][1];
  var ep = g.crossingEndpoints(r, c).blue;
  var a = g.blueDotIndex(ep[0][0], ep[0][1], N);
  var b = g.blueDotIndex(ep[1][0], ep[1][1], N);
  var sep = i < crossings.length - 1 ? ',' : '';
  console.log('  {' + a + ',' + b + '}' + sep + ' // ' + r + ',' + c);
}
console.log('};');
console.log('');

// red endpoints: for each crossing, the two red dot indices
console.log('static const uint8_t red_ep[NUM_CROSSINGS][2] = {');
for (var i = 0; i < crossings.length; i++) {
  var r = crossings[i][0], c = crossings[i][1];
  var ep = g.crossingEndpoints(r, c).red;
  var a = g.redDotIndex(ep[0][0], ep[0][1], N);
  var b = g.redDotIndex(ep[1][0], ep[1][1], N);
  var sep = i < crossings.length - 1 ? ',' : '';
  console.log('  {' + a + ',' + b + '}' + sep + ' // ' + r + ',' + c);
}
console.log('};');
console.log('');

// Blue boundary edges
console.log('// ' + bnd.blue.length + ' blue boundary edges');
console.log('static const uint8_t blue_bnd_ep[NUM_BLUE_BND][2] = {');
for (var i = 0; i < bnd.blue.length; i++) {
  var r = bnd.blue[i][0], c = bnd.blue[i][1];
  var ep = g.crossingEndpoints(r, c).blue;
  var a = g.blueDotIndex(ep[0][0], ep[0][1], N);
  var b = g.blueDotIndex(ep[1][0], ep[1][1], N);
  var sep = i < bnd.blue.length - 1 ? ',' : '';
  console.log('  {' + a + ',' + b + '}' + sep + ' // ' + r + ',' + c);
}
console.log('};');
console.log('');

// Red boundary edges
console.log('// ' + bnd.red.length + ' red boundary edges');
console.log('static const uint8_t red_bnd_ep[NUM_RED_BND][2] = {');
for (var i = 0; i < bnd.red.length; i++) {
  var r = bnd.red[i][0], c = bnd.red[i][1];
  var ep = g.crossingEndpoints(r, c).red;
  var a = g.redDotIndex(ep[0][0], ep[0][1], N);
  var b = g.redDotIndex(ep[1][0], ep[1][1], N);
  var sep = i < bnd.red.length - 1 ? ',' : '';
  console.log('  {' + a + ',' + b + '}' + sep + ' // ' + r + ',' + c);
}
console.log('};');
console.log('');

// Blue adjacency: for BFS, each blue dot's neighbors via crossings
var blueAdj = [];
for (var i = 0; i < 42; i++) blueAdj[i] = [];
// boundary edges (no crossing index, always free)
for (var i = 0; i < bnd.blue.length; i++) {
  var r = bnd.blue[i][0], c = bnd.blue[i][1];
  var ep = g.crossingEndpoints(r, c).blue;
  var a = g.blueDotIndex(ep[0][0], ep[0][1], N);
  var b = g.blueDotIndex(ep[1][0], ep[1][1], N);
  blueAdj[a].push({to: b, crossing: 255}); // 255 = boundary (always free)
  blueAdj[b].push({to: a, crossing: 255});
}
// playable crossings
for (var i = 0; i < crossings.length; i++) {
  var r = crossings[i][0], c = crossings[i][1];
  var ep = g.crossingEndpoints(r, c).blue;
  if (!g.inBounds(ep[0][0], ep[0][1]) || !g.inBounds(ep[1][0], ep[1][1])) continue;
  var a = g.blueDotIndex(ep[0][0], ep[0][1], N);
  var b = g.blueDotIndex(ep[1][0], ep[1][1], N);
  blueAdj[a].push({to: b, crossing: i});
  blueAdj[b].push({to: a, crossing: i});
}

var maxBlueAdj = 0;
for (var i = 0; i < 42; i++) if (blueAdj[i].length > maxBlueAdj) maxBlueAdj = blueAdj[i].length;
console.log('// Max blue adjacency: ' + maxBlueAdj);
console.log('#define MAX_BLUE_ADJ ' + maxBlueAdj);
console.log('static const uint8_t blue_adj_count[NUM_BLUE_DOTS] = {');
var counts = [];
for (var i = 0; i < 42; i++) counts.push(blueAdj[i].length);
console.log('  ' + counts.join(','));
console.log('};');
console.log('static const uint8_t blue_adj_to[NUM_BLUE_DOTS][MAX_BLUE_ADJ] = {');
for (var i = 0; i < 42; i++) {
  var row = [];
  for (var j = 0; j < maxBlueAdj; j++) row.push(j < blueAdj[i].length ? blueAdj[i][j].to : 0);
  console.log('  {' + row.join(',') + '},');
}
console.log('};');
console.log('static const uint8_t blue_adj_crossing[NUM_BLUE_DOTS][MAX_BLUE_ADJ] = {');
for (var i = 0; i < 42; i++) {
  var row = [];
  for (var j = 0; j < maxBlueAdj; j++) row.push(j < blueAdj[i].length ? blueAdj[i][j].crossing : 255);
  console.log('  {' + row.join(',') + '},');
}
console.log('};');
console.log('');

// Red adjacency
var redAdj = [];
for (var i = 0; i < 42; i++) redAdj[i] = [];
for (var i = 0; i < bnd.red.length; i++) {
  var r = bnd.red[i][0], c = bnd.red[i][1];
  var ep = g.crossingEndpoints(r, c).red;
  var a = g.redDotIndex(ep[0][0], ep[0][1], N);
  var b = g.redDotIndex(ep[1][0], ep[1][1], N);
  redAdj[a].push({to: b, crossing: 255});
  redAdj[b].push({to: a, crossing: 255});
}
for (var i = 0; i < crossings.length; i++) {
  var r = crossings[i][0], c = crossings[i][1];
  var ep = g.crossingEndpoints(r, c).red;
  if (!g.inBounds(ep[0][0], ep[0][1]) || !g.inBounds(ep[1][0], ep[1][1])) continue;
  var a = g.redDotIndex(ep[0][0], ep[0][1], N);
  var b = g.redDotIndex(ep[1][0], ep[1][1], N);
  redAdj[a].push({to: b, crossing: i});
  redAdj[b].push({to: a, crossing: i});
}

var maxRedAdj = 0;
for (var i = 0; i < 42; i++) if (redAdj[i].length > maxRedAdj) maxRedAdj = redAdj[i].length;
console.log('// Max red adjacency: ' + maxRedAdj);
console.log('#define MAX_RED_ADJ ' + maxRedAdj);
console.log('static const uint8_t red_adj_count[NUM_RED_DOTS] = {');
counts = [];
for (var i = 0; i < 42; i++) counts.push(redAdj[i].length);
console.log('  ' + counts.join(','));
console.log('};');
console.log('static const uint8_t red_adj_to[NUM_RED_DOTS][MAX_RED_ADJ] = {');
for (var i = 0; i < 42; i++) {
  var row = [];
  for (var j = 0; j < maxRedAdj; j++) row.push(j < redAdj[i].length ? redAdj[i][j].to : 0);
  console.log('  {' + row.join(',') + '},');
}
console.log('};');
console.log('static const uint8_t red_adj_crossing[NUM_RED_DOTS][MAX_RED_ADJ] = {');
for (var i = 0; i < 42; i++) {
  var row = [];
  for (var j = 0; j < maxRedAdj; j++) row.push(j < redAdj[i].length ? redAdj[i][j].crossing : 255);
  console.log('  {' + row.join(',') + '},');
}
console.log('};');
console.log('');

// Blue BFS sources (left boundary, col 0) and targets (right boundary, col n)
var blueSrc = [];
for (var x = 0; x < N; x++) blueSrc.push(x * (N + 1));
var blueTgt = [];
for (var x = 0; x < N; x++) blueTgt.push(x * (N + 1) + N);
console.log('static const uint8_t blue_bfs_src[N] = {' + blueSrc.join(',') + '};');
console.log('static const uint8_t blue_bfs_tgt[N] = {' + blueTgt.join(',') + '};');

// Red BFS sources (top boundary, row 0) and targets (bottom boundary, row n*n..n*n+n-1)
var redSrc = [];
for (var x = 0; x < N; x++) redSrc.push(x);
var redTgt = [];
for (var x = 0; x < N; x++) redTgt.push(N * N + x);
console.log('static const uint8_t red_bfs_src[N] = {' + redSrc.join(',') + '};');
console.log('static const uint8_t red_bfs_tgt[N] = {' + redTgt.join(',') + '};');
console.log('');

// rc_to_index lookup (for use in mapping partition sets)
console.log('// Crossing key "r,c" -> index mapping');
console.log('// Use: rc_to_crossing_idx[r][c] (only valid for playable cells)');
console.log('static const uint8_t rc_to_crossing_idx[' + (2*N+1) + '][' + (2*N+1) + '] = {');
for (var r = 0; r <= 2*N; r++) {
  var row = [];
  for (var c = 0; c <= 2*N; c++) {
    var key = g.k(r, c);
    row.push(rcToIdx[key] !== undefined ? rcToIdx[key] : 255);
  }
  console.log('  {' + row.join(',') + '},');
}
console.log('};');

// allRedCrossingEdges order (for partition computation)
var redCrossings = g.allRedCrossingEdges(N);
console.log('');
console.log('// allRedCrossingEdges order: ' + redCrossings.length + ' edges');
console.log('static const uint8_t red_crossing_order[NUM_CROSSINGS] = {');
var order = [];
for (var i = 0; i < redCrossings.length; i++) {
  var key = g.k(redCrossings[i][0], redCrossings[i][1]);
  order.push(rcToIdx[key]);
}
console.log('  ' + order.join(','));
console.log('};');

// allBlueCrossingEdges is same as allRedCrossingEdges
console.log('// allBlueCrossingEdges = allRedCrossingEdges (same order)');

// Blue boundary crossing indices for partition
console.log('');
console.log('// Blue boundary edge crossing coordinates');
console.log('static const uint8_t blue_bnd_rc[NUM_BLUE_BND][2] = {');
for (var i = 0; i < bnd.blue.length; i++) {
  var sep = i < bnd.blue.length - 1 ? ',' : '';
  console.log('  {' + bnd.blue[i][0] + ',' + bnd.blue[i][1] + '}' + sep);
}
console.log('};');
console.log('static const uint8_t red_bnd_rc[NUM_RED_BND][2] = {');
for (var i = 0; i < bnd.red.length; i++) {
  var sep = i < bnd.red.length - 1 ? ',' : '';
  console.log('  {' + bnd.red[i][0] + ',' + bnd.red[i][1] + '}' + sep);
}
console.log('};');
