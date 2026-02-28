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

/* ── Topology tables (generated from game.js) ── */

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

typedef struct { int min; int sum; } DistInfo;

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

  int minDist = INF, sumDist = 0;
  for (int i = 0; i < N; i++) {
    int d = dist[red_bfs_tgt[i]];
    if (d > 100) d = 100;
    if (d < minDist) minDist = d;
    sumDist += d;
  }
  return (DistInfo){minDist, sumDist};
}

/* ── Union-Find ── */

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

/* Multiple UF instances for simultaneous use */
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

/* ── qsort from stdlib ── */
void qsort(void *base, unsigned long nmemb, unsigned long size,
            int (*compar)(const void *, const void *));

/* ── Zobrist hashing ── */

static uint64_t zobrist_piece[NUM_CROSSINGS][2]; /* [crossing][0=RED, 1=BLUE] */
static uint64_t g_hash;

static uint64_t xorshift64_state;
static uint64_t xorshift64(void) {
  uint64_t x = xorshift64_state;
  x ^= x << 13;
  x ^= x >> 7;
  x ^= x << 17;
  xorshift64_state = x;
  return x;
}

/* ── Transposition table ── */

#define TT_SIZE 32768
#define TT_MASK (TT_SIZE - 1)
#define TT_EXACT 0
#define TT_LOWER 1
#define TT_UPPER 2

typedef struct {
  uint64_t key;
  int32_t score;
  uint8_t depth;
  uint8_t flag;
  uint8_t best_move;
  uint8_t pad;
} TTEntry;

static TTEntry tt_table[TT_SIZE];

/* ── Move ordering tables ── */

#define MAX_PLY 30
static uint8_t killers[MAX_PLY][2];
static uint32_t history[2][NUM_CROSSINGS]; /* [0=BLUE-1, 1=RED-1][crossing] */

/* ── Shared board for make/unmake ── */

static uint8_t g_board[NUM_CROSSINGS];

#define MAX_UNCLAIMED 61
#define WIN_SCORE 100000

/* ── Search state ── */

static double g_time_limit = 1200.0;
static double g_search_start;
static int g_aborted;
static int g_nodes;

/* Root move ordering from BFS pre-scoring */
typedef struct { uint8_t idx; int score; } RootMove;
static RootMove g_root_moves[MAX_UNCLAIMED];
static int g_root_num;

/* Root-computed priority for move ordering at all depths */
static int16_t g_blue_priority[NUM_CROSSINGS];
static int16_t g_red_priority[NUM_CROSSINGS];

static int cmp_root_desc(const void *a, const void *b) {
  int d = ((const RootMove*)b)->score - ((const RootMove*)a)->score;
  if (d) return d;
  return ((const RootMove*)a)->idx - ((const RootMove*)b)->idx;
}

/* ── Static evaluation ── */

static int static_eval(void) {
  int bd = blue_distance_to_win(g_board);
  if (bd == 0) return WIN_SCORE;
  int rd = red_distance_to_win(g_board);
  if (rd == 0) return -WIN_SCORE;
  DistInfo rdi = red_dist_info(g_board);
  int bdWeight = (rd <= 2) ? 400 : 200;
  int score = -bd * bdWeight + rdi.sum * 100 + rdi.min * 500;
  if (bd > 5) score -= (bd - 5) * 300;
  return score;
}

/* ── Make / unmake with Zobrist ── */

static void make_move(uint8_t ci, uint8_t side) {
  g_board[ci] = side;
  g_hash ^= zobrist_piece[ci][side - 1];
}

static void unmake_move(uint8_t ci) {
  uint8_t was = g_board[ci];
  g_board[ci] = EMPTY;
  g_hash ^= zobrist_piece[ci][was - 1];
}

/* ── Move generation + ordering ── */

typedef struct { uint8_t idx; int32_t key; } ScoredMove;

static int cmp_move_desc(const void *a, const void *b) {
  int d = ((const ScoredMove*)b)->key - ((const ScoredMove*)a)->key;
  if (d) return d;
  return ((const ScoredMove*)a)->idx - ((const ScoredMove*)b)->idx;
}

#define INNER_WIDTH 15
#define BFS_EVAL_PLY 2

static int generate_moves(ScoredMove *moves, uint8_t tt_move, int ply, int is_blue, int is_root) {
  int n = 0;
  int side_idx = is_blue ? 0 : 1;
  int16_t *priority = is_blue ? g_blue_priority : g_red_priority;

  int use_bfs = !is_root && ply < BFS_EVAL_PLY;
  uint8_t side = is_blue ? BLUE : RED;

  for (int i = 0; i < NUM_CROSSINGS; i++) {
    if (g_board[i] != EMPTY) continue;
    int key;
    if (i == tt_move) {
      key = 10000000;
    } else if (ply < MAX_PLY && (i == killers[ply][0] || i == killers[ply][1])) {
      key = 5000000;
    } else if (use_bfs) {
      g_board[i] = side;
      int dist = is_blue ? blue_distance_to_win(g_board) : red_distance_to_win(g_board);
      g_board[i] = EMPTY;
      key = (20 - dist) * 100000 + priority[i] * 100 + (int)history[side_idx][i];
    } else {
      key = priority[i] * 1000 + (int)history[side_idx][i];
    }
    moves[n++] = (ScoredMove){(uint8_t)i, key};
  }
  qsort(moves, n, sizeof(ScoredMove), cmp_move_desc);
  if (!is_root && n > INNER_WIDTH) {
    int keep = INNER_WIDTH;
    for (int i = INNER_WIDTH; i < n; i++)
      if (moves[i].key >= 5000000) keep = i + 1;
    n = keep;
  }
  return n;
}

/* ── Negamax with alpha-beta ── */

static int negamax(int depth, int alpha, int beta, int is_blue, int ply) {
  g_nodes++;
  if ((g_nodes & 1023) == 0) {
    if (emscripten_get_now() - g_search_start >= g_time_limit) {
      g_aborted = 1;
      return 0;
    }
  }

  int orig_alpha = alpha;

  /* TT probe */
  TTEntry *tte = &tt_table[g_hash & TT_MASK];
  uint8_t tt_move = 255;
  if (tte->key == g_hash && tte->depth >= (uint8_t)depth) {
    tt_move = tte->best_move;
    if (tte->flag == TT_EXACT) return tte->score;
    if (tte->flag == TT_LOWER && tte->score > alpha) alpha = tte->score;
    else if (tte->flag == TT_UPPER && tte->score < beta) beta = tte->score;
    if (alpha >= beta) return tte->score;
  } else if (tte->key == g_hash) {
    tt_move = tte->best_move;
  }

  /* Leaf evaluation */
  if (depth <= 0) {
    int s = static_eval();
    return is_blue ? s : -s;
  }

  /* Generate and order moves */
  ScoredMove moves[MAX_UNCLAIMED];
  int num_moves = generate_moves(moves, tt_move, ply, is_blue, 0);
  if (num_moves == 0) {
    int s = static_eval();
    return is_blue ? s : -s;
  }

  int best_score = -999999;
  uint8_t best_move = moves[0].idx;
  uint8_t side = is_blue ? BLUE : RED;

  for (int i = 0; i < num_moves; i++) {
    make_move(moves[i].idx, side);

    int score;
    if (i == 0) {
      score = -negamax(depth - 1, -beta, -alpha, !is_blue, ply + 1);
    } else {
      score = -negamax(depth - 1, -alpha - 1, -alpha, !is_blue, ply + 1);
      if (score > alpha && score < beta)
        score = -negamax(depth - 1, -beta, -alpha, !is_blue, ply + 1);
    }

    unmake_move(moves[i].idx);

    if (g_aborted) return 0;

    if (score > best_score) {
      best_score = score;
      best_move = moves[i].idx;
    }
    if (score > alpha) {
      alpha = score;
      if (alpha >= beta) {
        if (ply < MAX_PLY) {
          killers[ply][1] = killers[ply][0];
          killers[ply][0] = moves[i].idx;
        }
        int side_idx = is_blue ? 0 : 1;
        history[side_idx][moves[i].idx] += depth * depth;
        break;
      }
    }
  }

  /* TT store */
  uint8_t flag;
  if (best_score <= orig_alpha) flag = TT_UPPER;
  else if (best_score >= beta) flag = TT_LOWER;
  else flag = TT_EXACT;

  tte->key = g_hash;
  tte->score = best_score;
  tte->depth = (uint8_t)depth;
  tte->flag = flag;
  tte->best_move = best_move;

  return best_score;
}

/* ── Root search with pre-scored ordering ── */

static uint8_t g_best_root_move;
static int g_best_root_score;

static void root_search(int depth, int asp_alpha, int asp_beta) {
  int alpha = asp_alpha, beta = asp_beta;
  int best_score = -999999;
  uint8_t best_move = g_root_moves[0].idx;

  /* Use TT to reorder: move TT best to front */
  TTEntry *tte = &tt_table[g_hash & TT_MASK];
  if (tte->key == g_hash && tte->best_move != 255) {
    for (int i = 1; i < g_root_num; i++) {
      if (g_root_moves[i].idx == tte->best_move) {
        RootMove tmp = g_root_moves[i];
        for (int j = i; j > 0; j--) g_root_moves[j] = g_root_moves[j-1];
        g_root_moves[0] = tmp;
        break;
      }
    }
  }

  for (int i = 0; i < g_root_num; i++) {
    make_move(g_root_moves[i].idx, BLUE);

    int score;
    if (i == 0) {
      score = -negamax(depth - 1, -beta, -alpha, 0, 1);
    } else {
      score = -negamax(depth - 1, -alpha - 1, -alpha, 0, 1);
      if (score > alpha && score < beta)
        score = -negamax(depth - 1, -beta, -alpha, 0, 1);
    }

    unmake_move(g_root_moves[i].idx);

    if (g_aborted) return;

    if (score > best_score) {
      best_score = score;
      best_move = g_root_moves[i].idx;
    }
    if (score > alpha) alpha = score;
  }

  g_best_root_move = best_move;
  g_best_root_score = best_score;

  /* TT store for root */
  tte = &tt_table[g_hash & TT_MASK];
  tte->key = g_hash;
  tte->score = best_score;
  tte->depth = (uint8_t)depth;
  tte->flag = TT_EXACT;
  tte->best_move = best_move;
}

/* ── Iterative deepening ── */

static int g_last_depth;
static int g_last_nodes;

static int iterative_deepening(void) {
  g_search_start = emscripten_get_now();
  g_aborted = 0;
  g_nodes = 0;
  g_last_depth = 0;

  for (int i = 0; i < 2; i++)
    for (int j = 0; j < NUM_CROSSINGS; j++)
      history[i][j] >>= 2;
  memset(killers, 255, sizeof(killers));

  int best_move = g_root_moves[0].idx;

  for (int depth = 2; depth <= MAX_PLY; depth++) {
    root_search(depth, -999999, 999999);

    if (g_aborted) break;

    g_last_depth = depth;
    best_move = g_best_root_move;

    if (g_best_root_score > WIN_SCORE - 100 || g_best_root_score < -WIN_SCORE + 100)
      break;

    double elapsed = emscripten_get_now() - g_search_start;
    if (elapsed > g_time_limit * 0.6) break;
  }
  g_last_nodes = g_nodes;

  return best_move;
}

/* ── Compute initial hash from board state ── */

static void compute_hash(void) {
  g_hash = 0;
  for (int i = 0; i < NUM_CROSSINGS; i++) {
    if (g_board[i] == RED) g_hash ^= zobrist_piece[i][0];
    else if (g_board[i] == BLUE) g_hash ^= zobrist_piece[i][1];
  }
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

  /* Score all Blue candidates with BFS */
  typedef struct { uint8_t idx; int bd; int rdMin; int rdSum; int score; } BlueCandidate;
  BlueCandidate scored[MAX_UNCLAIMED];
  int numScored = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = BLUE;
    DistInfo rdi = red_dist_info(g_board);
    int bd = blue_distance_to_win(g_board);
    scored[numScored++] = (BlueCandidate){ci, bd, rdi.min, rdi.sum, 0};
    g_board[ci] = EMPTY;
  }

  /* Immediate win */
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd == 0) return scored[i].idx;

  /* Emergency: redDist <= 1 */
  if (redDist <= 1) {
    int bestScore = -999999, bestIdx = scored[0].idx;
    for (int i = 0; i < numScored; i++) {
      int s = scored[i].rdMin * 200 - scored[i].bd * 100;
      if (s > bestScore) { bestScore = s; bestIdx = scored[i].idx; }
    }
    return bestIdx;
  }

  /* Repair and gap-bridge detection */
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

  /* Build root move ordering from BFS scores + repair/gap-bridge bonuses */
  int repairBonus = (redDist - 1 < 4 ? redDist - 1 : 4) * 500;
  int gapBridgeBonus = (redDist - 1 < 4 ? redDist - 1 : 4) * 1250;
  g_root_num = 0;
  for (int i = 0; i < numScored; i++) {
    int s = -scored[i].bd * 200 + scored[i].rdSum * 100;
    if (repairSet[scored[i].idx]) s += repairBonus;
    if (gapBridgeSet[scored[i].idx]) s += gapBridgeBonus;
    g_root_moves[g_root_num++] = (RootMove){scored[i].idx, s};
  }
  qsort(g_root_moves, g_root_num, sizeof(RootMove), cmp_root_desc);

  /* Build Blue priority from root ordering (rank-based) */
  memset(g_blue_priority, 0, sizeof(g_blue_priority));
  for (int i = 0; i < g_root_num; i++)
    g_blue_priority[g_root_moves[i].idx] = (int16_t)(g_root_num - i);

  /* Build Red priority from Red BFS scoring */
  memset(g_red_priority, 0, sizeof(g_red_priority));
  {
    typedef struct { uint8_t idx; int score; } RedCand;
    RedCand redCands[MAX_UNCLAIMED];
    int nRed = 0;
    for (int i = 0; i < numUnclaimed; i++) {
      uint8_t ci = unclaimed[i];
      g_board[ci] = RED;
      int rrd = red_distance_to_win(g_board);
      int rbd = blue_distance_to_win(g_board);
      redCands[nRed++] = (RedCand){ci, -rrd * 200 + rbd * 100};
      g_board[ci] = EMPTY;
    }
    for (int i = 0; i < nRed; i++) {
      int rank = 1;
      for (int j = 0; j < nRed; j++)
        if (redCands[j].score > redCands[i].score) rank++;
      g_red_priority[redCands[i].idx] = (int16_t)(nRed + 1 - rank);
    }
  }

  compute_hash();
  return iterative_deepening();
}

/* ── Exported functions for JS ── */

__attribute__((used))
void wasm_init(void) {
  xorshift64_state = 0x12345678ABCDEF01ULL;
  for (int i = 0; i < NUM_CROSSINGS; i++) {
    zobrist_piece[i][0] = xorshift64();
    zobrist_piece[i][1] = xorshift64();
  }
  memset(tt_table, 0, sizeof(tt_table));
  memset(history, 0, sizeof(history));
}

__attribute__((used))
void wasm_set_time_limit(int ms) {
  g_time_limit = (double)ms;
}

__attribute__((used))
int wasm_get_last_depth(void) { return g_last_depth; }

__attribute__((used))
int wasm_get_last_nodes(void) { return g_last_nodes; }

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
