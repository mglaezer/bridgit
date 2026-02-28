# Alpha-Beta Pruning Strategy for Bridg-It Bot

## What We're Doing

Replacing the bot's beam search with alpha-beta pruning in WASM. Alpha-beta is a smarter tree search: it considers ALL moves but prunes branches that are provably worse, giving both depth AND completeness. Beam search only tracks the top-N moves at each level — if the best move isn't in the top-N, it's invisible.

## Architecture

- **Negamax with alpha-beta**: Standard recursive search with alpha-beta cutoffs
- **Iterative deepening**: Search depth 2, 3, 4... until 60% of 1200ms budget used
- **Transposition table (TT)**: 32K entries caching position scores and best moves
- **Zobrist hashing**: Incremental board hashing for TT indexing
- **Killer moves**: 2 slots per ply — remembers moves that caused cutoffs at sibling nodes
- **History heuristic**: Accumulated cutoff scores per crossing for move ordering
- **Principal Variation Search (PVS)**: First move searched with full window, rest with null window
- **BFS move ordering at plies 1-2**: Use full BFS distance computation for move ordering at the first 2 inner plies
- **Forward pruning (INNER_WIDTH=15)**: Keep only top 15 moves at each inner node
- **Root-computed priority arrays**: BFS-based crossing rankings computed once at root, used as cheap fallback ordering at deeper plies

## Head-to-Head Result

Paired benchmark (50 games, same Red sequences):

| Metric | Old Beam 6-ply | New Alpha-Beta |
|--------|---------------|----------------|
| Win rate | 37/50 (74%) | **38/50 (76%)** |
| Avg time/move | 1195ms | **683ms (1.75× faster)** |
| Both won | 36 | 36 |
| Neither won | 11 | 11 |
| Only this one won | 1 | 2 |
| Net gain | — | **+2pp** |

**Alpha-beta matches beam search in strength (+2pp, within noise) while being 1.75× faster.** They agree on 94% of games (47/50).

## What We Tried

| Config | Win rate vs weakRed-0.9 | Notes |
|--------|------------------------|-------|
| Old beam search 6-ply (40×8×10×8 + 8×6) | ~88% (solo) | Baseline |
| Alpha-beta, basic (priority + history only) | 70% | Move ordering too weak |
| + Root priority arrays | 80% | Priorities computed once at root, used at all depths |
| + TT int16→int32 overflow fix | 85% | Scores up to 110K were wrapping around in int16 |
| + BFS at plies 1-2, INNER_WIDTH=15 | **88%** (200 games) | **Best config** |
| + BFS at plies 1-2, INNER_WIDTH=10 | 84% | Too narrow — misses good moves |
| + BFS at plies 1-2, INNER_WIDTH=20 | 82% | Too wide — depth drops |
| + BFS at ALL plies, INNER_WIDTH=8 | 78% | BFS at every ply too expensive, kills depth |
| + Pre-filtered BFS (top 20 by priority), all plies | 85% | Root priorities too stale for deep plies |
| + Late Move Reduction (LMR) | 77% | Move ordering not reliable enough for LMR |
| + BFS_EVAL_PLY=3, INNER_WIDTH=15 | 70% | BFS at 3 plies too expensive |
| + Aspiration windows | 84% | Score fluctuations too large between iterations |
| + Dynamic width (18/12/8 by ply) | 80% | Narrow deep plies miss critical moves |

## What Didn't Work and Why

### BFS at all plies (78%)
In beam search, you only BFS-score the survivors from the previous ply (~8-10 moves). In alpha-beta, you BFS-score ALL unclaimed moves (~40-50) to figure out which to keep. This 5× cost difference makes BFS-at-all-plies too expensive, cutting search depth from 8 to 3-4.

### Late Move Reduction (77%)
LMR assumes that later-ordered moves are unlikely to be good — it reduces their search depth. This works in chess where move ordering (captures, checks, etc.) is very reliable. In Bridg-It, our move ordering is approximate, and a move ranked #5 might be the critical defensive move. LMR causes too many misses.

### Aspiration windows (84%)
Starting with a narrow score window around the previous iteration's result. In Bridg-It, scores fluctuate significantly between iterations (different depth = different evaluation landscape), causing frequent re-searches that waste time.

### Dynamic width (80%)
Wider at shallow plies (18), narrower at deep (8). The narrowing at deep plies loses critical moves, while the extra width at shallow plies doesn't compensate.

### Pre-filtered BFS (85%)
Using root-computed priorities to pre-select which moves to BFS-score at inner nodes. Doesn't help because the priorities become stale as the board changes.

### Too narrow width (84% at W=10)
Cutting to only 10 moves per inner node misses important tactical moves too often.

### Too wide width (82% at W=20)
With 20 moves per node, depth drops to 5-6 instead of 7-9. The extra breadth doesn't compensate.

## What Works

### BFS at plies 1-2 + INNER_WIDTH=15 (88%)
This is the sweet spot. BFS ordering is most valuable at shallow plies where the board hasn't changed much from the root position. At deeper plies (3+), root-computed priorities + TT best moves + killer moves + history heuristic provide adequate ordering.

The search reaches depth 7-9 in the opening/midgame and depth 9-12 in the endgame. Average 683ms/move.

## Current Best Config

```
BFS_EVAL_PLY = 2      (BFS ordering at plies 1-2)
INNER_WIDTH = 15       (keep top 15 moves at inner nodes)
TT_SIZE = 32768        (transposition table entries)
Time limit = 1200ms    (iterative deepening budget)
```

## Potential Further Improvements

1. **Better static eval**: Add more features beyond bd/rdSum/rdMin (partition connectivity, threat detection)
2. **Hybrid approach**: Use beam search at plies 1-4, then alpha-beta from ply 5+
3. **Larger TT**: Increase from 32K to 64K entries (needs 2MB WASM memory)
