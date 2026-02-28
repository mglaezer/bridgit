#include <stdint.h>
#include <string.h>
#include <emscripten.h>

#define N 6
#define NUM_CROSSINGS 61
#define NUM_BLUE_DOTS 42
#define NUM_RED_DOTS 42
#define NUM_BLUE_BND 10
#define NUM_RED_BND 10
#define INF 127
#define EMPTY 0
#define RED 1
#define BLUE 2
#define MAX_UNCLAIMED 61

/* ── Topology tables (identical to bridgit_bot.c) ── */

static const uint8_t crossing_rc[NUM_CROSSINGS][2] = {
  {1,1},{1,3},{1,5},{1,7},{1,9},{1,11},
  {2,2},{2,4},{2,6},{2,8},{2,10},
  {3,1},{3,3},{3,5},{3,7},{3,9},{3,11},
  {4,2},{4,4},{4,6},{4,8},{4,10},
  {5,1},{5,3},{5,5},{5,7},{5,9},{5,11},
  {6,2},{6,4},{6,6},{6,8},{6,10},
  {7,1},{7,3},{7,5},{7,7},{7,9},{7,11},
  {8,2},{8,4},{8,6},{8,8},{8,10},
  {9,1},{9,3},{9,5},{9,7},{9,9},{9,11},
  {10,2},{10,4},{10,6},{10,8},{10,10},
  {11,1},{11,3},{11,5},{11,7},{11,9},{11,11}
};

static const uint8_t blue_ep[NUM_CROSSINGS][2] = {
  {0,1},{1,2},{2,3},{3,4},{4,5},{5,6},
  {1,8},{2,9},{3,10},{4,11},{5,12},
  {7,8},{8,9},{9,10},{10,11},{11,12},{12,13},
  {8,15},{9,16},{10,17},{11,18},{12,19},
  {14,15},{15,16},{16,17},{17,18},{18,19},{19,20},
  {15,22},{16,23},{17,24},{18,25},{19,26},
  {21,22},{22,23},{23,24},{24,25},{25,26},{26,27},
  {22,29},{23,30},{24,31},{25,32},{26,33},
  {28,29},{29,30},{30,31},{31,32},{32,33},{33,34},
  {29,36},{30,37},{31,38},{32,39},{33,40},
  {35,36},{36,37},{37,38},{38,39},{39,40},{40,41}
};

static const uint8_t red_ep[NUM_CROSSINGS][2] = {
  {0,6},{1,7},{2,8},{3,9},{4,10},{5,11},
  {6,7},{7,8},{8,9},{9,10},{10,11},
  {6,12},{7,13},{8,14},{9,15},{10,16},{11,17},
  {12,13},{13,14},{14,15},{15,16},{16,17},
  {12,18},{13,19},{14,20},{15,21},{16,22},{17,23},
  {18,19},{19,20},{20,21},{21,22},{22,23},
  {18,24},{19,25},{20,26},{21,27},{22,28},{23,29},
  {24,25},{25,26},{26,27},{27,28},{28,29},
  {24,30},{25,31},{26,32},{27,33},{28,34},{29,35},
  {30,31},{31,32},{32,33},{33,34},{34,35},
  {30,36},{31,37},{32,38},{33,39},{34,40},{35,41}
};

static const uint8_t blue_bnd_ep[NUM_BLUE_BND][2] = {
  {0,7},{6,13},{7,14},{13,20},{14,21},{20,27},{21,28},{27,34},{28,35},{34,41}
};

static const uint8_t red_bnd_ep[NUM_RED_BND][2] = {
  {0,1},{36,37},{1,2},{37,38},{2,3},{38,39},{3,4},{39,40},{4,5},{40,41}
};

#define MAX_BLUE_ADJ 4
static const uint8_t blue_adj_count[NUM_BLUE_DOTS] = {
  2,3,3,3,3,3,2,3,4,4,4,4,4,3,3,4,4,4,4,4,3,3,4,4,4,4,4,3,3,4,4,4,4,4,3,2,3,3,3,3,3,2
};
static const uint8_t blue_adj_to[NUM_BLUE_DOTS][MAX_BLUE_ADJ] = {
  {7,1,0,0},{0,2,8,0},{1,3,9,0},{2,4,10,0},{3,5,11,0},{4,6,12,0},{13,5,0,0},
  {0,14,8,0},{1,7,9,15},{2,8,10,16},{3,9,11,17},{4,10,12,18},{5,11,13,19},{6,20,12,0},
  {7,21,15,0},{8,14,16,22},{9,15,17,23},{10,16,18,24},{11,17,19,25},{12,18,20,26},{13,27,19,0},
  {14,28,22,0},{15,21,23,29},{16,22,24,30},{17,23,25,31},{18,24,26,32},{19,25,27,33},{20,34,26,0},
  {21,35,29,0},{22,28,30,36},{23,29,31,37},{24,30,32,38},{25,31,33,39},{26,32,34,40},{27,41,33,0},
  {28,36,0,0},{29,35,37,0},{30,36,38,0},{31,37,39,0},{32,38,40,0},{33,39,41,0},{34,40,0,0}
};
static const uint8_t blue_adj_crossing[NUM_BLUE_DOTS][MAX_BLUE_ADJ] = {
  {255,0,255,255},{0,1,6,255},{1,2,7,255},{2,3,8,255},{3,4,9,255},{4,5,10,255},{255,5,255,255},
  {255,255,11,255},{6,11,12,17},{7,12,13,18},{8,13,14,19},{9,14,15,20},{10,15,16,21},{255,255,16,255},
  {255,255,22,255},{17,22,23,28},{18,23,24,29},{19,24,25,30},{20,25,26,31},{21,26,27,32},{255,255,27,255},
  {255,255,33,255},{28,33,34,39},{29,34,35,40},{30,35,36,41},{31,36,37,42},{32,37,38,43},{255,255,38,255},
  {255,255,44,255},{39,44,45,50},{40,45,46,51},{41,46,47,52},{42,47,48,53},{43,48,49,54},{255,255,49,255},
  {255,55,255,255},{50,55,56,255},{51,56,57,255},{52,57,58,255},{53,58,59,255},{54,59,60,255},{255,60,255,255}
};

#define MAX_RED_ADJ 4
static const uint8_t red_adj_count[NUM_RED_DOTS] = {
  2,3,3,3,3,2,3,4,4,4,4,3,3,4,4,4,4,3,3,4,4,4,4,3,3,4,4,4,4,3,3,4,4,4,4,3,2,3,3,3,3,2
};
static const uint8_t red_adj_to[NUM_RED_DOTS][MAX_RED_ADJ] = {
  {1,6,0,0},{0,2,7,0},{1,3,8,0},{2,4,9,0},{3,5,10,0},{4,11,0,0},
  {0,7,12,0},{1,6,8,13},{2,7,9,14},{3,8,10,15},{4,9,11,16},{5,10,17,0},
  {6,13,18,0},{7,12,14,19},{8,13,15,20},{9,14,16,21},{10,15,17,22},{11,16,23,0},
  {12,19,24,0},{13,18,20,25},{14,19,21,26},{15,20,22,27},{16,21,23,28},{17,22,29,0},
  {18,25,30,0},{19,24,26,31},{20,25,27,32},{21,26,28,33},{22,27,29,34},{23,28,35,0},
  {24,31,36,0},{25,30,32,37},{26,31,33,38},{27,32,34,39},{28,33,35,40},{29,34,41,0},
  {37,30,0,0},{36,38,31,0},{37,39,32,0},{38,40,33,0},{39,41,34,0},{40,35,0,0}
};
static const uint8_t red_adj_crossing[NUM_RED_DOTS][MAX_RED_ADJ] = {
  {255,0,255,255},{255,255,1,255},{255,255,2,255},{255,255,3,255},{255,255,4,255},{255,5,255,255},
  {0,6,11,255},{1,6,7,12},{2,7,8,13},{3,8,9,14},{4,9,10,15},{5,10,16,255},
  {11,17,22,255},{12,17,18,23},{13,18,19,24},{14,19,20,25},{15,20,21,26},{16,21,27,255},
  {22,28,33,255},{23,28,29,34},{24,29,30,35},{25,30,31,36},{26,31,32,37},{27,32,38,255},
  {33,39,44,255},{34,39,40,45},{35,40,41,46},{36,41,42,47},{37,42,43,48},{38,43,49,255},
  {44,50,55,255},{45,50,51,56},{46,51,52,57},{47,52,53,58},{48,53,54,59},{49,54,60,255},
  {255,55,255,255},{255,255,56,255},{255,255,57,255},{255,255,58,255},{255,255,59,255},{255,60,255,255}
};

static const uint8_t blue_bfs_src[N] = {0,7,14,21,28,35};
static const uint8_t blue_bfs_tgt[N] = {6,13,20,27,34,41};
static const uint8_t red_bfs_src[N] = {0,1,2,3,4,5};
static const uint8_t red_bfs_tgt[N] = {36,37,38,39,40,41};

static const uint8_t red_crossing_order[NUM_CROSSINGS] = {
  6,7,8,9,10,17,18,19,20,21,28,29,30,31,32,39,40,41,42,43,50,51,52,53,54,
  0,1,2,3,4,5,11,12,13,14,15,16,22,23,24,25,26,27,33,34,35,36,37,38,44,45,46,47,48,49,55,56,57,58,59,60
};

/* ── 0-1 BFS ── */

#define DEQUE_SIZE 64
#define DEQUE_MASK 63

static int blue_distance_to_win(const uint8_t *board) {
  int8_t dist[NUM_BLUE_DOTS];
  memset(dist, INF, sizeof(dist));
  uint8_t deque[DEQUE_SIZE];
  int head = 0, tail = 0;

  for (int i = 0; i < N; i++) {
    dist[blue_bfs_src[i]] = 0;
    deque[tail++ & DEQUE_MASK] = blue_bfs_src[i];
  }

  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    int cnt = blue_adj_count[cur];
    for (int i = 0; i < cnt; i++) {
      uint8_t nb = blue_adj_to[cur][i];
      uint8_t ci = blue_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == RED) continue;
      else w = (board[ci] == BLUE) ? 0 : 1;
      int nd = dist[cur] + w;
      if (nd < dist[nb]) {
        dist[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  int minDist = INF;
  for (int i = 0; i < N; i++)
    if (dist[blue_bfs_tgt[i]] < minDist) minDist = dist[blue_bfs_tgt[i]];
  return minDist;
}

static int red_distance_to_win(const uint8_t *board) {
  int8_t dist[NUM_RED_DOTS];
  memset(dist, INF, sizeof(dist));
  uint8_t deque[DEQUE_SIZE];
  int head = 0, tail = 0;

  for (int i = 0; i < N; i++) {
    dist[red_bfs_src[i]] = 0;
    deque[tail++ & DEQUE_MASK] = red_bfs_src[i];
  }

  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    int cnt = red_adj_count[cur];
    for (int i = 0; i < cnt; i++) {
      uint8_t nb = red_adj_to[cur][i];
      uint8_t ci = red_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == BLUE) continue;
      else w = (board[ci] == RED) ? 0 : 1;
      int nd = dist[cur] + w;
      if (nd < dist[nb]) {
        dist[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  int minDist = INF;
  for (int i = 0; i < N; i++)
    if (dist[red_bfs_tgt[i]] < minDist) minDist = dist[red_bfs_tgt[i]];
  return minDist;
}

typedef struct { int32_t min; int32_t sum; } DistInfo;

static DistInfo red_dist_info(const uint8_t *board) {
  int8_t dist[NUM_RED_DOTS];
  memset(dist, INF, sizeof(dist));
  uint8_t deque[DEQUE_SIZE];
  int head = 0, tail = 0;

  for (int i = 0; i < N; i++) {
    dist[red_bfs_src[i]] = 0;
    deque[tail++ & DEQUE_MASK] = red_bfs_src[i];
  }

  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    int cnt = red_adj_count[cur];
    for (int i = 0; i < cnt; i++) {
      uint8_t nb = red_adj_to[cur][i];
      uint8_t ci = red_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == BLUE) continue;
      else w = (board[ci] == RED) ? 0 : 1;
      int nd = dist[cur] + w;
      if (nd < dist[nb]) {
        dist[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  int32_t minDist = INF, sumDist = 0;
  for (int i = 0; i < N; i++) {
    int32_t d = dist[red_bfs_tgt[i]];
    if (d > 100) d = 100;
    if (d < minDist) minDist = d;
    sumDist += d;
  }
  return (DistInfo){minDist, sumDist};
}

/* ── Union-Find (two instances) ── */

static uint8_t uf_parent[NUM_BLUE_DOTS];
static uint8_t uf_rank[NUM_BLUE_DOTS];

static void uf_init(int n) {
  for (int i = 0; i < n; i++) { uf_parent[i] = i; uf_rank[i] = 0; }
}

static uint8_t uf_find(uint8_t x) {
  while (uf_parent[x] != x) {
    uf_parent[x] = uf_parent[uf_parent[x]];
    x = uf_parent[x];
  }
  return x;
}

static int uf_union(uint8_t x, uint8_t y) {
  uint8_t rx = uf_find(x), ry = uf_find(y);
  if (rx == ry) return 0;
  if (uf_rank[rx] < uf_rank[ry]) { uint8_t t = rx; rx = ry; ry = t; }
  uf_parent[ry] = rx;
  if (uf_rank[rx] == uf_rank[ry]) uf_rank[rx]++;
  return 1;
}

static uint8_t uf2_parent[NUM_BLUE_DOTS];
static uint8_t uf2_rank[NUM_BLUE_DOTS];

static void uf2_init(int n) {
  for (int i = 0; i < n; i++) { uf2_parent[i] = i; uf2_rank[i] = 0; }
}

static uint8_t uf2_find(uint8_t x) {
  while (uf2_parent[x] != x) {
    uf2_parent[x] = uf2_parent[uf2_parent[x]];
    x = uf2_parent[x];
  }
  return x;
}

static int uf2_union(uint8_t x, uint8_t y) {
  uint8_t rx = uf2_find(x), ry = uf2_find(y);
  if (rx == ry) return 0;
  if (uf2_rank[rx] < uf2_rank[ry]) { uint8_t t = rx; rx = ry; ry = t; }
  uf2_parent[ry] = rx;
  if (uf2_rank[rx] == uf2_rank[ry]) uf2_rank[rx]++;
  return 1;
}

/* ── Partition & Graph Building ── */

static void recompute_blue_partition(const uint8_t *board, uint8_t *L, uint8_t *R) {
  memset(L, 0, NUM_CROSSINGS);
  memset(R, 0, NUM_CROSSINGS);
  uf_init(NUM_BLUE_DOTS);

  for (int i = 0; i < NUM_BLUE_BND; i++)
    uf_union(blue_bnd_ep[i][0], blue_bnd_ep[i][1]);

  for (int i = 0; i < NUM_CROSSINGS; i++) {
    uint8_t ci = red_crossing_order[i];
    if (board[ci] == RED) continue;
    uint8_t a = blue_ep[ci][0], b = blue_ep[ci][1];
    if (uf_find(a) != uf_find(b)) {
      uf_union(a, b);
      L[ci] = 1;
    } else {
      R[ci] = 1;
    }
  }
}

static int build_blue_graph_uf_and_count(
    const uint8_t *setA, const uint8_t *setB,
    const uint8_t *board) {
  uf_init(NUM_BLUE_DOTS);
  for (int i = 0; i < NUM_BLUE_BND; i++)
    uf_union(blue_bnd_ep[i][0], blue_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    int include = 0;
    if (setA[ci] && board[ci] != RED) include = 1;
    if (setB[ci] && board[ci] == BLUE) include = 1;
    if (include)
      uf_union(blue_ep[ci][0], blue_ep[ci][1]);
  }
  int roots = 0;
  uint8_t seen[NUM_BLUE_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_BLUE_DOTS; i++) {
    uint8_t r = uf_find(i);
    if (!seen[r]) { seen[r] = 1; roots++; }
  }
  return roots;
}

static void build_blue_graph_uf_into_uf2(
    const uint8_t *setA, const uint8_t *setB,
    const uint8_t *board) {
  uf2_init(NUM_BLUE_DOTS);
  for (int i = 0; i < NUM_BLUE_BND; i++)
    uf2_union(blue_bnd_ep[i][0], blue_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    int include = 0;
    if (setA[ci] && board[ci] != RED) include = 1;
    if (setB[ci] && board[ci] == BLUE) include = 1;
    if (include)
      uf2_union(blue_ep[ci][0], blue_ep[ci][1]);
  }
}

/* ── qsort declaration ── */
void qsort(void *base, unsigned long nmemb, unsigned long size,
            int (*compar)(const void *, const void *));

/* ── Global board state ── */

static uint8_t g_board[NUM_CROSSINGS];

/* ── Configurable beam-search parameters ── */

static int g_depth = 4;
static int g_base_widths[4] = {20, 4, 6, 4};
static int g_extra_widths[2] = {4, 3};

/* ── Candidate structure ── */

typedef struct {
  uint8_t idx;
  int32_t bd;
  int32_t rdMin;
  int32_t rdSum;
  int32_t score;
  int32_t minimax;
  int32_t finalScore;
} BlueCandidate;

typedef struct {
  uint8_t idx;
  int32_t score;
} RedCandidate;

static int cmp_blue_desc(const void *a, const void *b) {
  int32_t d = ((const BlueCandidate*)b)->score - ((const BlueCandidate*)a)->score;
  if (d > 0) return 1;
  if (d < 0) return -1;
  return (int)((const BlueCandidate*)a)->idx - (int)((const BlueCandidate*)b)->idx;
}

static int cmp_red_desc(const void *a, const void *b) {
  int32_t d = ((const RedCandidate*)b)->score - ((const RedCandidate*)a)->score;
  if (d > 0) return 1;
  if (d < 0) return -1;
  return (int)((const RedCandidate*)a)->idx - (int)((const RedCandidate*)b)->idx;
}

static int cmp_blue_by_bd(const void *a, const void *b) {
  int32_t d = ((const BlueCandidate*)a)->bd - ((const BlueCandidate*)b)->bd;
  if (d > 0) return 1;
  if (d < 0) return -1;
  return (int)((const BlueCandidate*)a)->idx - (int)((const BlueCandidate*)b)->idx;
}

static int cmp_blue_final_desc(const void *a, const void *b) {
  int32_t d = ((const BlueCandidate*)b)->finalScore - ((const BlueCandidate*)a)->finalScore;
  if (d > 0) return 1;
  if (d < 0) return -1;
  return (int)((const BlueCandidate*)a)->idx - (int)((const BlueCandidate*)b)->idx;
}

/* ── Main entry point ── */

__attribute__((used))
int wasm_computer_move(
    const uint8_t *board_in,
    const uint8_t *blueL_in,
    const uint8_t *blueR_in
) {
  memcpy(g_board, board_in, NUM_CROSSINGS);

  uint8_t unclaimed[MAX_UNCLAIMED];
  int numUnclaimed = 0;
  for (int i = 0; i < NUM_CROSSINGS; i++)
    if (g_board[i] == EMPTY) unclaimed[numUnclaimed++] = i;
  if (numUnclaimed == 0) return -1;

  int redDist = red_distance_to_win(g_board);

  /* Step 1: Pre-score all Blue candidates */
  BlueCandidate scored[MAX_UNCLAIMED];
  int numScored = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = BLUE;
    DistInfo rdi = red_dist_info(g_board);
    int32_t bd = blue_distance_to_win(g_board);
    scored[numScored++] = (BlueCandidate){ci, bd, rdi.min, rdi.sum, 0, 0, 0};
    g_board[ci] = EMPTY;
  }

  /* Step 2: Instant win */
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd == 0) return scored[i].idx;

  /* Step 2b: Emergency (redDist <= 1) */
  if (redDist <= 1) {
    int32_t bestScore = -999999;
    int bestIdx = scored[0].idx;
    for (int i = 0; i < numScored; i++) {
      int32_t s = scored[i].rdMin * 200 - scored[i].bd * 100;
      if (s > bestScore || (s == bestScore && scored[i].rdSum > scored[bestIdx == scored[0].idx ? 0 : i].rdSum)) {
        bestScore = s;
        bestIdx = scored[i].idx;
      }
    }
    return bestIdx;
  }

  /* Step 3: Repair & gap-bridge detection */
  int leftComp = build_blue_graph_uf_and_count(blueL_in, blueR_in, g_board);
  uint8_t leftUF_parent[NUM_BLUE_DOTS];
  memcpy(leftUF_parent, uf_parent, NUM_BLUE_DOTS);

  build_blue_graph_uf_into_uf2(blueR_in, blueL_in, g_board);
  int rightComp = 0;
  {
    uint8_t seen[NUM_BLUE_DOTS];
    memset(seen, 0, sizeof(seen));
    for (int i = 0; i < NUM_BLUE_DOTS; i++) {
      uint8_t r = uf2_find(i);
      if (!seen[r]) { seen[r] = 1; rightComp++; }
    }
  }

  uint8_t repairSet[NUM_CROSSINGS];
  memset(repairSet, 0, sizeof(repairSet));

  if (leftComp == 1 && rightComp > 1) {
    for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
      if (blueL_in[ci] && g_board[ci] == EMPTY) {
        uint8_t a = blue_ep[ci][0], b = blue_ep[ci][1];
        if (uf2_find(a) != uf2_find(b))
          repairSet[ci] = 1;
      }
    }
  } else if (rightComp == 1 && leftComp > 1) {
    memcpy(uf2_parent, leftUF_parent, NUM_BLUE_DOTS);
    for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
      if (blueR_in[ci] && g_board[ci] == EMPTY) {
        uint8_t a = blue_ep[ci][0], b = blue_ep[ci][1];
        if (uf2_find(a) != uf2_find(b))
          repairSet[ci] = 1;
      }
    }
    build_blue_graph_uf_into_uf2(blueR_in, blueL_in, g_board);
  }

  uint8_t gapBridgeSet[NUM_CROSSINGS];
  memset(gapBridgeSet, 0, sizeof(gapBridgeSet));
  if (leftComp == 1 && rightComp > 1) {
    uint8_t leftBndRoot = uf2_find(0);
    uint8_t rightBndRoot = uf2_find(N);
    if (leftBndRoot != rightBndRoot) {
      for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
        if (repairSet[ci]) {
          uint8_t a = blue_ep[ci][0], b = blue_ep[ci][1];
          uint8_t rootA = uf2_find(a), rootB = uf2_find(b);
          if ((rootA == leftBndRoot && rootB == rightBndRoot) ||
              (rootA == rightBndRoot && rootB == leftBndRoot))
            gapBridgeSet[ci] = 1;
        }
      }
    }
  }

  /* Step 4: Initial scoring + sort */
  int32_t repairBonus = (redDist - 1 < 4 ? redDist - 1 : 4) * 500;
  int32_t gapBridgeBonus = (redDist - 1 < 4 ? redDist - 1 : 4) * 1250;
  for (int i = 0; i < numScored; i++) {
    scored[i].score = -scored[i].bd * 200 + scored[i].rdSum * 100;
    if (repairSet[scored[i].idx]) scored[i].score += repairBonus;
    if (gapBridgeSet[scored[i].idx]) scored[i].score += gapBridgeBonus;
  }
  qsort(scored, numScored, sizeof(BlueCandidate), cmp_blue_desc);

  /* Step 4b: BD-advancer injection */
  int32_t bestBd = INF;
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd < bestBd) bestBd = scored[i].bd;

  int top20HasBdBest = 0;
  int top20Limit = numScored < 20 ? numScored : 20;
  for (int i = 0; i < top20Limit; i++)
    if (scored[i].bd == bestBd) { top20HasBdBest = 1; break; }

  int topN;
  if (!top20HasBdBest) {
    int injected = 0;
    BlueCandidate inject[3];
    for (int i = 20; i < numScored && injected < 3; i++)
      if (scored[i].bd == bestBd) inject[injected++] = scored[i];
    topN = top20Limit + injected;
    for (int i = 0; i < injected; i++)
      scored[top20Limit + i] = inject[i];
  } else {
    topN = top20Limit;
  }

  /* Step 5: Red priority computation */
  RedCandidate redPriority[MAX_UNCLAIMED];
  int numRed = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = RED;
    int32_t rrd = red_distance_to_win(g_board);
    int32_t rbd = blue_distance_to_win(g_board);
    redPriority[numRed++] = (RedCandidate){ci, -rrd * 200 + rbd * 100};
    g_board[ci] = EMPTY;
  }
  qsort(redPriority, numRed, sizeof(RedCandidate), cmp_red_desc);

  /* Step 6: Beam-search minimax */
  int blueW0 = topN < g_base_widths[0] ? topN : g_base_widths[0];
  if (blueW0 > topN) blueW0 = topN;
  int redW1 = numRed < g_base_widths[1] ? numRed : g_base_widths[1];
  int blueW2 = numScored < g_base_widths[2] ? numScored : g_base_widths[2];
  int redW3 = numRed < g_base_widths[3] ? numRed : g_base_widths[3];

  int32_t bdWeight = (redDist <= 2) ? 400 : 200;

  for (int i = 0; i < blueW0; i++) {
    g_board[scored[i].idx] = BLUE;
    int32_t worstD1 = 999999;

    /* Select top Red responses excluding Blue's move */
    uint8_t redTop[MAX_UNCLAIMED];
    int redTopN = 0;
    for (int j = 0; j < numRed && redTopN < redW1; j++)
      if (redPriority[j].idx != scored[i].idx)
        redTop[redTopN++] = redPriority[j].idx;

    if (g_depth < 4) {
      /* 2-ply: just evaluate after Blue's move */
      DistInfo rdi = red_dist_info(g_board);
      int32_t bd = blue_distance_to_win(g_board);
      int32_t s = -bd * bdWeight + rdi.sum * 100 + rdi.min * 500;
      if (bd > 5) s -= (bd - 5) * 300;
      scored[i].minimax = s;
      g_board[scored[i].idx] = EMPTY;
      continue;
    }

    for (int j = 0; j < redTopN; j++) {
      g_board[redTop[j]] = RED;
      int32_t bestD2 = -999999;

      if (g_depth < 6) {
        /* 4-ply: evaluate after Blue + Red */
        DistInfo rdi = red_dist_info(g_board);
        int32_t bd = blue_distance_to_win(g_board);
        int32_t s = -bd * bdWeight + rdi.sum * 100 + rdi.min * 500;
        if (bd > 5) s -= (bd - 5) * 300;
        bestD2 = s;
      } else {
        /* 6-ply: Blue follow-up + Red counter */
        /* Re-evaluate Blue candidates for ply 2 */
        BlueCandidate blueFollow[MAX_UNCLAIMED];
        int numFollow = 0;
        for (int m = 0; m < numScored; m++) {
          if (scored[m].idx != scored[i].idx && scored[m].idx != redTop[j]) {
            g_board[scored[m].idx] = BLUE;
            int32_t fbd = blue_distance_to_win(g_board);
            g_board[scored[m].idx] = EMPTY;
            blueFollow[numFollow] = scored[m];
            blueFollow[numFollow].bd = fbd;
            numFollow++;
          }
        }
        qsort(blueFollow, numFollow, sizeof(BlueCandidate), cmp_blue_by_bd);

        int blueTop2N = numFollow < blueW2 ? numFollow : blueW2;
        for (int m = 0; m < blueTop2N; m++) {
          g_board[blueFollow[m].idx] = BLUE;
          int32_t worstD2 = 999999;

          /* Select top Red counters excluding prior moves */
          uint8_t redTop2[MAX_UNCLAIMED];
          int redTop2N = 0;
          for (int q = 0; q < numRed && redTop2N < redW3; q++) {
            if (redPriority[q].idx != scored[i].idx &&
                redPriority[q].idx != redTop[j] &&
                redPriority[q].idx != blueFollow[m].idx)
              redTop2[redTop2N++] = redPriority[q].idx;
          }

          for (int q = 0; q < redTop2N; q++) {
            g_board[redTop2[q]] = RED;
            DistInfo rdi2 = red_dist_info(g_board);
            int32_t leafBd = blue_distance_to_win(g_board);
            int32_t s = -leafBd * bdWeight + rdi2.sum * 100 + rdi2.min * 500;
            if (leafBd > 5) s -= (leafBd - 5) * 300;
            if (s < worstD2) worstD2 = s;
            g_board[redTop2[q]] = EMPTY;
          }

          if (redTop2N == 0) {
            DistInfo rdi2 = red_dist_info(g_board);
            int32_t leafBd = blue_distance_to_win(g_board);
            worstD2 = -leafBd * bdWeight + rdi2.sum * 100 + rdi2.min * 500;
            if (leafBd > 5) worstD2 -= (leafBd - 5) * 300;
          }

          if (worstD2 > bestD2) bestD2 = worstD2;
          g_board[blueFollow[m].idx] = EMPTY;
        }

        if (blueTop2N == 0) {
          DistInfo rdi = red_dist_info(g_board);
          int32_t bd = blue_distance_to_win(g_board);
          bestD2 = -bd * bdWeight + rdi.sum * 100 + rdi.min * 500;
          if (bd > 5) bestD2 -= (bd - 5) * 300;
        }
      }

      if (bestD2 < worstD1) worstD1 = bestD2;
      g_board[redTop[j]] = EMPTY;
    }

    if (redTopN == 0) {
      DistInfo rdi = red_dist_info(g_board);
      int32_t bd = blue_distance_to_win(g_board);
      worstD1 = -bd * bdWeight + rdi.sum * 100 + rdi.min * 500;
      if (bd > 5) worstD1 -= (bd - 5) * 300;
    }

    scored[i].minimax = worstD1;
    g_board[scored[i].idx] = EMPTY;
  }

  /* Step 7: bdBias post-correction */
  for (int i = 0; i < blueW0; i++)
    scored[i].finalScore = scored[i].minimax - scored[i].bd * 300;

  qsort(scored, blueW0, sizeof(BlueCandidate), cmp_blue_final_desc);
  return scored[0].idx;
}

/* ── Exported configuration functions ── */

__attribute__((used))
void wasm_set_depth(int ply) {
  g_depth = ply;
}

__attribute__((used))
void wasm_set_base_widths(int w0, int w1, int w2, int w3) {
  g_base_widths[0] = w0;
  g_base_widths[1] = w1;
  g_base_widths[2] = w2;
  g_base_widths[3] = w3;
}

__attribute__((used))
void wasm_set_widths(int e0, int e1) {
  g_extra_widths[0] = e0;
  g_extra_widths[1] = e1;
}

__attribute__((used))
int wasm_blue_distance(const uint8_t *board) {
  return blue_distance_to_win(board);
}

__attribute__((used))
void wasm_red_dist_info(const uint8_t *board, int *out_min, int *out_sum) {
  DistInfo di = red_dist_info(board);
  *out_min = di.min;
  *out_sum = di.sum;
}
