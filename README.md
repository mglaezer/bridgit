# Bridg-It

A browser-based implementation of [Bridg-It](https://en.wikipedia.org/wiki/Bridg-It), a classic connection board game from the 1960s, featuring a bot opponent powered by game-theoretic strategy and alpha-beta search.

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/BridgeIt2.svg/500px-BridgeIt2.svg.png" alt="Bridg-It game board" width="300">

### Where to play

**[Play it here](https://mglaezer.github.io/bridgit/)**

## About

Bridg-It is a two-player connection game played on a grid of interlocking red and blue dots. You play as **Red**, trying to connect the **top** row to the **bottom** row. The bot plays as **Blue**, trying to connect the **left** column to the **right** column.

On each turn, you claim one crossing — a gap between two of your dots. Claiming a crossing connects your dots along that edge and simultaneously *blocks* your opponent's perpendicular connection through the same point. The first player to complete a path wins.

Yes, Bridg-It is a solved game — Red has a guaranteed winning strategy. But knowing a winning strategy exists and actually executing it over the board are very different things. The purpose of this project is to give you a fun, challenging opponent to practice against. Can you find and follow the winning strategy under pressure, or will the bot punish your mistakes?

Two winning strategies for Red are known. This implementation uses the one based on Lehman's theorem (1964): partition the board's edges into two spanning trees and use a pairing/repair strategy to maintain them. An earlier and more elegant strategy was discovered by [Oliver Gross](https://en.wikipedia.org/wiki/Bridg-It#Gross's_strategy), who found a simple pairing of crossings such that Red always mirrors Blue's last move onto its paired crossing. Gross's strategy is not implemented here as it is trivial to execute — it requires no search or evaluation, just a lookup table.

The bot plays Blue — the losing side. So while you *should* always win with perfect play, the bot is designed to punish any mistake ruthlessly. One wrong move, and the game might slip away.

## How to Play

1. **Click** on any gap between two red dots to claim it
2. The bot responds immediately with its blue move (highlighted in light blue)
3. Keep going until someone completes a path
4. Press **New Game** to start over (counts as a forfeit)

## Board Layout

The board uses a unified `(2N+1) × (2N+1)` grid (13×13 for N=6). Cell roles are determined by coordinate parity: `(even, odd)` = Red dot, `(odd, even)` = Blue dot, `(even, even)` and `(odd, odd)` = edge slots (crossings). Each crossing holds one Red edge and one perpendicular Blue edge — claiming it gives you yours and blocks the opponent's.

```
      c0  c1  c2  c3  c4  c5  c6  c7  c8  c9  c10 c11 c12

r0     ·   R  ═══  R  ═══  R  ═══  R  ═══  R  ═══  R   ·
r1     B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r2     ║   R   ×   R   ×   R   ×   R   ×   R   ×   R   ║
r3     B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r4     ║   R   ×   R   ×   R   ×   R   ×   R   ×   R   ║
r5     B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r6     ║   R   ×   R   ×   R   ×   R   ×   R   ×   R   ║
r7     B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r8     ║   R   ×   R   ×   R   ×   R   ×   R   ×   R   ║
r9     B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r10    ║   R   ×   R   ×   R   ×   R   ×   R   ×   R   ║
r11    B   ×   B   ×   B   ×   B   ×   B   ×   B   ×   B
r12    ·   R  ═══  R  ═══  R  ═══  R  ═══  R  ═══  R   ·
```

`R` = Red dot, `B` = Blue dot, `×` = playable crossing, `═══` = Red boundary edge (pre-connected), `║` = Blue boundary edge (pre-connected), `·` = unused corner.

For N=6: 42 Red dots, 42 Blue dots, 61 playable crossings (`N² + (N−1)² = 36 + 25`), 20 boundary edges.

## The Algorithm

### The Theory: Shannon Switching Games

Bridg-It is a special case of the [Shannon switching game](https://en.wikipedia.org/wiki/Shannon_switching_game), a class of combinatorial games played on graphs. The game was solved in 1964 by Alfred Lehman using matroid theory.

**Lehman's Theorem** states that the second player (the "connector") has a winning strategy if and only if the underlying graph contains two edge-disjoint spanning trees. In Bridg-It, this translates to a concrete condition on the board's dual graph structure.

The board has two overlapping graphs — one for Red, one for Blue. Each player's graph has 42 vertices (their dots) connected by 61 playable crossings plus 10 permanent boundary edges. When you claim a crossing, it becomes a permanent edge in your graph and is permanently removed from your opponent's.

### Why Red Wins

For Blue to have a guaranteed win, Blue's graph would need to support two edge-disjoint spanning trees. This requires 2 × 31 = 62 crossing edges, but only 61 crossings exist. Blue is always **exactly one edge short** — and this holds for any board size, not just 6×6. This single-edge deficit is the fundamental asymmetry that gives the first player the advantage.

Red's winning strategy works by maintaining a *partition* of crossings into two sets (L and R). After Red's first move bridges R's gap, both L and R become spanning trees. From that point on, Red uses a pairing strategy: whichever tree Blue breaks, Red repairs from the other. This is unbeatable.

### The Bot's Strategy

Since Blue is theoretically lost, the bot can't simply play "optimally" — there is no winning strategy for Blue against perfect Red. Instead, the bot plays a hybrid strategy designed to exploit human mistakes:

**1. Pairing Repair Detection**

The bot maintains Blue's own partition (L = spanning tree, R = 2-component forest). After each Red move, it identifies which tree was broken and computes all valid repair edges. Repair candidates get a score bonus scaled by urgency: up to **+2000** when Red is far from winning, tapering to **0** when Red is at distance 1.

Among repair candidates, some also bridge R's left-right boundary gap — these "gap-bridging" moves push Blue closer to having two spanning trees. These get up to a **+5000 bonus**, also scaled by urgency. This scaling ensures the bot prioritizes offense when Red isn't threatening, and defense when Red is close.

**2. Distance-Based Evaluation**

Every unclaimed crossing is scored by: how much it reduces Blue's distance to win (`bd`) and how much it increases Red's sum-of-distances to the bottom boundary (`rdSum`). The formula:

```
score = -bd × 200 + rdSum × 100
```

Lower `bd` = closer to winning for Blue. Higher `rdSum` = Red is further from winning.

To illustrate, here's a small N=2 board after Red claims crossing (1,1) and Blue claims (3,1):

```
      c0  c1  c2  c3  c4

r0     ·   R  ═══  R   ·
r1     B  [R]  B   ×   B       [R] = Red-claimed crossing
r2     ║   R   ×   R   ║       [B] = Blue-claimed crossing
r3     B  [B]  B   ×   B
r4     ·   R  ═══  R   ·
```

BFS finds each player's shortest path through their dot graph. Owned crossings are free (cost 0); unclaimed crossings cost 1.

```
Blue's path (left → right), bd = 1:

  LEFT ── B ──[B]── B ── × ── B ── RIGHT
               (3,1)     (3,3)
              cost 0     cost 1

Red's path (top → bottom), rd = 2:

  TOP ── R ──[R]── R ── × ── R ── × ── R ── BOTTOM
              (1,1)     (2,2)     (3,3)
             cost 0    cost 1    cost 1
```

Both paths want crossing (3,3) — claiming it helps you and blocks your opponent.

**3. Alpha-Beta Search**

All unclaimed crossings are candidate moves, evaluated through negamax alpha-beta search with iterative deepening:

- Search starts at depth 2 and increases until 60% of the 1200ms time budget is used
- At each node, moves are ordered by: transposition table best move → killer moves → BFS distance (at shallow plies) → root-computed priority ranking + history heuristic
- Alpha-beta pruning eliminates branches that can't improve on the best move found so far
- The top 15 moves are evaluated at each inner node; the rest are pruned
- Leaf positions are evaluated: `−bd × weight + rdSum × 100 + rdMin × 500 − fragility_penalty`

The search reaches depth 7-9 in the opening/midgame and depth 9-12 in the endgame, evaluating ~1M positions per move in ~683ms on average. A 32K-entry transposition table caches position evaluations across iterations. The JavaScript engine falls back to beam-search minimax: 20 × 4 × 6 × 4 = 1,920 leaf evaluations per move (~46ms).

Red responses are ordered by a balanced score (`-rd×200 + bd×100`) rather than pure offense. This models realistic human opponents who consider both advancing their own connection and blocking Blue — not just distance-optimal play.

### Time Constraints

The entire bot runs client-side in your browser — there's no server. The WASM alpha-beta engine uses a **1.2-second time budget** with iterative deepening, evaluating ~1M positions per move. The JavaScript fallback uses beam-search minimax, evaluating 1,920 positions in ~46ms. Both stay responsive on mobile.

### The Bot's Design Philosophy

Blue is *theoretically lost* — no sequence of Blue moves beats perfect Red. So the bot isn't trying to play "optimally" in the game-theoretic sense. Instead, it's an adversarial optimizer: every move is chosen to maximize the chance that a *human* Red player makes a mistake. The pairing bonuses ensure structural soundness (Blue's partition stays healthy), the distance formula creates offensive pressure, and the alpha-beta search anticipates Red's strongest responses.

The bot is tuned against realistic human-like opponents (a balanced heuristic with noise), not against the mathematically optimal strategy. This matters because real humans consider both offense and defense, make plausible-looking mistakes rather than random ones, and don't know the winning strategy. The bot's Red model reflects this: it anticipates balanced human play, not pure distance-optimal or random moves.

## Overlays

Three debug overlays let you peek under the hood of Red's game-theoretic strategy. Toggle them with the **L**, **R**, **W** buttons or press **1**, **2**, **3** on your keyboard. Only one overlay is active at a time.

| Button | Key | What it shows |
|--------|-----|---------------|
| **L** | 1 | Red's **L partition** — the spanning tree half of Red's edge partition. Gray lines show unclaimed edges in L; red lines show edges Red has claimed. |
| **R** | 2 | Red's **R partition** — the 2-component forest. This is the "backup" set that provides repair edges when Blue cuts the spanning tree. |
| **W** | 3 | **Optimal Red moves** — highlighted in green. These are the moves that maintain Red's pairing strategy. If you always play green moves, you're guaranteed to win. |

The **L** and **R** overlays visualize the two halves of Red's partition. At the start, L is a spanning tree (one connected component) and R is a 2-component forest. Red's first move bridges R's gap, making both L and R spanning trees. From that point, the pairing strategy kicks in: if Blue cuts an edge in L, Red repairs L using an edge from R (and vice versa). The overlays let you see this structure evolve as the game progresses.

The **W** overlay computes optimal moves using the `getOptimalRedMoves` function, which implements the repair half of the pairing strategy. It checks which of Red's two trees (L or R) was broken by Blue's last move, then finds all edges from the *other* tree that would reconnect the broken one. These "bridging edges" are highlighted in green. If you always play a green move, you maintain two spanning trees and are guaranteed to win — no matter what Blue does.

## Win Indicator

The scoreboard bolds the score of whichever player has a guaranteed win, based on exact graph-theoretic conditions:

- **Red guaranteed**: Red's exchange strategy is viable (both L/R graphs have ≤2 components with at least one spanning tree), OR Blue's full available graph is disconnected.
- **Blue guaranteed**: Red's full available graph is disconnected — Red cannot connect top to bottom even claiming all remaining crossings.
- **Uncertain**: Neither condition holds. Both scores shown at normal weight.

At game start, Red is always guaranteed (the staircase partition gives a viable exchange strategy). The indicator updates after every move.

## What We Tried (And What Didn't Work)

Building the bot was an iterative process. The current version is the result of **48 experiments** — many ideas that *should* have helped turned out to be neutral or actively harmful. Here's the full record.

### A Note on Benchmarking

Experiments #1–35 measured the bot against a simulated opponent called "weakRed." This opponent plays the mathematically proven winning strategy with some probability (e.g., 90%) and makes a completely random move otherwise. Each move is an independent coin flip.

This model has two problems:
1. **It's unrealistic.** No human alternates between mathematically perfect play and completely random moves. Real humans play heuristically — they consider both offense and defense with varying accuracy.
2. **"Optimal" is only meaningful when followed consistently.** The winning strategy only works if Red follows it from move 1 without deviation. After a random move breaks the pattern, the code recomputes a recovery move — but this is a best-effort heuristic, not a proven winning move. Calling it "optimal" is misleading.

Experiments #41–42 introduced **realistic human models** (a balanced heuristic with noise — see "The Plateau and Breakthrough" below) that better represent how humans actually play. This led to the biggest improvement in the project.

All results were validated using **paired testing**: both bots face identical opponent move sequences (via seeded PRNG), eliminating variance from random moves and producing exact game-by-game comparisons. This methodology revealed that most changes previously believed to help had **zero real impact** — the earlier unpaired measurements were noise.

### What Worked

| Approach | Impact | Details |
|----------|--------|---------|
| **Pairing repair bonuses** | Foundational | +2000 for repair candidates, +5000 for gap-bridging. Win rate jumped from 55% to 86% vs a strong opponent |
| **Depth-2 minimax** | +5pp (percentage points) | Going from 1-ply to 4-ply search. The critical insight: Blue's follow-up moves must be dynamically re-evaluated at each intermediate board state. Using stale scores from the root position actually performed *worse* than no depth increase at all |
| **Width rebalancing** (12×4 → 20×4) | +1.2pp composite | More Blue candidates (20 vs 12) lets the bot consider creative moves |
| **Balanced Red model + wider Red** (20×4×6×4) | +17.5pp vs realistic opponents | Red responses ordered by balanced offense+defense score instead of pure distance. Models human-like play where opponents consider both advancing and blocking. Massive improvement against noisy heuristic opponents (63.5% → 81.0%) with no regression against optimal-strategy opponents |
| **Root-level bd bias + scaled bonuses** | 50% → 0% human win rate | Scale pairing bonuses by Red's distance (0 at rd=1, full at rd=5+), add `finalScore = minimax - bd×100` to prefer path-advancing moves when minimax scores are close. Fixes the bot's tendency to over-defend against threats humans never make |
| **BD-advancer injection** | 5/8 → 8/8 human losses flipped | When pairing bonuses (up to +5000) push ALL bd-advancing moves out of the top-20 minimax candidates, inject up to 3 back and expand the search to 23 candidates. Combined with uniform `bdBias=300`. Fixes the pre-filter bottleneck where the bot never even *considers* the winning move |
| **Minimax leaf: rdMin + fragility penalty** | 7/10 → 10/10 human losses flipped | Two leaf eval additions: (1) `+rdMin×500` makes minimax prefer positions where Red's shortest path is longer, catching edge cascades that rdSum misses; (2) `-max(0,bd−5)×300` strongly penalizes leaves where Blue's distance exceeds 5, preventing fragile positions that a single Red cut can devastate. Zero regression on paired benchmarks |

### What Didn't Work

| # | Approach | Result | Why It Failed |
|---|----------|--------|---------------|
| 1 | **Guaranteed win detection** | Impossible | Blue can never achieve two spanning trees — always 1 edge short. Mathematical impossibility |
| 2 | **Sum-of-distances eval** | 0pp | Most positions have similar sums — doesn't differentiate |
| 3 | **Wider search** (16×5×8×4) | **-3pp** | More candidates introduced noise from stale move-ordering at inner levels |
| 4 | **Expectimax** (3 variants) | **-1.5 to -5pp** | Averaging strong Red moves just weakens Blue's defenses |
| 5 | **Dynamic Red reordering** | **-1pp**, 2x slower | Red's strongest moves barely change between root and depth 2 |
| 6 | **Leaf eval with min Red distance** (small weight) | 0pp | The sum already captures the minimum implicitly (note: later succeeded at higher weight with fragility penalty — Experiment #47) |
| 7 | **Depth-3 search** | **-8.5pp**, 5x slower | Narrow inner widths miss critical candidates |
| 8 | **Contested crossing bonus** | **-3pp** | The linear formula already captures dual-purpose signals |
| 9 | **Wider outer loop only** (12→16 with redW=4) | **-5.5pp** | The pre-filter correctly excludes weaker candidates |
| 10 | **Endgame solver** (alpha-beta) | 0pp to **-1.7pp** | Too pessimistic against imperfect opponents; force-win variant never triggers |
| 11 | **In-game opponent modeling** | 0pp to +0.2pp | Can't reliably detect weak opponents mid-game; defensive cost outweighs benefit |
| 12 | **Fragility penalty** | 0pp | Doesn't change the bot's chosen move in any game |
| 13 | **Denial bonus** | 0pp | Pre-filter bonuses don't affect minimax's final decision |
| 14 | **Opening book** | 0pp | Wider offline search picks different first moves, but they perform identically |
| 15 | **Alternative leaf eval weights** (5 variants) | 0pp | `rd*300`, `rd*200+rdSum*50`, `-bd*300+rdSum*100`, `rdMin*50` — all produce zero game flips |
| 16 | **Monte Carlo rollouts** | **-4.8pp** | Random play is too noisy to produce useful signal |
| 17 | **Dynamic Red width by game stage** | 0pp | More defense in late game doesn't help |
| 18 | **Higher repair bonus** (+4000) | 0pp | Repair candidates already rank high enough at +2000 |
| 19 | **Red ordering by Blue disruption** | **-1pp** | Red distance ordering is strictly better |
| 20 | **Combined Red ordering** | **-1pp** | Any modification that adds Blue distance to Red ordering hurts |
| 21 | **Skip minimax on gap-bridge** | 0pp | Gap-bridge move is already the minimax winner |
| 22 | **Expectimax at depth-2 leaf** | -0.2pp | Average Red too soft at moderate difficulty |
| 23 | **Expectimax at depth-1** | -0.3pp | With 2 Red responses, min ≈ average; losing the min signal hurts |
| 24 | **Tiebreak by pre-filter score** | 0pp | Ties in minimax score aren't the bottleneck |
| 25 | **Blended minimax + pre-filter** | **-4.5pp** | Pre-filter is a coarse heuristic; blending it overrides tactical intelligence |
| 26 | **Remove emergency defense** | 0pp | Minimax already handles Red-about-to-win correctly |
| 27 | **Pre-filter bd-only** | -0.1pp | Hurts at weak-0.8 by losing defensive signal |
| 28 | **Pre-filter rdSum×200** | 0pp | Weight changes don't affect which top-20 enter minimax |
| 29 | **Width variants** (25×2, 30×1, 20×2×8×1, 20×2×8×2) | 0pp to -0.5pp | 20×2×6×3 is the sweet spot |
| 30 | **Fork potential bonus** (bd=1 fork detection) | 0pp | Minimax already discovers forks through its multi-ply search |
| 31 | **Path width** (right-boundary reachability) | 0pp | rdSum already captures attack breadth implicitly |
| 32 | **Race margin** eval (rd−bd instead of separate terms) | 0pp | Reformulating the eval doesn't add new signal |
| 33 | **Pairing-aware Red responses** in minimax | **-1pp** | Models Red too strongly; makes bot overly defensive |
| 34 | **Blue max-flow** (edge-disjoint paths) in leaf eval | 0pp | Fundamentally new signal, but doesn't change move rankings |
| 35 | **Selective deepening** (6-ply on top 5 candidates) | **-3.4pp** | Deeper search with stale Red ordering makes bot pessimistic |
| 36 | **Supervised NN as leaf evaluator** (3 variants) | **-1.6 to -16pp** | Trained MLP (61→128→64→1) on 770K game positions to predict win probability. Used as replacement or supplement to distance eval in minimax. Game-outcome prediction is too noisy for comparing sibling leaves — BFS distance is near-perfect for local position comparison |
| 37 | **RL policy replacing minimax** (focused_red) | **-0.8pp** | REINFORCE-trained policy-value network (61→128→64→{61,1}) replaces the bot's move selection entirely. Trained against greedy Red; gains didn't transfer to Shannon pairing Red used in JS |
| 38 | **RL policy replacing minimax** (optimal_red) | **-1.6pp** | Same architecture, retrained against full Shannon pairing strategy ported to Python. A single forward pass (~16K params) can't match 4-ply search with 1,920 leaf evaluations and exact distance heuristics |
| 43 | **Fork detection & trap prevention** (5 variants) | 0pp to **-45pp** | Attempted nearCount penalty, trap-aware Red model, adaptive defense, early defense, 6-ply search. More defense is catastrophically wrong — Blue needs offense. Fork detection via BFS is too coarse to distinguish independent paths from shared ones |
| 45 | **Fast playouts** (8 variants) | 0pp to **-1.9pp** | Lightweight game simulations (1-ply greedy Blue vs diverse Red) as tie-breakers or additive bonuses after minimax. With high weight: flips human losses but wrecks forkRed. With low weight or gating: preserves forkRed but doesn't flip losses. The playout's weak Red model always favors offense, which is wrong against strong opponents. Unnecessary once the pre-filter was fixed with bd-advancer injection |
| 48 | **Self-play RL + Blue eval NN** (5 variants) | **-1 to -4pp** | Full self-play pipeline: pre-trained Red policy on optimal moves with label smoothing, REINFORCE with KL penalty, Blue eval network (AUC 0.9337). Stress test confirmed bot exploits 96.4% of deviations. NN as leaf evaluator (-1pp) or move re-ranker (-4pp) hurts because 1-ply NN evaluation adds noise to 4-ply search. RL training suffered catastrophic forgetting without KL regularization |
| 49 | **NN candidate selection + AUC validation** (3 variants) | **-37 to +2** | Used NN to inject candidate moves into minimax search (3 candidates: -37 games, 1 conservative: +2). The NN's AUC 0.93 was inflated by easy games — on close-game data (strong Red), AUC drops to **0.70**, with bd 3-6 at **0.55** (random). Game-outcome labels are too noisy for position evaluation when both players play well. Architecture (CNN/GNN/MLP) is irrelevant — the bottleneck is label quality, not model expressiveness |
| 50a | **TD value net as heuristic blend** | **-2** | Trained TD self-play value network, then added NN output as additive term in existing heuristic leaf eval (`score = heuristic + NN × scale`). Neutral result — the NN signal is drowned by the hand-crafted heuristic. Wrong approach: should use NN as sole evaluator, not blend |
| 50b | **TD value net (unstabilized)** | **-19 to -32** | Pure NN minimax (correct approach) but training destabilized after iter 40. Self-play oscillated between 92% Blue / 8% Red on alternating iterations due to each batch overcorrecting the value function |
| 50c | **Rolling buffer + balanced sampling** | **-52** | Balanced sampling (equal Blue/Red wins per batch) killed value separation (V went from ±0.4 to ±0.33). The network couldn't distinguish good from bad positions |

### The Plateau and Breakthrough: Better Opponents, Better Bot

After 35 experiments the bot appeared to plateau at ~92% win rate. But all those experiments were measured against `weakRed(0.9)` — a simulated opponent that plays the mathematically perfect strategy 90% of the time and makes completely random moves the other 10%. This is not how humans play. Nobody alternates between genius and nonsense.

**Building realistic opponents.** We designed several simulated opponents that better reflect how a human thinks:

- **Greedy attacker** — always picks the move that gets Red closest to winning, ignoring defense entirely. Like a beginner who only thinks about their own path.
- **Balanced player** — considers both advancing their own connection *and* blocking the opponent, weighted by importance. Like an intermediate player who sees both sides.
- **Balanced player with noise** — same as above, but with small random imprecision added to each move's evaluation. This models the fact that humans don't calculate perfectly — they misjudge positions slightly. The noise level controls player strength: low noise = sharp expert, high noise = casual player.

Against all *deterministic* opponents (no noise), the bot won 100% of games — predictable play is easy to exploit. The challenge comes from the **noisy balanced player**, especially the sharp version (low noise). Against that opponent, the original bot only won **63.5%**.

**The fix.** Two changes to how the bot thinks during minimax search:

1. **Consider more opponent responses** (4 instead of 2). The original bot was tuned for an opponent that's either perfect or random — it only needed to consider 2 possible Red responses. Against a noisy heuristic opponent, Red's moves are diverse and harder to predict, so the bot needs to anticipate more possibilities.

2. **Model the opponent as a balanced player, not a pure attacker.** When the bot thinks "what will my opponent do next?", it now assumes the opponent will consider both offense and defense — not just pick the most aggressive move. This matches how real humans play.

**Validating with a tournament.** We tested three bot variants against four different opponent types (100 games each) to find the best overall strategy:

| Bot variant | Sharp heuristic | Moderate heuristic | Casual player | Theory expert | **Overall** |
|---|---|---|---|---|---|
| **Original** (narrow search, offense-only Red model) | 69% | 78% | 96% | 94% | 82.5% |
| **Intermediate** (slightly wider search) | 77% | 90% | 98% | 93% | 89.0% |
| **New** (wide search, balanced Red model) | **82%** | **97%** | **100%** | 89% | **92.3%** |

The new bot wins the most games overall (+9.8pp over the original). It trades a small edge against theory experts (-5pp) for large gains against every type of heuristic player (+13pp to +19pp). Since most visitors won't know the winning strategy, this is the right tradeoff.

The lesson: **benchmark opponents matter as much as the search algorithm.** Optimizing against an unrealistic opponent led to a bot that was over-tuned for a scenario that rarely occurs in practice.

### Neural Network Experiments

**Goal:** Replace the hand-crafted board evaluation function with a neural network that plays at least as well, and potentially surpass the heuristic by encoding deeper search knowledge.

**Result:** After extensive experimentation across six training methodologies, the best NN matches the hand-crafted heuristic (~92% win rate) but does not surpass it. The evaluation function is not the bottleneck — search depth is.

**Board state encoding:** 61 inputs (one per crossing): 0 = unclaimed, +1 = Red, -1 = Blue. The NN outputs a single score from Blue's perspective (higher = better for Blue). All architectures described below are dense MLPs with ReLU activations — e.g. "64→32→1" means 61 inputs → 64 hidden neurons → 32 hidden neurons → 1 output, with 6,081 trainable parameters. The NN replaces the hand-crafted BFS-based evaluation as the leaf evaluator inside the same 4-ply minimax search (1,920 leaf evaluations per move).

All win rates below are measured against "weakRed-0.9" — a simulated opponent that plays the Shannon pairing strategy 90% of the time and a random move 10% of the time. The hand-crafted heuristic achieves ~92% against this opponent.

#### Early Attempts: Game Outcomes and RL

The first NN experiments trained on **game outcomes** (win/loss labels) or used **reinforcement learning** (REINFORCE policy gradients). All failed:

- **Supervised on game outcomes**: Trained networks on 770K game positions to predict win probability. The classifier looked accurate overall (93% AUC), but on close games where both players play well, accuracy dropped to **55%** — no better than a coin flip. Game-outcome labels are too noisy for position evaluation. Architecture (MLP, CNN, GNN) made no difference — the bottleneck is label quality, not model expressiveness.
- **RL policy replacing minimax**: Trained a policy network via REINFORCE to select moves directly, bypassing minimax search entirely. A single forward pass (~16K params) can't match 4-ply search with 1,920 leaf evaluations and exact distance heuristics. Result: -0.8 to -1.6 percentage points vs the heuristic.
- **Self-play RL**: Full self-play pipeline with REINFORCE. The NN as leaf evaluator (-1pp) or move re-ranker (-4pp) hurts because a shallow NN evaluation adds noise to the 4-ply search.

**Key lesson:** Training on game outcomes is fundamentally wrong for position evaluation. The signal is too noisy — a position can be excellent but the game still lost due to later mistakes. Training on **search evaluations** (the heuristic's score at each position) gives much cleaner signal.

#### TD Self-Play Value Network

Inspired by TD-Gammon, we tried **temporal difference learning** — pure NN self-play with zero domain knowledge. One network plays both sides, learning through self-consistency: the value assigned to a position should approximate the value of the next position. No search, no heuristics during training — only the final game outcome anchors the learning.

The NN learned meaningful strategy entirely from self-play, reaching **89.5%** at its best:

| Variant | Architecture | Best Win Rate |
|---------|-------------|---------------|
| Naive TD, large iterations | 128→64→1 (16.5K params) | 82.5% |
| Small iterations (best) | 128→64→1 (16.5K params) | **89.5%** |
| Target network (3 variants) | 128→64→1 (16.5K params) | 89% |
| Larger dense network | 256→128→1 (49K params) | 82.5% |
| Sparse MLP (board topology neighbors) | custom sparse layers | 87.5% |
| Research-informed gentle training | 128→64→1 (16.5K params) | 87% |

Eight attempts to push past 89.5% all failed. The key tension: the aggressive learning rate that reaches 89.5% also causes instability; the gentle learning rate that prevents collapse plateaus at 87%.

**Architecture findings:**
- **Larger networks hurt** — extra parameters amplified instability.
- **Sparse/topology-based MLPs hurt** — we tried hard-coding the board's graph adjacency into layer connectivity so each neuron only sees its graph neighbors. This is the wrong inductive bias for Bridg-It, which requires global connectivity reasoning across the full board.
- **CNN rejected entirely** — 63% of the 13×13 grid is non-playable, and convolutions cost ~6× more than an MLP. Too slow for the 1.5s budget.
- **Dense MLP is best** — the small 128→64→1 consistently outperforms all other architectures.

**Why TD self-play stalled:** Bridg-It is deterministic, and TD-Gammon worked largely because backgammon has dice. Tesauro himself noted that in deterministic games, self-play explores "only some very narrow portion of the state space." Training converges to a local optimum where the value function is accurate for the narrow set of positions visited during self-play, but brittle elsewhere.

#### Supervised Distillation on Search Evaluations

A new approach: instead of game outcomes, train the NN to predict the **hand-crafted heuristic's minimax score** at each position. This is the Stockfish NNUE / GNU Backgammon approach — supervised regression on search evaluations.

**Root position data (recording the 4-ply minimax score at each Blue move):**

| Model | Data | Benchmark |
|-------|------|-----------|
| 128→64→1 (16.5K params) | 10K games, 68K samples | 76% |
| 128→64→1 (16.5K params) | 50K games, 338K samples | 70.5% |
| 64→32→1 (6K params) | 50K games, 338K samples | **78%** |

**Surprising finding: more data made the model worse** (76% → 70.5%). The model averages across too many diverse positions and loses the sharp evaluations that matter for game decisions. A smaller network (64→32→1, 6,081 params) generalizes better despite lower training metrics.

**Training metrics do not predict game play.** A model with lower validation loss can play worse. The MSE loss treats all positions equally, but game play depends on a few critical positions. This was confirmed repeatedly across all experiments.

**Deeper networks (3–4 layers) also made things worse.** Hypothesis was that more layers = more hops of BFS distance reasoning. But 64→32→16→1 (55.5%), 48→48→48→1 (71%), and 128→64→32→1 (65%) all underperformed the 2-layer 64→32→1 (78%).

**Breakthrough: search tree leaf positions.** Instead of recording only the root minimax score per move, we recorded all ~1,920 leaf positions the heuristic evaluates during its 4-ply search. Each leaf has a score from the raw evaluation formula. Labels are simpler (no 4-ply lookahead) but the data is 200× more diverse — including hypothetical positions that may never occur in real games.

| Model | Data | Benchmark |
|-------|------|-----------|
| 64→32→1 | 500K leaf samples | 84–86.5% |
| 64→32→1 | 2M leaf samples | **88.5%** |
| 64→32→1 | 5M leaf samples | 83.5% |
| 64→32→1 | 500K leaf + 338K root (mixed) | 85.5% |

Leaf data boosted performance from 78% to **88.5%** — a massive improvement. There's a sweet spot around 2M samples; 5M samples slightly regressed (over-averaging). Mixed leaf+root data didn't clearly beat leaf-only.

#### Expert Iteration

**Idea:** The NN (88.5%) is deployed inside 4-ply search during gameplay. But during training, we can run deeper search (6-ply). The NN + 6-ply search generates training data with 6-ply-backed-up evaluations. The NN then learns to predict what 6-ply search would say — effectively encoding deeper knowledge. Deploying this improved NN at 4-ply gives it knowledge beyond its search horizon. This is the Stockfish NNUE / AlphaZero pattern: train with expensive deep search, deploy with cheap shallow search.

This required porting the game engine and Red's Shannon pairing strategy to Python, and implementing alpha-beta search with NN leaf evaluation. The Python engine was validated against the JS engine on 100 random games.

| Experiment | Benchmark |
|------------|-----------|
| Supervised baseline (2M leaves) | 89.0% |
| Expert iteration 1 (6-ply, 1K games, fine-tuned) | **92.0%** |
| Expert iteration 2 (6-ply, using iter 1 model) | **92.2%** |
| Expert iteration 3 | 91.8% |
| 8-ply expert iteration | 91.0% |
| 5K games at 6-ply | 89.2% |
| 6-ply search at test time | 88.8% |

**+3pp improvement in one iteration** (89% → 92%), then plateaued. Fine-tuning from the supervised baseline preserves broad knowledge while incorporating deeper search insights. Training from scratch with only 12K samples fails (74.5%).

**8-ply training was worse than 6-ply** — the NN's small errors at leaf nodes compound over more search plies, degrading training target quality. Similarly, **6-ply search at test time was worse than 4-ply** (88.8% vs 92.2%) for the same reason. And **5K games was worse than 1K** — same pattern as supervised distillation where more data causes the small network to average away sharp evaluations.

Paired comparison (same 500 games, same seeds): expert iter 2 won 48 of 80 contested games vs the supervised baseline (60/40 split). The improvement is real, not noise.

Best model: 64→32→1, 6,081 params, 92.2%.

#### AlphaZero-Style Self-Play

**Why expert iteration plateaued:** It trained Blue against a fixed Red opponent (Shannon pairing). Once Blue learned to exploit that fixed strategy, further iterations saw the same positions and learned nothing new. In true self-play (AlphaZero-style), both Blue and Red use the same NN + search. As Blue improves, Red improves too, creating progressively harder training positions.

**How it works:** Both sides use the same NN weights + alpha-beta search. Blue maximizes the NN's score; Red minimizes it (standard minimax). With 10% probability, either side plays a random move for exploration. At every move, the board state and search score are recorded as training data (~30 samples/game). The NN is fine-tuned on this data, then the process repeats.

**6-ply self-play (single iteration):** All variants regressed from the 92.2% starting point. The best result (89.4%, with a lower learning rate) still lost ground. Mixing self-play data with old expert data made things even worse (80.0%).

**2-ply self-play (17 iterations):** Hypothesis: 6-ply compounds NN errors; 2-ply is gentler and ~1000× faster. Iteration 2 briefly matched the starting model, then performance steadily degraded to 73.2% by iteration 17. Cross-generation comparison confirmed genuine degradation — later models lose to ALL earlier ones, not just the starting model.

**Root cause: catastrophic forgetting.** The NN was originally trained on positions from games against Shannon pairing Red. Self-play produces fundamentally different positions (NN-vs-NN). With only 6,081 parameters, the network can't accommodate both distributions. Training on self-play erases Shannon-pairing-specific knowledge.

#### Hybrid Training: Self-Play + Shannon Red

To address catastrophic forgetting, we mixed training data: 50% self-play games + 50% vs Shannon pairing Red (at varying strengths). A replay buffer (200K max, recency-weighted) accumulates data across iterations.

**Larger network (128→64→1) from scratch:** Degraded steadily (70% → 56% over 4 iterations). Starting from scratch generates bad data early, which cascades into worse models.

**Same architecture (64→32→1) warm-started from the best expert model (20 iterations):**

| Phase | Iterations | Win Rate Range |
|-------|-----------|---------------|
| Warm-start preserved | 1 | 91.4% |
| Self-play dip | 2–12 | 82.6–85.8% |
| Gradual recovery | 13–20 | 86.6–**90.6%** |

The model spent 13 iterations (2+ hours of compute) recovering the expert knowledge it already had at the start. Peak: 90.6% — never surpassed the 92.2% baseline. Cross-generation analysis confirmed the recovered models matched the starting model but never exceeded it.

#### Why Self-Play Doesn't Help for Bridg-It

Self-play failed across all variants: pure TD (89.5% ceiling), AlphaZero-style with deep search (degradation), and hybrid with replay buffer (recovery but no improvement). The reasons are specific to this game:

1. **BFS distance is already a near-perfect heuristic.** Bridg-It is a pure connectivity game, and BFS directly measures how far each player is from connecting their boundaries — it's an exact metric, not an approximation. In chess, the eval function (piece values, king safety) is a crude proxy that NNs can massively improve. In Bridg-It, there's little room for an NN to improve on exact distance computation.
2. **The strategy space is narrow.** Unlike Go or Chess with vast tactical possibilities, Bridg-It's key features (boundary distances, pair status, gap-bridging) are well-captured by the hand-crafted evaluation.
3. **Distribution mismatch.** Self-play positions (NN-vs-NN) differ fundamentally from benchmark positions (Blue vs Shannon pairing Red). A 6K-parameter network can't serve both distributions.
4. **Deterministic games resist self-play.** Without stochasticity (like dice in backgammon), self-play explores only a narrow slice of the state space and develops self-consistent but brittle strategies.

#### NN Inference Speed

| Environment | NN (64→32→1) | Heuristic (BFS) | Speedup |
|-------------|-------------|-----------------|---------|
| JavaScript (gameplay) | 10.4 μs/eval | 16.7 μs/eval | 1.6× |
| Python/PyTorch (batched) | 0.15 μs/eval | N/A | — |

In JavaScript, the NN is only 1.6× faster than BFS — not enough to enable deeper search (would need ~4–6× for an extra ply). BFS on a 42-node graph is inherently fast; matrix multiplication doesn't win by much. **The NN cannot enable deeper search in JavaScript.**

In Python, batched NN eval is 110× faster than JS BFS, making deep training search (6–8 ply) feasible. But the deployed model runs in JS at the same 4-ply depth as the heuristic.

#### Benchmark Validity

All Python benchmarks (92%) used NN + alpha-beta search. All JS benchmarks (~87%) used fixed-width minimax. These are not directly comparable — they use different search algorithms. In JS (same search), NN ≈ heuristic ≈ 87%. The Python 92% reflects better search, not better evaluation.

Additionally, Red's Shannon pairing implementation has a flaw: Blue wins 59% against Red at strength=1.0 (should be 0% — Red has a proven winning strategy). The repair-move computation fails to find optimal moves on ~4% of turns. All benchmark numbers are against a weaker-than-intended opponent.

**Is 92% a ceiling?** Blue can't predict when Red will deviate (10% random each turn), so many mistakes are unexploitable — Blue's earlier moves may not have set up the right structure to capitalize on the specific mistake Red makes later. Multiple independent approaches (JS heuristic, JS NN, Python NN, TD self-play) all converge in the 87–92% range, suggesting a structural ceiling against near-optimal play. However, without fixing Red's implementation or testing much stronger Blue algorithms (10+ ply, MCTS), we can't be certain.

#### Conclusions

1. **The evaluation function is not the bottleneck.** The NN faithfully replicates the heuristic's judgment but doesn't improve on it. In the same search framework (JS fixed-width minimax), NN and heuristic perform identically at ~87%.
2. **Search depth is the bottleneck.** Humans exploit the bot with coherent multi-move strategies (6-move edge cascades) invisible to 4-ply search. Deeper search — not a better evaluation function — is what would break through.
3. **Smaller networks generalize better** for this game. 64→32→1 (6K params) consistently beats 128→64→1 (16.5K) and deeper architectures. The constraint forces sharper, more decisive evaluations.
4. **Training on search evaluations works; training on game outcomes doesn't.** Leaf-position training (88.5%) and expert iteration (+3pp to 92%) succeeded because they use clean, per-position labels. Game-outcome labels are too noisy.
5. **Self-play is not viable for games where the heuristic is already near-optimal.** TD, AlphaZero-style, and hybrid approaches all hit ceilings below the expert baseline. The BFS distance heuristic leaves little room for improvement — the NN can replicate it but not surpass it.
6. **More is not always better.** More data, deeper search (8-ply), and more training iterations all degraded performance with the small network — a consistent pattern across all phases.

**Best NN model:** `nn/expert_weights_iter2.json` (64→32→1, 6,081 params, ~92% in Python alpha-beta, ~87% in JS minimax). Not deployed — the WASM heuristic engine (see below) outperforms it.

**Promising directions for future improvement:**
- **Endgame solver** — perfect play when ≤15–20 crossings remain (branching factor drops, exact solve becomes feasible)
- **Opening book** — pre-computed optimal first 3–5 moves via deep offline search

### WASM Search Engine

**Goal:** The NN experiments concluded that the evaluation function is not the bottleneck — search depth is. Porting the search engine from JavaScript to C/WebAssembly should give enough speedup to search wider and deeper.

**Implementation:** The entire search engine was rewritten in C (~870 lines) and compiled to WebAssembly via Emscripten. This includes 0-1 BFS distance computation, union-find, partition management, pre-filter scoring with repair/gap-bridge bonuses, Red priority scoring, and the search engine. The C code uses precomputed topology tables (generated from the JS game code to ensure exact match), static arrays with no heap allocation, and a circular-buffer deque for BFS. The compiled output is a 23KB `.wasm` file plus a 12KB JS loader — loaded automatically in the browser with a transparent fallback to the JS engine if WebAssembly is unavailable.

**Correctness:** 11,476 random board positions were tested — WASM and JS produce identical BFS distances and Red distance info on every one.

#### Phase 1: Beam Search (wider)

The initial WASM engine used the same beam-search architecture as the JS engine. The WASM engine was **18× faster** than JavaScript for the same search configuration:

| Engine | Config | Leaf Evals | Time/Move |
|--------|--------|-----------|-----------|
| JS | 20×4×6×4 | 1,920 | 46ms |
| WASM | 20×4×6×4 | 1,920 | 3ms |
| **WASM** | **40×8×10×8** | **25,600** | **19ms** |

**Wider beats deeper.** The 18× speedup was initially expected to enable 6–8 ply search. However, 6-ply search with the existing beam-search paradigm (fixed-width candidate lists at each ply) consistently performed *worse* than 4-ply — regardless of beam width at the deeper plies. The narrow beams create "tunnel vision," following specific lines of play while missing critical moves outside the beam.

Instead, the speedup was used to dramatically widen the 4-ply search: from 20×4×6×4 (1,920 leaves) to 40×8×10×8 (25,600 leaves). This evaluates 13× more candidate positions at each decision point, catching moves the narrow search missed.

#### Phase 2: Alpha-Beta Pruning

The beam search's fundamental limitation: it tracks a fixed number of candidates at each ply. If the best move isn't in the top-N, it's invisible — no matter how deep you search. Alpha-beta pruning fixes this by considering ALL moves but intelligently pruning branches that are provably worse than the current best.

**Architecture:**
- **Negamax with alpha-beta cutoffs** — standard recursive search. First move gets full window (Principal Variation Search), rest get null-window + re-search on fail
- **Iterative deepening** — search depth 2, 3, 4... until 60% of 1200ms budget used. The best move from each completed iteration is used
- **Transposition table (TT)** — 32K entries × 16 bytes caching position scores, best moves, depth, and bound type. Zobrist hashing for O(1) incremental updates
- **Move ordering** — TT best move (from previous iteration) → killer moves (2 per ply, moves that caused cutoffs at sibling nodes) → BFS distance ordering at plies 1-2 → root-computed priority ranking + history heuristic at deeper plies
- **Forward pruning** — top 15 moves kept at each inner node (except TT/killer moves which always pass)

**Tuning:** 14 configurations were tested. Key findings:

| Configuration | Win Rate | Why |
|--------------|----------|-----|
| Basic alpha-beta (priority + history only) | 70% | Move ordering too weak without BFS at inner plies |
| + Root priority arrays | 80% | Rank-based priorities from root BFS, used at all depths |
| + TT overflow fix (int16 → int32) | 85% | Scores up to 110K were overflowing 16-bit storage |
| **+ BFS at plies 1-2, width 15** | **88%** | **Best config** — sweet spot of BFS quality vs depth |
| + BFS at all plies, width 8 | 78% | BFS at every node too expensive — depth drops to 3-4 |
| + Late Move Reduction | 77% | Move ordering not reliable enough for LMR in Bridg-It |
| + Aspiration windows | 84% | Score fluctuations too large between iterations |
| + Dynamic width (18/12/8) | 80% | Narrowing at deep plies loses critical moves |

**Why BFS at plies 1-2 is the sweet spot:** BFS ordering is most valuable at shallow plies where the board hasn't changed much from the root position. At deeper plies (3+), the board has changed enough that root-computed priorities are stale. The TT best move from previous iterations provides good ordering at all depths. The search reaches depth 7-9 in the opening/midgame and depth 9-12 in the endgame.

**Head-to-head result (50 paired games vs weakRed-0.9, same seeds):**

| Metric | Old Beam 6-ply | Alpha-Beta |
|--------|---------------|------------|
| Win rate | 37/50 (74%) | **38/50 (76%)** |
| Avg time/move | 1195ms | **683ms (1.75× faster)** |
| Games where only this one won | 1 | 2 |

Alpha-beta matches beam search in strength (+2pp, within noise) while being 1.75× faster. They agree on 94% of games (47/50). The production bot now uses alpha-beta with iterative deepening and a 1200ms time budget.

### Loss Analysis Against `weakRed(0.9)`

The ~8% loss rate against `weakRed(0.9)` (Shannon pairing 90%, random 10%) is a hard ceiling. A loss analyzer replayed 20 lost games and tested every alternative Blue move at every turn — **0 out of 20 losses were winnable**. Red plays near-perfectly in those games (96.9% optimal on average), leaving no exploitable mistakes.

### Human Playtesting: Finding the Real Weakness (#44)

But humans aren't `weakRed(0.9)`. A human player achieved a **50% win rate** against the bot — despite the bot crushing every automated opponent at 100%. Game recording and analysis revealed the problem: **the bot over-defends against threats humans never make.**

The minimax's Red model (top-4 by distance) imagines punishing responses to offensive moves. But humans don't play like that — they advance their own path, respond to obvious threats, and miss non-obvious ones. So the bot avoids strong offensive moves because minimax "sees" punishment that never comes, and instead plays safe pairing repairs that don't advance Blue's path.

The fix came in two stages. First: scale pairing bonuses by urgency (low when Red is far, full when Red is close) and add a root-level bias toward path-advancing moves. This flipped 5 of 7 unique human losses (the other 2 were duplicates of a stubbornly lost game).

The remaining loss was traced to a **pre-filter bottleneck**: pairing bonuses (up to +5000 for gap-bridging) pushed ALL bd-advancing moves below rank 20, so the minimax never even evaluated them. The bot literally couldn't see the winning move. The fix: when the top-20 candidates contain zero bd-advancing moves, inject up to 3 and expand the search. Result: all 8 recorded human losses flipped, +0.2pp composite, no regression against any opponent.

A second round of human playtesting (6 games, 3-3 split) revealed two new failure modes. First, the human built **edge cascades** — claiming all crossings along column 1 or 11 for a direct top-to-bottom path. The 4-ply minimax couldn't see a 6-move cascade, and by the time the emergency handler fired (rd ≤ 1), no move could save the game. Second, the bot built **fragile positions** — a bd=3 path that a single Red cut (2,8) devastated to bd=6. Two leaf evaluation changes fixed both: adding `rdMin×500` to value positions where Red's shortest path is longer, and adding a penalty for leaves with bd > 5. Result: all 10 recorded human losses flipped, zero regression on paired benchmarks.

### Diverse Benchmark: Automated Human-Like Opponents

To catch this class of bug without human playtesting, we built a diverse benchmark with opponents that don't use Shannon pairing:

| Opponent | Style | Win Rate |
|----------|-------|----------|
| focusedRed | Always picks lowest distance-to-win | 100% |
| localRed | Prefers moves near recent action + low distance | 100% |
| forkRed | Greedy + considers blocking Blue | 100% |
| forkWeak-0.8 | Fork strategy 80%, random 20% | 98% |
| weakRed-0.9 | Shannon pairing 90%, random 10% | 89% |

The bot beats all human-like opponents. Only the proven winning strategy (Shannon pairing) consistently challenges it — and that's a mathematical certainty, not a bot weakness.

### Move-Level Analysis: Finding Bot Mistakes Without Humans

The diverse Red opponents also power a move-level analysis tool. Given a recorded game log, it identifies exactly which Blue moves were mistakes:

1. Replay the recorded game up to each Blue turn
2. Try the bot's actual move and the top 5 alternatives (by Blue distance)
3. Play out the rest of the game 20 times — the bot plays Blue, a randomly chosen human-like Red (focusedRed, localRed, or forkRed) plays Red
4. Report the win rate for each move

```
Turn 7: played 7,3 (win 70%) — best: 5,11 (win 100%) *** MISTAKE
Turn 8: played 7,7 (win 75%) — best: 7,7 (win 75%)
Turn 9: played 7,9 (win 65%) — best: 7,1 (win 100%) *** MISTAKE
```

This replaces the earlier naive analysis that held Red's moves fixed after a divergence (which is invalid — Red would respond differently to a different Blue move). By simulating the rest of the game with human-like opponents, we get a realistic estimate of each move's value.

**Key finding:** In early losses, the bot ignored moves with **100% win rate** against human-like Red for 8+ consecutive turns. The root cause: pairing bonuses (up to +5000) pushed all bd-advancing moves below rank 20 in the pre-filter, so minimax never evaluated them. The bd-advancer injection (Experiment #46) fixes this. Later losses revealed the minimax leaf couldn't detect edge cascades or penalize fragile positions — fixed by adding rdMin and a fragility penalty (Experiment #47). All 10 recorded human losses now flip.

## References

- [Bridg-It — HexWiki](https://www.hexwiki.net/index.php/Bridg-It)
- [Shannon Switching Game — Grokipedia](https://grokipedia.com/page/Shannon_switching_game)
- [CMU Lecture Notes — Shannon Switching](https://www.cs.cmu.edu/afs/cs/academic/class/15859-f01/www/notes/shannon.pdf)
- [Leiden University Thesis](https://studenttheses.universiteitleiden.nl/access/item:3762925/view)
- [Cornell Senior Project — Kimberly Wood](https://e.math.cornell.edu/people/belk/projects/KimberlyWood.pdf)
