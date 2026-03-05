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

static const uint8_t blue_crossing_order[NUM_CROSSINGS] = {
  0,1,2,3,4,5,11,12,13,14,15,16,22,23,24,25,26,27,33,34,35,36,37,38,44,45,46,47,48,49,55,56,57,58,59,60,
  6,7,8,9,10,17,18,19,20,21,28,29,30,31,32,39,40,41,42,43,50,51,52,53,54
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

static int blue_path_width(const uint8_t *board, int bd) {
  if (bd <= 0 || bd >= INF) return 0;

  int8_t dist_l[NUM_BLUE_DOTS];
  memset(dist_l, INF, sizeof(dist_l));
  uint8_t deque[DEQUE_SIZE];
  int head = 0, tail = 0;
  for (int i = 0; i < N; i++) {
    dist_l[blue_bfs_src[i]] = 0;
    deque[tail++ & DEQUE_MASK] = blue_bfs_src[i];
  }
  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    for (int i = 0; i < blue_adj_count[cur]; i++) {
      uint8_t nb = blue_adj_to[cur][i];
      uint8_t ci = blue_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == RED) continue;
      else w = (board[ci] == BLUE) ? 0 : 1;
      int nd = dist_l[cur] + w;
      if (nd < dist_l[nb]) {
        dist_l[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  int8_t dist_r[NUM_BLUE_DOTS];
  memset(dist_r, INF, sizeof(dist_r));
  head = 0; tail = 0;
  for (int i = 0; i < N; i++) {
    dist_r[blue_bfs_tgt[i]] = 0;
    deque[tail++ & DEQUE_MASK] = blue_bfs_tgt[i];
  }
  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    for (int i = 0; i < blue_adj_count[cur]; i++) {
      uint8_t nb = blue_adj_to[cur][i];
      uint8_t ci = blue_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == RED) continue;
      else w = (board[ci] == BLUE) ? 0 : 1;
      int nd = dist_r[cur] + w;
      if (nd < dist_r[nb]) {
        dist_r[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  uint8_t on_path[NUM_CROSSINGS];
  memset(on_path, 0, sizeof(on_path));
  for (int d = 0; d < NUM_BLUE_DOTS; d++) {
    for (int i = 0; i < blue_adj_count[d]; i++) {
      uint8_t nb = blue_adj_to[d][i];
      uint8_t ci = blue_adj_crossing[d][i];
      if (ci == 255 || board[ci] != EMPTY) continue;
      if (dist_l[d] + 1 + dist_r[nb] == bd) on_path[ci] = 1;
    }
  }

  int count = 0;
  for (int i = 0; i < NUM_CROSSINGS; i++) count += on_path[i];
  return count;
}

typedef struct { int32_t bd; int32_t pw; } BlueBdPw;

static BlueBdPw blue_bd_pw(const uint8_t *board) {
  int8_t dist_l[NUM_BLUE_DOTS];
  memset(dist_l, INF, sizeof(dist_l));
  uint8_t deque[DEQUE_SIZE];
  int head = 0, tail = 0;
  for (int i = 0; i < N; i++) {
    dist_l[blue_bfs_src[i]] = 0;
    deque[tail++ & DEQUE_MASK] = blue_bfs_src[i];
  }
  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    for (int i = 0; i < blue_adj_count[cur]; i++) {
      uint8_t nb = blue_adj_to[cur][i];
      uint8_t ci = blue_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == RED) continue;
      else w = (board[ci] == BLUE) ? 0 : 1;
      int nd = dist_l[cur] + w;
      if (nd < dist_l[nb]) {
        dist_l[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }
  int bd = INF;
  for (int i = 0; i < N; i++)
    if (dist_l[blue_bfs_tgt[i]] < bd) bd = dist_l[blue_bfs_tgt[i]];
  if (bd <= 0 || bd >= INF) return (BlueBdPw){bd, 0};

  int8_t dist_r[NUM_BLUE_DOTS];
  memset(dist_r, INF, sizeof(dist_r));
  head = 0; tail = 0;
  for (int i = 0; i < N; i++) {
    dist_r[blue_bfs_tgt[i]] = 0;
    deque[tail++ & DEQUE_MASK] = blue_bfs_tgt[i];
  }
  while (head != tail) {
    uint8_t cur = deque[head++ & DEQUE_MASK];
    for (int i = 0; i < blue_adj_count[cur]; i++) {
      uint8_t nb = blue_adj_to[cur][i];
      uint8_t ci = blue_adj_crossing[cur][i];
      int w;
      if (ci == 255) w = 0;
      else if (board[ci] == RED) continue;
      else w = (board[ci] == BLUE) ? 0 : 1;
      int nd = dist_r[cur] + w;
      if (nd < dist_r[nb]) {
        dist_r[nb] = nd;
        if (w == 0) deque[--head & DEQUE_MASK] = nb;
        else deque[tail++ & DEQUE_MASK] = nb;
      }
    }
  }

  int pw = 0;
  for (int d = 0; d < NUM_BLUE_DOTS; d++) {
    for (int i = 0; i < blue_adj_count[d]; i++) {
      uint8_t nb = blue_adj_to[d][i];
      uint8_t ci = blue_adj_crossing[d][i];
      if (ci == 255 || board[ci] != EMPTY) continue;
      if (dist_l[d] + 1 + dist_r[nb] == bd) pw++;
    }
  }
  return (BlueBdPw){bd, pw};
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

typedef struct { int32_t min; int32_t sum; int32_t threats; } DistInfo;

static DistInfo blue_dist_info(const uint8_t *board) {
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

  int32_t minDist = INF, sumDist = 0;
  for (int i = 0; i < N; i++) {
    int32_t d = dist[blue_bfs_tgt[i]];
    if (d > 100) d = 100;
    if (d < minDist) minDist = d;
    sumDist += d;
  }
  int32_t threats = 0;
  for (int i = 0; i < N; i++) {
    int32_t d = dist[blue_bfs_tgt[i]];
    if (d <= minDist + 1) threats++;
  }
  return (DistInfo){minDist, sumDist, threats};
}

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
  int32_t threats = 0;
  for (int i = 0; i < N; i++) {
    int32_t d = dist[red_bfs_tgt[i]];
    if (d <= minDist + 1) threats++;
  }
  return (DistInfo){minDist, sumDist, threats};
}

/* ── Electrical resistance evaluation ── */

static uint8_t res_find(uint8_t *p, uint8_t x) {
  while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
  return x;
}

static void res_union(uint8_t *p, uint8_t x, uint8_t y) {
  x = res_find(p, x); y = res_find(p, y);
  if (x != y) p[y] = x;
}

#define GS_ITERATIONS 15
#define MAX_RESISTANCE 100.0f

static float blue_resistance(const uint8_t *board) {
  uint8_t par[NUM_BLUE_DOTS];
  for (int i = 0; i < NUM_BLUE_DOTS; i++) par[i] = i;

  for (int i = 0; i < NUM_BLUE_BND; i++)
    res_union(par, blue_bnd_ep[i][0], blue_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++)
    if (board[ci] == BLUE)
      res_union(par, blue_ep[ci][0], blue_ep[ci][1]);

  uint8_t src = res_find(par, 0);
  uint8_t snk = res_find(par, N);
  if (src == snk) return 0.0f;

  uint8_t ea[NUM_CROSSINGS], eb[NUM_CROSSINGS];
  int ne = 0;
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    if (board[ci] != EMPTY) continue;
    uint8_t ra = res_find(par, blue_ep[ci][0]);
    uint8_t rb = res_find(par, blue_ep[ci][1]);
    if (ra != rb) { ea[ne] = ra; eb[ne] = rb; ne++; }
  }
  if (ne == 0) return MAX_RESISTANCE;

  uint8_t roots[NUM_BLUE_DOTS];
  int nroots = 0;
  uint8_t seen[NUM_BLUE_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_BLUE_DOTS; i++) {
    uint8_t r = res_find(par, i);
    if (!seen[r]) { seen[r] = 1; roots[nroots++] = r; }
  }

  float v[NUM_BLUE_DOTS];
  memset(v, 0, sizeof(v));
  v[src] = 1.0f;
  for (int ri = 0; ri < nroots; ri++)
    if (roots[ri] != src && roots[ri] != snk) v[roots[ri]] = 0.5f;

  for (int iter = 0; iter < GS_ITERATIONS; iter++) {
    for (int ri = 0; ri < nroots; ri++) {
      uint8_t r = roots[ri];
      if (r == src || r == snk) continue;
      float sum_cv = 0.0f, sum_c = 0.0f;
      for (int e = 0; e < ne; e++) {
        if (ea[e] == r) { sum_cv += v[eb[e]]; sum_c += 1.0f; }
        else if (eb[e] == r) { sum_cv += v[ea[e]]; sum_c += 1.0f; }
      }
      if (sum_c > 0.0f) v[r] = sum_cv / sum_c;
    }
  }

  float current = 0.0f;
  for (int e = 0; e < ne; e++) {
    if (ea[e] == src) current += v[src] - v[eb[e]];
    else if (eb[e] == src) current += v[src] - v[ea[e]];
  }

  if (current < 0.001f) return MAX_RESISTANCE;
  return 1.0f / current;
}

static float red_resistance(const uint8_t *board) {
  uint8_t par[NUM_RED_DOTS];
  for (int i = 0; i < NUM_RED_DOTS; i++) par[i] = i;

  for (int i = 0; i < NUM_RED_BND; i++)
    res_union(par, red_bnd_ep[i][0], red_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++)
    if (board[ci] == RED)
      res_union(par, red_ep[ci][0], red_ep[ci][1]);

  uint8_t src = res_find(par, 0);
  uint8_t snk = res_find(par, 36);
  if (src == snk) return 0.0f;

  uint8_t ea[NUM_CROSSINGS], eb[NUM_CROSSINGS];
  int ne = 0;
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    if (board[ci] != EMPTY) continue;
    uint8_t ra = res_find(par, red_ep[ci][0]);
    uint8_t rb = res_find(par, red_ep[ci][1]);
    if (ra != rb) { ea[ne] = ra; eb[ne] = rb; ne++; }
  }
  if (ne == 0) return MAX_RESISTANCE;

  uint8_t roots[NUM_RED_DOTS];
  int nroots = 0;
  uint8_t seen[NUM_RED_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_RED_DOTS; i++) {
    uint8_t r = res_find(par, i);
    if (!seen[r]) { seen[r] = 1; roots[nroots++] = r; }
  }

  float v[NUM_RED_DOTS];
  memset(v, 0, sizeof(v));
  v[src] = 1.0f;
  for (int ri = 0; ri < nroots; ri++)
    if (roots[ri] != src && roots[ri] != snk) v[roots[ri]] = 0.5f;

  for (int iter = 0; iter < GS_ITERATIONS; iter++) {
    for (int ri = 0; ri < nroots; ri++) {
      uint8_t r = roots[ri];
      if (r == src || r == snk) continue;
      float sum_cv = 0.0f, sum_c = 0.0f;
      for (int e = 0; e < ne; e++) {
        if (ea[e] == r) { sum_cv += v[eb[e]]; sum_c += 1.0f; }
        else if (eb[e] == r) { sum_cv += v[ea[e]]; sum_c += 1.0f; }
      }
      if (sum_c > 0.0f) v[r] = sum_cv / sum_c;
    }
  }

  float current = 0.0f;
  for (int e = 0; e < ne; e++) {
    if (ea[e] == src) current += v[src] - v[eb[e]];
    else if (eb[e] == src) current += v[src] - v[ea[e]];
  }

  if (current < 0.001f) return MAX_RESISTANCE;
  return 1.0f / current;
}

static void blue_voltage_drops(const uint8_t *board, float *drops) {
  memset(drops, 0, NUM_CROSSINGS * sizeof(float));
  uint8_t par[NUM_BLUE_DOTS];
  for (int i = 0; i < NUM_BLUE_DOTS; i++) par[i] = i;
  for (int i = 0; i < NUM_BLUE_BND; i++)
    res_union(par, blue_bnd_ep[i][0], blue_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++)
    if (board[ci] == BLUE)
      res_union(par, blue_ep[ci][0], blue_ep[ci][1]);
  uint8_t src = res_find(par, 0);
  uint8_t snk = res_find(par, N);
  if (src == snk) return;
  uint8_t ea[NUM_CROSSINGS], eb[NUM_CROSSINGS], eci[NUM_CROSSINGS];
  int ne = 0;
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    if (board[ci] != EMPTY) continue;
    uint8_t ra = res_find(par, blue_ep[ci][0]);
    uint8_t rb = res_find(par, blue_ep[ci][1]);
    if (ra != rb) { ea[ne] = ra; eb[ne] = rb; eci[ne] = ci; ne++; }
  }
  if (ne == 0) return;
  uint8_t roots[NUM_BLUE_DOTS];
  int nroots = 0;
  uint8_t seen[NUM_BLUE_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_BLUE_DOTS; i++) {
    uint8_t r = res_find(par, i);
    if (!seen[r]) { seen[r] = 1; roots[nroots++] = r; }
  }
  float v[NUM_BLUE_DOTS];
  memset(v, 0, sizeof(v));
  v[src] = 1.0f;
  for (int ri = 0; ri < nroots; ri++)
    if (roots[ri] != src && roots[ri] != snk) v[roots[ri]] = 0.5f;
  for (int iter = 0; iter < GS_ITERATIONS; iter++) {
    for (int ri = 0; ri < nroots; ri++) {
      uint8_t r = roots[ri];
      if (r == src || r == snk) continue;
      float sum_cv = 0.0f, sum_c = 0.0f;
      for (int e = 0; e < ne; e++) {
        if (ea[e] == r) { sum_cv += v[eb[e]]; sum_c += 1.0f; }
        else if (eb[e] == r) { sum_cv += v[ea[e]]; sum_c += 1.0f; }
      }
      if (sum_c > 0.0f) v[r] = sum_cv / sum_c;
    }
  }
  for (int e = 0; e < ne; e++) {
    float vd = v[ea[e]] - v[eb[e]];
    if (vd < 0) vd = -vd;
    drops[eci[e]] = vd;
  }
}

static void red_voltage_drops(const uint8_t *board, float *drops) {
  memset(drops, 0, NUM_CROSSINGS * sizeof(float));
  uint8_t par[NUM_RED_DOTS];
  for (int i = 0; i < NUM_RED_DOTS; i++) par[i] = i;
  for (int i = 0; i < NUM_RED_BND; i++)
    res_union(par, red_bnd_ep[i][0], red_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++)
    if (board[ci] == RED)
      res_union(par, red_ep[ci][0], red_ep[ci][1]);
  uint8_t src = res_find(par, 0);
  uint8_t snk = res_find(par, 36);
  if (src == snk) return;
  uint8_t ea[NUM_CROSSINGS], eb[NUM_CROSSINGS], eci[NUM_CROSSINGS];
  int ne = 0;
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    if (board[ci] != EMPTY) continue;
    uint8_t ra = res_find(par, red_ep[ci][0]);
    uint8_t rb = res_find(par, red_ep[ci][1]);
    if (ra != rb) { ea[ne] = ra; eb[ne] = rb; eci[ne] = ci; ne++; }
  }
  if (ne == 0) return;
  uint8_t roots[NUM_RED_DOTS];
  int nroots = 0;
  uint8_t seen[NUM_RED_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_RED_DOTS; i++) {
    uint8_t r = res_find(par, i);
    if (!seen[r]) { seen[r] = 1; roots[nroots++] = r; }
  }
  float v[NUM_RED_DOTS];
  memset(v, 0, sizeof(v));
  v[src] = 1.0f;
  for (int ri = 0; ri < nroots; ri++)
    if (roots[ri] != src && roots[ri] != snk) v[roots[ri]] = 0.5f;
  for (int iter = 0; iter < GS_ITERATIONS; iter++) {
    for (int ri = 0; ri < nroots; ri++) {
      uint8_t r = roots[ri];
      if (r == src || r == snk) continue;
      float sum_cv = 0.0f, sum_c = 0.0f;
      for (int e = 0; e < ne; e++) {
        if (ea[e] == r) { sum_cv += v[eb[e]]; sum_c += 1.0f; }
        else if (eb[e] == r) { sum_cv += v[ea[e]]; sum_c += 1.0f; }
      }
      if (sum_c > 0.0f) v[r] = sum_cv / sum_c;
    }
  }
  for (int e = 0; e < ne; e++) {
    float vd = v[ea[e]] - v[eb[e]];
    if (vd < 0) vd = -vd;
    drops[eci[e]] = vd;
  }
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

/* ── Red partition & graph building (mirrors Blue) ── */

static void recompute_red_partition(const uint8_t *board, uint8_t *L, uint8_t *R) {
  memset(L, 0, NUM_CROSSINGS);
  memset(R, 0, NUM_CROSSINGS);
  uf_init(NUM_RED_DOTS);

  for (int i = 0; i < NUM_RED_BND; i++)
    uf_union(red_bnd_ep[i][0], red_bnd_ep[i][1]);

  for (int i = 0; i < NUM_CROSSINGS; i++) {
    uint8_t ci = blue_crossing_order[i];
    if (board[ci] == BLUE) continue;
    uint8_t a = red_ep[ci][0], b = red_ep[ci][1];
    if (uf_find(a) != uf_find(b)) {
      uf_union(a, b);
      L[ci] = 1;
    } else {
      R[ci] = 1;
    }
  }
}

static int build_red_graph_uf_and_count(
    const uint8_t *setA, const uint8_t *setB,
    const uint8_t *board) {
  uf_init(NUM_RED_DOTS);
  for (int i = 0; i < NUM_RED_BND; i++)
    uf_union(red_bnd_ep[i][0], red_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    int include = 0;
    if (setA[ci] && board[ci] != BLUE) include = 1;
    if (setB[ci] && board[ci] == RED) include = 1;
    if (include)
      uf_union(red_ep[ci][0], red_ep[ci][1]);
  }
  int roots = 0;
  uint8_t seen[NUM_RED_DOTS];
  memset(seen, 0, sizeof(seen));
  for (int i = 0; i < NUM_RED_DOTS; i++) {
    uint8_t r = uf_find(i);
    if (!seen[r]) { seen[r] = 1; roots++; }
  }
  return roots;
}

static void build_red_graph_uf_into_uf2(
    const uint8_t *setA, const uint8_t *setB,
    const uint8_t *board) {
  uf2_init(NUM_RED_DOTS);
  for (int i = 0; i < NUM_RED_BND; i++)
    uf2_union(red_bnd_ep[i][0], red_bnd_ep[i][1]);
  for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
    int include = 0;
    if (setA[ci] && board[ci] != BLUE) include = 1;
    if (setB[ci] && board[ci] == RED) include = 1;
    if (include)
      uf2_union(red_ep[ci][0], red_ep[ci][1]);
  }
}

/* ── qsort declaration ── */
void qsort(void *base, unsigned long nmemb, unsigned long size,
            int (*compar)(const void *, const void *));

/* ── Global board state ── */

static uint8_t g_board[NUM_CROSSINGS];

/* ── Configurable beam-search parameters ── */

static int g_depth = 4;
static int g_base_widths[4] = {61, 4, 6, 4};
static int g_extra_widths[2] = {4, 3};
static int g_extra2_widths[2] = {6, 4};
static int g_red_variant = 0;
static float g_eval_noise = 0.0f;
static uint32_t eval_rng_state = 12345;
static int32_t g_last_score = 0;
static int g_use_resistance = 0;
static float g_red_w = 2000.0f;
static float g_blue_w = 1000.0f;

static float eval_rng_float(void) {
  eval_rng_state = eval_rng_state * 1664525u + 1013904223u;
  return (float)(eval_rng_state >> 8) / 16777216.0f;
}

/* ── Neural network leaf evaluator ── */

#define NN_H1 128
#define NN_H2 64
#define NN_IN 63

static float nn_w1[NN_IN * NN_H1];
static float nn_b1[NN_H1];
static float nn_w2[NN_H1 * NN_H2];
static float nn_b2[NN_H2];
static float nn_w3[NN_H2];
static float nn_b3[1];
static int g_use_nn = 0;

static int32_t nn_eval(const uint8_t *board, int rd, int bd) {
  float input[NN_IN];
  for (int i = 0; i < NUM_CROSSINGS; i++) {
    if (board[i] == RED) input[i] = 1.0f;
    else if (board[i] == BLUE) input[i] = -1.0f;
    else input[i] = 0.0f;
  }
  input[61] = (float)rd * 0.1f;
  input[62] = (float)bd * 0.1f;

  float h1[NN_H1];
  for (int j = 0; j < NN_H1; j++) {
    float sum = nn_b1[j];
    for (int i = 0; i < NN_IN; i++)
      sum += input[i] * nn_w1[i * NN_H1 + j];
    h1[j] = sum > 0.0f ? sum : 0.0f;
  }

  float h2[NN_H2];
  for (int j = 0; j < NN_H2; j++) {
    float sum = nn_b2[j];
    for (int i = 0; i < NN_H1; i++)
      sum += h1[i] * nn_w2[i * NN_H2 + j];
    h2[j] = sum > 0.0f ? sum : 0.0f;
  }

  float out = nn_b3[0];
  for (int i = 0; i < NN_H2; i++)
    out += h2[i] * nn_w3[i];

  return (int32_t)(out * 10000.0f);
}

/* ── Softmin: weighted average with halving weights ── */

static int cmp_int32_asc(const void *a, const void *b) {
  int32_t va = *(const int32_t*)a, vb = *(const int32_t*)b;
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

static int32_t array_min(int32_t *scores, int n) {
  int32_t m = scores[0];
  for (int i = 1; i < n; i++)
    if (scores[i] < m) m = scores[i];
  return m;
}

/* ── Candidate structure ── */

typedef struct {
  uint8_t idx;
  int32_t bd;
  int32_t rdMin;
  int32_t rdSum;
  int32_t pathWidth;
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

/* ── Endgame exact solver ── */

#define ENDGAME_THRESHOLD 14

static int exact_solve(int is_blue_turn, int alpha, int beta) {
  uint8_t moves[MAX_UNCLAIMED];
  int numMoves = 0;
  for (int i = 0; i < NUM_CROSSINGS; i++)
    if (g_board[i] == EMPTY) moves[numMoves++] = i;

  if (numMoves == 0) return 0;

  if (is_blue_turn) {
    int32_t bd_ord[MAX_UNCLAIMED];
    for (int i = 0; i < numMoves; i++) {
      g_board[moves[i]] = BLUE;
      bd_ord[i] = blue_distance_to_win(g_board);
      g_board[moves[i]] = EMPTY;
    }
    for (int i = 0; i < numMoves - 1; i++) {
      int best = i;
      for (int j = i + 1; j < numMoves; j++)
        if (bd_ord[j] < bd_ord[best]) best = j;
      if (best != i) {
        uint8_t tm = moves[i]; moves[i] = moves[best]; moves[best] = tm;
        int32_t tv = bd_ord[i]; bd_ord[i] = bd_ord[best]; bd_ord[best] = tv;
      }
    }

    int val = -1;
    for (int i = 0; i < numMoves; i++) {
      g_board[moves[i]] = BLUE;
      int v;
      if (bd_ord[i] == 0) v = 1;
      else v = exact_solve(0, alpha, beta);
      g_board[moves[i]] = EMPTY;
      if (v > val) val = v;
      if (val > alpha) alpha = val;
      if (alpha >= beta) break;
    }
    return val;
  } else {
    int val = 1;
    for (int i = 0; i < numMoves; i++) {
      g_board[moves[i]] = RED;
      int v;
      if (red_distance_to_win(g_board) == 0) v = -1;
      else v = exact_solve(1, alpha, beta);
      g_board[moves[i]] = EMPTY;
      if (v < val) val = v;
      if (val < beta) beta = val;
      if (alpha >= beta) break;
    }
    return val;
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

  /* First-move: among crossings adjacent to Red's opening (sharing a Red
     dot), play the one that maximizes Red's BFS distance, with center
     tiebreak */
  if (numUnclaimed == 60 && g_use_resistance) {
    int redCi = -1;
    for (int ci = 0; ci < NUM_CROSSINGS; ci++)
      if (g_board[ci] == RED) { redCi = ci; break; }

    uint8_t dotA = red_ep[redCi][0], dotB = red_ep[redCi][1];

    int bestIdx = -1;
    int32_t bestRd = -1;
    int bestCdist = 9999;
    for (int i = 0; i < numUnclaimed; i++) {
      uint8_t ci = unclaimed[i];
      if (red_ep[ci][0] != dotA && red_ep[ci][1] != dotA &&
          red_ep[ci][0] != dotB && red_ep[ci][1] != dotB)
        continue;
      g_board[ci] = BLUE;
      int32_t rd = red_distance_to_win(g_board);
      g_board[ci] = EMPTY;
      int dr = crossing_rc[ci][0] - (N+1);
      int dc = crossing_rc[ci][1] - (N+1);
      int cdist = dr * dr + dc * dc;
      if (rd > bestRd || (rd == bestRd && cdist < bestCdist)) {
        bestRd = rd;
        bestCdist = cdist;
        bestIdx = ci;
      }
    }
    if (bestIdx < 0) bestIdx = unclaimed[0];
    g_last_score = 1000;
    return bestIdx;
  }

  int origDepth = g_depth;

  int redDist = red_distance_to_win(g_board);

  float blue_vd[NUM_CROSSINGS], red_vd[NUM_CROSSINGS];
  if (g_use_resistance) {
    blue_voltage_drops(g_board, blue_vd);
    red_voltage_drops(g_board, red_vd);
  }

  /* Step 1: Pre-score all Blue candidates */
  BlueCandidate scored[MAX_UNCLAIMED];
  int numScored = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = BLUE;
    DistInfo rdi = red_dist_info(g_board);
    int32_t bd = blue_distance_to_win(g_board);
    int32_t pw = 0;
    if (g_use_resistance) {
      pw = (int32_t)(red_vd[ci] * g_red_w + blue_vd[ci] * g_blue_w);
    }
    scored[numScored++] = (BlueCandidate){ci, bd, rdi.min, rdi.sum, pw, 0, 0, 0};
    g_board[ci] = EMPTY;
  }


  /* Step 2: Instant win */
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd == 0) { g_last_score = 999999; return scored[i].idx; }

  /* Step 2a: Endgame exact solver */
  if (numUnclaimed <= ENDGAME_THRESHOLD) {
    uint8_t eg_moves[MAX_UNCLAIMED];
    int32_t eg_bd[MAX_UNCLAIMED];
    int eg_n = 0;
    for (int i = 0; i < numScored; i++) {
      eg_moves[eg_n] = scored[i].idx;
      eg_bd[eg_n] = scored[i].bd;
      eg_n++;
    }
    for (int i = 0; i < eg_n - 1; i++) {
      int best = i;
      for (int j = i + 1; j < eg_n; j++)
        if (eg_bd[j] < eg_bd[best]) best = j;
      if (best != i) {
        uint8_t tm = eg_moves[i]; eg_moves[i] = eg_moves[best]; eg_moves[best] = tm;
        int32_t tv = eg_bd[i]; eg_bd[i] = eg_bd[best]; eg_bd[best] = tv;
      }
    }
    for (int i = 0; i < eg_n; i++) {
      g_board[eg_moves[i]] = BLUE;
      int v;
      if (eg_bd[i] == 0) v = 1;
      else v = exact_solve(0, -1, 1);
      g_board[eg_moves[i]] = EMPTY;
      if (v == 1) { g_last_score = 999999; return eg_moves[i]; }
    }
  }

  /* Step 2b: Emergency (redDist <= 1) */
  if (redDist <= 1) {
    int32_t bestScore = -999999;
    int bestSi = 0;
    for (int i = 0; i < numScored; i++) {
      int32_t s = scored[i].rdMin * 200 - scored[i].bd * 100;
      if (s > bestScore || (s == bestScore && scored[i].rdSum > scored[bestSi].rdSum)) {
        bestScore = s;
        bestSi = i;
      }
    }
    g_last_score = bestScore;
    return scored[bestSi].idx;
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
    if (g_use_resistance)
      scored[i].score = scored[i].pathWidth;
    else
      scored[i].score = -scored[i].bd * 200 + scored[i].rdSum * 100;
    if (repairSet[scored[i].idx]) scored[i].score += repairBonus;
    if (gapBridgeSet[scored[i].idx]) scored[i].score += gapBridgeBonus;
  }
  qsort(scored, numScored, sizeof(BlueCandidate), cmp_blue_desc);

  /* Step 4b: BD-advancer injection */
  int32_t bestBd = INF;
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd < bestBd) bestBd = scored[i].bd;

  int poolCap = 20;
  int top20HasBdBest = 0;
  int top20Limit = numScored < poolCap ? numScored : poolCap;
  for (int i = 0; i < top20Limit; i++)
    if (scored[i].bd == bestBd) { top20HasBdBest = 1; break; }

  int topN;
  if (!top20HasBdBest) {
    int injected = 0;
    BlueCandidate inject[3];
    for (int i = top20Limit; i < numScored && injected < 3; i++)
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
    int32_t rscore;
    if (g_use_resistance) {
      rscore = (int32_t)(red_vd[ci] * g_red_w + blue_vd[ci] * g_blue_w);
    } else {
      g_board[ci] = RED;
      int32_t rrd = red_distance_to_win(g_board);
      int32_t rbd = blue_distance_to_win(g_board);
      rscore = -rrd * 200 + rbd * 100;
      g_board[ci] = EMPTY;
    }
    redPriority[numRed++] = (RedCandidate){ci, rscore};
  }
  qsort(redPriority, numRed, sizeof(RedCandidate), cmp_red_desc);

  /* Step 6: Beam-search minimax */
  int blueW0 = topN < g_base_widths[0] ? topN : g_base_widths[0];
  if (blueW0 > topN) blueW0 = topN;
  int redW1 = numRed < g_base_widths[1] ? numRed : g_base_widths[1];
  int blueW2 = numScored < g_base_widths[2] ? numScored : g_base_widths[2];
  int redW3 = numRed < g_base_widths[3] ? numRed : g_base_widths[3];
  int blueW4 = numScored < g_extra_widths[0] ? numScored : g_extra_widths[0];
  int redW5 = numRed < g_extra_widths[1] ? numRed : g_extra_widths[1];
  int blueW6 = numScored < g_extra2_widths[0] ? numScored : g_extra2_widths[0];
  int redW7 = numRed < g_extra2_widths[1] ? numRed : g_extra2_widths[1];

  int32_t bdWeight = (redDist <= 2) ? 400 : 200;

#define EVAL_LEAF(bd_var, rdi_var) \
  do { \
    if (g_use_resistance) { \
      float _br = blue_resistance(g_board); \
      float _rr = red_resistance(g_board); \
      leafScore = (int32_t)(_rr * g_red_w - _br * g_blue_w); \
    } else if (g_use_nn) { \
      leafScore = nn_eval(g_board, (rdi_var).min, (bd_var)); \
    } else { \
      int32_t s = -(bd_var) * bdWeight + (rdi_var).sum * 100 + (rdi_var).min * 500; \
      if ((bd_var) > 3) s -= ((bd_var) - 3) * 300; \
      leafScore = s; \
    } \
    if (g_eval_noise > 0.0f) { \
      float factor = 1.0f + g_eval_noise * (2.0f * eval_rng_float() - 1.0f); \
      leafScore = (int32_t)(leafScore * factor); \
    } \
  } while(0)

  int savedDepth = g_depth;
  int numPasses = (g_depth >= 10) ? 2 : 1;
  int savedBlueW0 = blueW0;

  for (int pass = 0; pass < numPasses; pass++) {
    if (numPasses == 2 && pass == 0) g_depth = 8;
    else g_depth = savedDepth;
    if (pass == 1) blueW0 = savedBlueW0 < 5 ? savedBlueW0 : 5;

    int32_t bestFinal = -999999;

    for (int i = 0; i < blueW0; i++) {
    g_board[scored[i].idx] = BLUE;

    /* Select top Red responses excluding Blue's move */
    uint8_t redTop[MAX_UNCLAIMED];
    int redTopN = 0;
    for (int j = 0; j < numRed && redTopN < redW1; j++)
      if (redPriority[j].idx != scored[i].idx)
        redTop[redTopN++] = redPriority[j].idx;

    if (g_depth < 4) {
      DistInfo rdi = red_dist_info(g_board);
      int32_t bd = blue_distance_to_win(g_board);
      int32_t leafScore;
      EVAL_LEAF(bd, rdi);
      scored[i].minimax = leafScore;
      if (g_use_resistance)
        scored[i].finalScore = leafScore;
      else
        scored[i].finalScore = leafScore - scored[i].bd * 300;
      if (scored[i].finalScore > bestFinal) bestFinal = scored[i].finalScore;
      g_board[scored[i].idx] = EMPTY;
      continue;
    }

    int32_t alpha0 = g_use_resistance ? bestFinal : bestFinal + scored[i].bd * 300;
    int32_t d1Min = 999999;

    for (int j = 0; j < redTopN; j++) {
      g_board[redTop[j]] = RED;
      int32_t bestD2 = -999999;

      if (g_depth < 6) {
        DistInfo rdi = red_dist_info(g_board);
        int32_t bd = blue_distance_to_win(g_board);
        int32_t leafScore;
        EVAL_LEAF(bd, rdi);
        bestD2 = leafScore;
      } else {
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

          /* Select top Red counters excluding prior moves */
          uint8_t redTop2[MAX_UNCLAIMED];
          int redTop2N = 0;
          for (int q = 0; q < numRed && redTop2N < redW3; q++) {
            if (redPriority[q].idx != scored[i].idx &&
                redPriority[q].idx != redTop[j] &&
                redPriority[q].idx != blueFollow[m].idx)
              redTop2[redTop2N++] = redPriority[q].idx;
          }

          int32_t alpha2 = bestD2 > alpha0 ? bestD2 : alpha0;
          int32_t d3Min = 999999;

          for (int q = 0; q < redTop2N; q++) {
            g_board[redTop2[q]] = RED;

            if (g_depth >= 8) {
              /* 8-ply: reuse ply-2 ordering to pick ply-4 Blue follow-ups */
              BlueCandidate blueFollow2[MAX_UNCLAIMED];
              int numFollow2 = 0;
              for (int r = 0; r < numFollow; r++) {
                if (blueFollow[r].idx != blueFollow[m].idx &&
                    blueFollow[r].idx != redTop2[q]) {
                  blueFollow2[numFollow2++] = blueFollow[r];
                }
              }

              int blueTop4N = numFollow2 < blueW4 ? numFollow2 : blueW4;
              int32_t bestD4 = -999999;
              for (int r = 0; r < blueTop4N; r++) {
                g_board[blueFollow2[r].idx] = BLUE;

                uint8_t redTop4[MAX_UNCLAIMED];
                int redTop4N = 0;
                for (int t = 0; t < numRed && redTop4N < redW5; t++) {
                  if (redPriority[t].idx != scored[i].idx &&
                      redPriority[t].idx != redTop[j] &&
                      redPriority[t].idx != blueFollow[m].idx &&
                      redPriority[t].idx != redTop2[q] &&
                      redPriority[t].idx != blueFollow2[r].idx)
                    redTop4[redTop4N++] = redPriority[t].idx;
                }

                int32_t alpha4 = bestD4 > alpha2 ? bestD4 : alpha2;
                int32_t d5Min = 999999;
                for (int t = 0; t < redTop4N; t++) {
                  g_board[redTop4[t]] = RED;
                  int32_t ply5Score;

                  if (g_depth >= 10) {
                    BlueCandidate blueFollow3[MAX_UNCLAIMED];
                    int numFollow3 = 0;
                    for (int u = 0; u < numFollow2; u++) {
                      if (blueFollow2[u].idx != blueFollow2[r].idx &&
                          blueFollow2[u].idx != redTop4[t]) {
                        blueFollow3[numFollow3++] = blueFollow2[u];
                      }
                    }
                    int blueTop6N = numFollow3 < blueW6 ? numFollow3 : blueW6;
                    int32_t bestD6 = -999999;

                    for (int u = 0; u < blueTop6N; u++) {
                      g_board[blueFollow3[u].idx] = BLUE;

                      uint8_t redTop6[MAX_UNCLAIMED];
                      int redTop6N = 0;
                      for (int v = 0; v < numRed && redTop6N < redW7; v++) {
                        if (redPriority[v].idx != scored[i].idx &&
                            redPriority[v].idx != redTop[j] &&
                            redPriority[v].idx != blueFollow[m].idx &&
                            redPriority[v].idx != redTop2[q] &&
                            redPriority[v].idx != blueFollow2[r].idx &&
                            redPriority[v].idx != redTop4[t] &&
                            redPriority[v].idx != blueFollow3[u].idx)
                          redTop6[redTop6N++] = redPriority[v].idx;
                      }

                      int32_t alpha6 = bestD6 > alpha4 ? bestD6 : alpha4;
                      int32_t d7Min = 999999;
                      for (int v = 0; v < redTop6N; v++) {
                        g_board[redTop6[v]] = RED;
                        DistInfo rdi7 = red_dist_info(g_board);
                        int32_t bd7 = blue_distance_to_win(g_board);
                        int32_t leafScore;
                        EVAL_LEAF(bd7, rdi7);
                        if (leafScore < d7Min) d7Min = leafScore;
                        g_board[redTop6[v]] = EMPTY;
                        if (d7Min < alpha6) break;
                      }

                      int32_t ply7val;
                      if (d7Min == 999999) {
                        DistInfo rdi7 = red_dist_info(g_board);
                        int32_t bd7 = blue_distance_to_win(g_board);
                        int32_t leafScore;
                        EVAL_LEAF(bd7, rdi7);
                        ply7val = leafScore;
                      } else {
                        ply7val = d7Min;
                      }

                      if (ply7val > bestD6) bestD6 = ply7val;
                      g_board[blueFollow3[u].idx] = EMPTY;
                      if (bestD6 >= d5Min) break;
                    }

                    if (blueTop6N == 0) {
                      DistInfo rdi6 = red_dist_info(g_board);
                      int32_t bd6 = blue_distance_to_win(g_board);
                      int32_t leafScore;
                      EVAL_LEAF(bd6, rdi6);
                      bestD6 = leafScore;
                    }

                    ply5Score = bestD6;
                  } else {
                    DistInfo rdi5 = red_dist_info(g_board);
                    int32_t bd5 = blue_distance_to_win(g_board);
                    int32_t leafScore;
                    EVAL_LEAF(bd5, rdi5);
                    ply5Score = leafScore;
                  }

                  if (ply5Score < d5Min) d5Min = ply5Score;
                  g_board[redTop4[t]] = EMPTY;
                  if (d5Min < alpha4) break;
                }

                int32_t ply5val;
                if (d5Min == 999999) {
                  DistInfo rdi5 = red_dist_info(g_board);
                  int32_t bd5 = blue_distance_to_win(g_board);
                  int32_t leafScore;
                  EVAL_LEAF(bd5, rdi5);
                  ply5val = leafScore;
                } else {
                  ply5val = d5Min;
                }

                if (ply5val > bestD4) bestD4 = ply5val;
                g_board[blueFollow2[r].idx] = EMPTY;
                if (bestD4 >= d3Min) break;
              }

              if (blueTop4N == 0) {
                DistInfo rdi4 = red_dist_info(g_board);
                int32_t bd4 = blue_distance_to_win(g_board);
                int32_t leafScore;
                EVAL_LEAF(bd4, rdi4);
                bestD4 = leafScore;
              }

              if (bestD4 < d3Min) d3Min = bestD4;
            } else {
              DistInfo rdi2 = red_dist_info(g_board);
              int32_t bd2 = blue_distance_to_win(g_board);
              int32_t leafScore;
              EVAL_LEAF(bd2, rdi2);
              if (leafScore < d3Min) d3Min = leafScore;
            }

            g_board[redTop2[q]] = EMPTY;
            if (d3Min < alpha2) break;
          }

          int32_t ply3val;
          if (d3Min == 999999) {
            DistInfo rdi2 = red_dist_info(g_board);
            int32_t bd2 = blue_distance_to_win(g_board);
            int32_t leafScore;
            EVAL_LEAF(bd2, rdi2);
            ply3val = leafScore;
          } else {
            ply3val = d3Min;
          }

          if (ply3val > bestD2) bestD2 = ply3val;
          g_board[blueFollow[m].idx] = EMPTY;
          if (bestD2 >= d1Min) break;
        }

        if (blueTop2N == 0) {
          DistInfo rdi = red_dist_info(g_board);
          int32_t bd = blue_distance_to_win(g_board);
          int32_t leafScore;
          EVAL_LEAF(bd, rdi);
          bestD2 = leafScore;
        }
      }

      if (bestD2 < d1Min) d1Min = bestD2;
      g_board[redTop[j]] = EMPTY;
      if (d1Min < alpha0) break;
    }

    if (d1Min == 999999) {
      DistInfo rdi = red_dist_info(g_board);
      int32_t bd = blue_distance_to_win(g_board);
      int32_t leafScore;
      EVAL_LEAF(bd, rdi);
      scored[i].minimax = leafScore;
    } else {
      scored[i].minimax = d1Min;
    }

    if (g_use_resistance)
      scored[i].finalScore = scored[i].minimax;
    else
      scored[i].finalScore = scored[i].minimax - scored[i].bd * 300;
    if (scored[i].finalScore > bestFinal) bestFinal = scored[i].finalScore;

    g_board[scored[i].idx] = EMPTY;
  }

  qsort(scored, blueW0, sizeof(BlueCandidate), cmp_blue_final_desc);
  }

  g_depth = origDepth;

  g_last_score = scored[0].finalScore;
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
void wasm_set_extra2_widths(int e0, int e1) {
  g_extra2_widths[0] = e0;
  g_extra2_widths[1] = e1;
}

__attribute__((used))
void wasm_set_red_variant(int v) {
  g_red_variant = v;
}

__attribute__((used))
void wasm_load_nn_weights(const float *data) {
  memcpy(nn_w1, data, sizeof(nn_w1));
  data += NN_IN * NN_H1;
  memcpy(nn_b1, data, sizeof(nn_b1));
  data += NN_H1;
  memcpy(nn_w2, data, sizeof(nn_w2));
  data += NN_H1 * NN_H2;
  memcpy(nn_b2, data, sizeof(nn_b2));
  data += NN_H2;
  memcpy(nn_w3, data, sizeof(nn_w3));
  data += NN_H2;
  memcpy(nn_b3, data, sizeof(float));
}

__attribute__((used))
void wasm_set_nn_eval(int use_nn) {
  g_use_nn = use_nn;
}

__attribute__((used))
void wasm_set_resistance(int use_resistance) {
  g_use_resistance = use_resistance;
}

__attribute__((used))
void wasm_set_resistance_weights(float red_w, float blue_w) {
  g_red_w = red_w;
  g_blue_w = blue_w;
}

__attribute__((used))
void wasm_set_eval_noise(float noise) {
  g_eval_noise = noise;
}

__attribute__((used))
int wasm_get_last_score(void) {
  return g_last_score;
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

__attribute__((used))
int wasm_computer_move_red(
    const uint8_t *board_in,
    const uint8_t *redL_in,
    const uint8_t *redR_in
) {
  memcpy(g_board, board_in, NUM_CROSSINGS);

  uint8_t unclaimed[MAX_UNCLAIMED];
  int numUnclaimed = 0;
  for (int i = 0; i < NUM_CROSSINGS; i++)
    if (g_board[i] == EMPTY) unclaimed[numUnclaimed++] = i;
  if (numUnclaimed == 0) return -1;

  int blueDist = blue_distance_to_win(g_board);

  BlueCandidate scored[MAX_UNCLAIMED];
  int numScored = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = RED;
    DistInfo bdi = blue_dist_info(g_board);
    int32_t rd = red_distance_to_win(g_board);
    scored[numScored++] = (BlueCandidate){ci, rd, bdi.min, bdi.sum, 0, 0, 0, 0};
    g_board[ci] = EMPTY;
  }

  for (int i = 0; i < numScored; i++)
    if (scored[i].bd == 0) return scored[i].idx;

  if (blueDist <= 1) {
    int32_t bestScore = -999999;
    int bestIdx = scored[0].idx;
    for (int i = 0; i < numScored; i++) {
      int32_t s = scored[i].rdMin * 200 - scored[i].bd * 100;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = scored[i].idx;
      }
    }
    return bestIdx;
  }

  int leftComp = build_red_graph_uf_and_count(redL_in, redR_in, g_board);
  uint8_t leftUF_parent[NUM_RED_DOTS];
  memcpy(leftUF_parent, uf_parent, NUM_RED_DOTS);

  build_red_graph_uf_into_uf2(redR_in, redL_in, g_board);
  int rightComp = 0;
  {
    uint8_t seen[NUM_RED_DOTS];
    memset(seen, 0, sizeof(seen));
    for (int i = 0; i < NUM_RED_DOTS; i++) {
      uint8_t r = uf2_find(i);
      if (!seen[r]) { seen[r] = 1; rightComp++; }
    }
  }

  uint8_t repairSet[NUM_CROSSINGS];
  memset(repairSet, 0, sizeof(repairSet));

  if (leftComp == 1 && rightComp > 1) {
    for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
      if (redL_in[ci] && g_board[ci] == EMPTY) {
        uint8_t a = red_ep[ci][0], b = red_ep[ci][1];
        if (uf2_find(a) != uf2_find(b))
          repairSet[ci] = 1;
      }
    }
  } else if (rightComp == 1 && leftComp > 1) {
    memcpy(uf2_parent, leftUF_parent, NUM_RED_DOTS);
    for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
      if (redR_in[ci] && g_board[ci] == EMPTY) {
        uint8_t a = red_ep[ci][0], b = red_ep[ci][1];
        if (uf2_find(a) != uf2_find(b))
          repairSet[ci] = 1;
      }
    }
    build_red_graph_uf_into_uf2(redR_in, redL_in, g_board);
  }

  uint8_t gapBridgeSet[NUM_CROSSINGS];
  memset(gapBridgeSet, 0, sizeof(gapBridgeSet));
  if (leftComp == 1 && rightComp > 1) {
    uint8_t topBndRoot = uf2_find(0);
    uint8_t bottomBndRoot = uf2_find(N * N);
    if (topBndRoot != bottomBndRoot) {
      for (int ci = 0; ci < NUM_CROSSINGS; ci++) {
        if (repairSet[ci]) {
          uint8_t a = red_ep[ci][0], b = red_ep[ci][1];
          uint8_t rootA = uf2_find(a), rootB = uf2_find(b);
          if ((rootA == topBndRoot && rootB == bottomBndRoot) ||
              (rootA == bottomBndRoot && rootB == topBndRoot))
            gapBridgeSet[ci] = 1;
        }
      }
    }
  }

  int32_t repairBonus = (blueDist - 1 < 4 ? blueDist - 1 : 4) * 500;
  int32_t gapBridgeBonus = (blueDist - 1 < 4 ? blueDist - 1 : 4) * 1250;
  for (int i = 0; i < numScored; i++) {
    scored[i].score = -scored[i].bd * 200 + scored[i].rdSum * 100;
    if (repairSet[scored[i].idx]) scored[i].score += repairBonus;
    if (gapBridgeSet[scored[i].idx]) scored[i].score += gapBridgeBonus;
  }
  qsort(scored, numScored, sizeof(BlueCandidate), cmp_blue_desc);

  int32_t bestDist = INF;
  for (int i = 0; i < numScored; i++)
    if (scored[i].bd < bestDist) bestDist = scored[i].bd;

  int poolCap = 20;
  int top20Limit = numScored < poolCap ? numScored : poolCap;
  int top20HasBest = 0;
  for (int i = 0; i < top20Limit; i++)
    if (scored[i].bd == bestDist) { top20HasBest = 1; break; }

  int topN;
  if (!top20HasBest) {
    int injected = 0;
    BlueCandidate inject[3];
    for (int i = top20Limit; i < numScored && injected < 3; i++)
      if (scored[i].bd == bestDist) inject[injected++] = scored[i];
    topN = top20Limit + injected;
    for (int i = 0; i < injected; i++)
      scored[top20Limit + i] = inject[i];
  } else {
    topN = top20Limit;
  }

  RedCandidate oppPriority[MAX_UNCLAIMED];
  int numOpp = 0;
  for (int i = 0; i < numUnclaimed; i++) {
    uint8_t ci = unclaimed[i];
    g_board[ci] = BLUE;
    int32_t obd = blue_distance_to_win(g_board);
    int32_t ord = red_distance_to_win(g_board);
    oppPriority[numOpp++] = (RedCandidate){ci, -obd * 200 + ord * 100};
    g_board[ci] = EMPTY;
  }
  qsort(oppPriority, numOpp, sizeof(RedCandidate), cmp_red_desc);

  int playerW0 = topN < g_base_widths[0] ? topN : g_base_widths[0];
  if (playerW0 > topN) playerW0 = topN;
  int oppW1 = numOpp < g_base_widths[1] ? numOpp : g_base_widths[1];
  int playerW2 = numScored < g_base_widths[2] ? numScored : g_base_widths[2];
  int oppW3 = numOpp < g_base_widths[3] ? numOpp : g_base_widths[3];
  int playerW4 = numScored < g_extra_widths[0] ? numScored : g_extra_widths[0];
  int oppW5 = numOpp < g_extra_widths[1] ? numOpp : g_extra_widths[1];

  int32_t distWeight = (blueDist <= 2) ? 400 : 200;

#define EVAL_LEAF_RED(rd_var, bdi_var) \
  do { \
    if (g_use_resistance) { \
      float _rr = red_resistance(g_board); \
      float _br = blue_resistance(g_board); \
      leafScore = (int32_t)(_br * g_red_w - _rr * g_blue_w); \
    } else if (g_use_nn) { \
      leafScore = -nn_eval(g_board, (rd_var), (bdi_var).min); \
    } else { \
      int32_t s = -(rd_var) * distWeight + (bdi_var).sum * 100 + (bdi_var).min * 500; \
      if ((rd_var) > 3) s -= ((rd_var) - 3) * 300; \
      leafScore = s; \
    } \
  } while(0)

  for (int i = 0; i < playerW0; i++) {
    g_board[scored[i].idx] = RED;

    uint8_t oppTop[MAX_UNCLAIMED];
    int oppTopN = 0;
    for (int j = 0; j < numOpp && oppTopN < oppW1; j++)
      if (oppPriority[j].idx != scored[i].idx)
        oppTop[oppTopN++] = oppPriority[j].idx;

    if (g_depth < 4) {
      DistInfo bdi = blue_dist_info(g_board);
      int32_t rd = red_distance_to_win(g_board);
      int32_t leafScore;
      EVAL_LEAF_RED(rd, bdi);
      scored[i].minimax = leafScore;
      g_board[scored[i].idx] = EMPTY;
      continue;
    }

    int32_t d1Scores[MAX_UNCLAIMED];
    int numD1 = 0;

    for (int j = 0; j < oppTopN; j++) {
      g_board[oppTop[j]] = BLUE;
      int32_t bestD2 = -999999;

      if (g_depth < 6) {
        DistInfo bdi = blue_dist_info(g_board);
        int32_t rd = red_distance_to_win(g_board);
        int32_t leafScore;
        EVAL_LEAF_RED(rd, bdi);
        bestD2 = leafScore;
      } else {
        BlueCandidate playerFollow[MAX_UNCLAIMED];
        int numFollow = 0;
        for (int m = 0; m < numScored; m++) {
          if (scored[m].idx != scored[i].idx && scored[m].idx != oppTop[j]) {
            g_board[scored[m].idx] = RED;
            int32_t frd = red_distance_to_win(g_board);
            g_board[scored[m].idx] = EMPTY;
            playerFollow[numFollow] = scored[m];
            playerFollow[numFollow].bd = frd;
            numFollow++;
          }
        }
        qsort(playerFollow, numFollow, sizeof(BlueCandidate), cmp_blue_by_bd);

        int playerTop2N = numFollow < playerW2 ? numFollow : playerW2;
        for (int m = 0; m < playerTop2N; m++) {
          g_board[playerFollow[m].idx] = RED;

          uint8_t oppTop2[MAX_UNCLAIMED];
          int oppTop2N = 0;
          for (int q = 0; q < numOpp && oppTop2N < oppW3; q++) {
            if (oppPriority[q].idx != scored[i].idx &&
                oppPriority[q].idx != oppTop[j] &&
                oppPriority[q].idx != playerFollow[m].idx)
              oppTop2[oppTop2N++] = oppPriority[q].idx;
          }

          int32_t d3Scores[MAX_UNCLAIMED];
          int numD3 = 0;

          for (int q = 0; q < oppTop2N; q++) {
            g_board[oppTop2[q]] = BLUE;

            if (g_depth >= 8) {
              BlueCandidate playerFollow2[MAX_UNCLAIMED];
              int numFollow2 = 0;
              for (int r = 0; r < numFollow; r++) {
                if (playerFollow[r].idx != playerFollow[m].idx &&
                    playerFollow[r].idx != oppTop2[q]) {
                  playerFollow2[numFollow2++] = playerFollow[r];
                }
              }

              int playerTop4N = numFollow2 < playerW4 ? numFollow2 : playerW4;
              int32_t bestD4 = -999999;
              for (int r = 0; r < playerTop4N; r++) {
                g_board[playerFollow2[r].idx] = RED;

                uint8_t oppTop4[MAX_UNCLAIMED];
                int oppTop4N = 0;
                for (int t = 0; t < numOpp && oppTop4N < oppW5; t++) {
                  if (oppPriority[t].idx != scored[i].idx &&
                      oppPriority[t].idx != oppTop[j] &&
                      oppPriority[t].idx != playerFollow[m].idx &&
                      oppPriority[t].idx != oppTop2[q] &&
                      oppPriority[t].idx != playerFollow2[r].idx)
                    oppTop4[oppTop4N++] = oppPriority[t].idx;
                }

                int32_t d5Scores[MAX_UNCLAIMED];
                int numD5 = 0;
                for (int t = 0; t < oppTop4N; t++) {
                  g_board[oppTop4[t]] = BLUE;
                  DistInfo bdi5 = blue_dist_info(g_board);
                  int32_t rd5 = red_distance_to_win(g_board);
                  int32_t leafScore;
                  EVAL_LEAF_RED(rd5, bdi5);
                  d5Scores[numD5++] = leafScore;
                  g_board[oppTop4[t]] = EMPTY;
                }

                int32_t ply5val;
                if (numD5 == 0) {
                  DistInfo bdi5 = blue_dist_info(g_board);
                  int32_t rd5 = red_distance_to_win(g_board);
                  int32_t leafScore;
                  EVAL_LEAF_RED(rd5, bdi5);
                  ply5val = leafScore;
                } else {
                  ply5val = array_min(d5Scores, numD5);
                }

                if (ply5val > bestD4) bestD4 = ply5val;
                g_board[playerFollow2[r].idx] = EMPTY;
              }

              if (playerTop4N == 0) {
                DistInfo bdi4 = blue_dist_info(g_board);
                int32_t rd4 = red_distance_to_win(g_board);
                int32_t leafScore;
                EVAL_LEAF_RED(rd4, bdi4);
                bestD4 = leafScore;
              }

              d3Scores[numD3++] = bestD4;
            } else {
              DistInfo bdi2 = blue_dist_info(g_board);
              int32_t rd2 = red_distance_to_win(g_board);
              int32_t leafScore;
              EVAL_LEAF_RED(rd2, bdi2);
              d3Scores[numD3++] = leafScore;
            }

            g_board[oppTop2[q]] = EMPTY;
          }

          int32_t ply3val;
          if (numD3 == 0) {
            DistInfo bdi2 = blue_dist_info(g_board);
            int32_t rd2 = red_distance_to_win(g_board);
            int32_t leafScore;
            EVAL_LEAF_RED(rd2, bdi2);
            ply3val = leafScore;
          } else {
            ply3val = array_min(d3Scores, numD3);
          }

          if (ply3val > bestD2) bestD2 = ply3val;
          g_board[playerFollow[m].idx] = EMPTY;
        }

        if (playerTop2N == 0) {
          DistInfo bdi = blue_dist_info(g_board);
          int32_t rd = red_distance_to_win(g_board);
          int32_t leafScore;
          EVAL_LEAF_RED(rd, bdi);
          bestD2 = leafScore;
        }
      }

      d1Scores[numD1++] = bestD2;
      g_board[oppTop[j]] = EMPTY;
    }

    if (numD1 == 0) {
      DistInfo bdi = blue_dist_info(g_board);
      int32_t rd = red_distance_to_win(g_board);
      int32_t leafScore;
      EVAL_LEAF_RED(rd, bdi);
      scored[i].minimax = leafScore;
    } else {
      scored[i].minimax = array_min(d1Scores, numD1);
    }

    g_board[scored[i].idx] = EMPTY;
  }

  for (int i = 0; i < playerW0; i++)
    scored[i].finalScore = scored[i].minimax - scored[i].bd * 300;

  qsort(scored, playerW0, sizeof(BlueCandidate), cmp_blue_final_desc);

  if (g_red_variant > 0 && playerW0 > 1) {
    int nearBest = 1;
    int32_t threshold = scored[0].finalScore - 50;
    while (nearBest < playerW0 && scored[nearBest].finalScore >= threshold)
      nearBest++;
    return scored[g_red_variant % nearBest].idx;
  }

  return scored[0].idx;
}
