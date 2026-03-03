# Bridg-It

A browser-based implementation of [Bridg-It](https://en.wikipedia.org/wiki/Bridg-It), a classic connection board game from the 1960s, featuring a bot opponent powered by game-theoretic strategy and beam-search minimax.

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/BridgeIt2.svg/500px-BridgeIt2.svg.png" alt="Bridg-It game board" width="300">

### Where to play

**[Play it here](https://mglaezer.github.io/bridgit/)**

## About

Bridg-It is a two-player connection game played on a grid of interlocking red and blue dots. You play as **Red**, trying to connect the **top** row to the **bottom** row. The bot plays as **Blue**, trying to connect the **left** column to the **right** column.

On each turn, you claim one crossing — a gap between two of your dots. Claiming a crossing connects your dots along that edge and simultaneously *blocks* your opponent's perpendicular connection through the same point. The first player to complete a path wins.

Yes, Bridg-It is a solved game — Red has a guaranteed winning strategy. But knowing a winning strategy exists and actually executing it over the board are very different things. The purpose of this project is to give you a fun, challenging opponent to practice against. Can you find and follow the winning strategy under pressure, or will the bot punish your mistakes?

Two winning strategies for Red (your side) are known. The first, by [Oliver Gross](https://en.wikipedia.org/wiki/Bridg-It#Gross's_strategy), is a simple pairing: Red always mirrors Blue's move onto its paired crossing. The second, based on Lehman's theorem (1964), uses spanning tree partitions and a repair strategy. Both guarantee a win for Red with perfect play.

The bot plays Blue — the losing side. There is no winning theorem for Blue to follow; the math proves Blue loses against perfect Red. Instead, the bot plays much like a strong human would: evaluating board positions, searching ahead through thousands of move sequences, and punishing your mistakes. One wrong move, and the game **might** slip away — but Red has a huge advantage by playing first, so not every deviation from the optimal strategy will cost you the game. The game theory below explains *why* Blue loses and informs some heuristics, but the bot's core is a practical search engine, not a theoretical formula.

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

The bot doesn't follow any theorem or formula — it uses beam-search minimax, a practical search engine that evaluates thousands of board positions per move. The game theory below is background that explains why the game works the way it does; the bot borrows one idea from it (repair detection) as a heuristic bonus, but all decisions come from search.

### Background: Shannon Switching Games

Bridg-It is a special case of the [Shannon switching game](https://en.wikipedia.org/wiki/Shannon_switching_game), a class of combinatorial games played on graphs. The game was solved in 1964 by Alfred Lehman using matroid theory.

**Lehman's Theorem** states that the second player (the "connector") has a winning strategy **if and only if** the underlying graph contains two edge-disjoint spanning trees. The "if and only if" is important: when the condition is met, the connector can always win by maintaining and repairing those trees. When it is *not* met, the connector has no guaranteed winning strategy — the first player can force a win.

The board has two overlapping graphs — one for Red, one for Blue. Each player's graph has 42 vertices (their dots) connected by 61 playable crossings plus 10 permanent boundary edges. When you claim a crossing, it becomes a permanent edge in your graph and is permanently removed from your opponent's.

In Bridg-It, Blue's edges can be partitioned into L (a spanning tree, 31 edges) and R (a 2-component forest, 30 edges). R is *not* a spanning tree — it falls one edge short. Since Blue's graph lacks two edge-disjoint spanning trees, Lehman's condition is not met, and Blue has no guaranteed win. This means the bot cannot simply follow the tree-repair strategy and expect to always win. The repair approach works most of the time — when Red cuts an L-edge, Blue swaps in an R-edge to fix it — but R has a structural gap (its two disconnected components), and a skilled Red player can target that gap to break through.

### Why Red Wins

This one-edge deficit (61 crossings vs. the 62 needed for two spanning trees) holds for any board size, not just 6×6. It is the fundamental asymmetry that gives the first player the advantage.

Red exploits this by maintaining its *own* partition of crossings into two sets (L and R). After Red's first move bridges R's gap, both L and R become spanning trees. From that point on, Red uses a pairing strategy: whichever tree Blue breaks, Red repairs from the other. This is unbeatable.

### The Bot's Strategy

Since no winning strategy exists for Blue, the bot can't follow a theoretical formula. Instead, it plays like a strong human — combining positional evaluation with look-ahead search to exploit mistakes. The bot uses three key techniques: electrical resistance evaluation, voltage-based move ordering, and beam-search minimax.

**1. Electrical Resistance Evaluation**

The bot models the board as an electrical circuit. Each player's dot graph becomes a resistor network: unclaimed crossings are 1-ohm resistors, claimed crossings are wires (0 ohms), and opponent-claimed crossings are removed. Boundary dots are merged into supernodes via union-find, then voltages are solved via Gauss-Seidel iteration (15 passes). The total resistance R = 1 / total current from source to sink.

Lower resistance = stronger position. A player with many parallel paths has low resistance (parallel resistors add up), while a player forced through a single bottleneck has high resistance. This captures all paths simultaneously — something BFS shortest-path evaluation fundamentally cannot do.

The position score combines both players' resistances with an asymmetric weighting that values blocking Red 2× more than building Blue's own path:

```
score = red_resistance × 2000 − blue_resistance × 1000
```

This defensive bias reflects Blue's second-player disadvantage: Blue must block Red's threats before building its own connection. The 2:1 ratio was determined by benchmarking five weight configurations.

**2. Voltage-Based Move Ordering**

Before searching, the bot computes voltage drops across all empty crossings — once for Blue's network and once for Red's. The voltage drop across a crossing equals the current flowing through it, which directly measures how critical that crossing is as a bottleneck.

Each candidate move is scored by:

```
move_score = red_voltage_drop × 2000 + blue_voltage_drop × 1000
```

Crossings with high current in Red's network are critical for Red's connection — Blue should block them. Crossings with high current in Blue's network are critical for Blue — Blue should claim them. Both contribute positively.

This replaced an earlier approach that evaluated each move by temporarily placing Blue and computing full resistance (requiring ~120 resistance computations per move). Voltage drops achieve the same goal with just 2 computations total, and produce better move ordering because they directly identify bottleneck crossings rather than measuring small resistance changes on a mostly-empty board.

**3. Pairing Repair Detection**

The bot maintains Blue's own partition (L = spanning tree, R = 2-component forest). After each Red move, it identifies which tree was broken and computes all valid repair edges. Repair candidates get a score bonus scaled by urgency: up to **+2000** when Red is far from winning, tapering to **0** when Red is at distance 1. Gap-bridging moves (repairs that also connect R's two components) get up to **+5000**.

**4. Beam-Search Minimax**

All unclaimed crossings are candidate moves, evaluated through a 6-ply beam-search minimax. At Expert strength (beam widths 61×20×20×10 + 8×6):

- All 61 Blue candidates are scored by voltage drops + pairing bonuses
- For each, the top 20 Red responses are tried (ordered by voltage drops)
- Blue picks 20 follow-up moves, Red responds with 10 more
- At plies 5-6, widths narrow to 8×6
- Leaf positions are evaluated using full resistance computation

The voltage-drop ordering ensures the beam captures the most critical crossings at each level, while the full resistance evaluation at leaves provides accurate position assessment.

### The Bot's Design Philosophy

Blue is *theoretically lost* — no sequence of Blue moves beats perfect Red. So the bot isn't trying to play "optimally" in the game-theoretic sense. Instead, it's an adversarial optimizer: every move is chosen to maximize the chance that a *human* Red player makes a mistake. The pairing bonuses ensure structural soundness (Blue's partition stays healthy), the resistance evaluation creates positional pressure, and the beam-search minimax anticipates Red's strongest responses.

### Time Budget

The entire bot runs client-side in your browser — there's no server. The WASM beam-search engine handles resistance evaluation, voltage-drop computation, and minimax search in ~20ms per move at Expert level. The **Strength** dropdown controls search depth and beam width (Beginner through Expert).

## WASM Search Engine

The search engine is written in C and compiled to WebAssembly via Emscripten. It implements beam-search minimax with electrical resistance evaluation and voltage-based move ordering. The C code uses precomputed topology tables, static arrays with no heap allocation, union-find for component merging, and Gauss-Seidel iteration for resistance/voltage computation. The compiled output is a ~28KB `.wasm` file plus a ~12KB JS loader — loaded automatically in the browser with a transparent fallback to the JS engine if WebAssembly is unavailable.

Five difficulty levels control the search width and depth: Beginner (2-ply, narrow beam), Casual (4-ply), Intermediate (6-ply, 61×14×14×8 + 6×4), and Expert (6-ply, 61×20×20×10 + 8×6). At Expert level, the bot evaluates positions in ~20ms per move. Resistance evaluation was benchmarked over 122 games (61 openings × 2 Red variants) against a frozen BFS-based baseline, winning 110/122 (90.2%).

## Overlays

Three debug overlays let you peek under the hood of Red's game-theoretic strategy. Toggle them with the **L**, **R**, **W** buttons or press **1**, **2**, **3** on your keyboard. Only one overlay is active at a time.

| Button | Key | What it shows |
|--------|-----|---------------|
| **L** | 1 | Red's **L partition** — the spanning tree half of Red's edge partition. Gray lines show unclaimed edges in L; red lines show edges Red has claimed. |
| **R** | 2 | Red's **R partition** — the 2-component forest. This is the "backup" set that provides repair edges when Blue cuts the spanning tree. |
| **W** | 3 | **Optimal Red moves** — highlighted in green. These are the moves that maintain Red's pairing strategy. If you always play green moves, you're guaranteed to win. |

The **L** and **R** overlays visualize the two halves of Red's partition. At the start, L is a spanning tree (one connected component) and R is a 2-component forest. Red's first move bridges R's gap, making both L and R spanning trees. From that point, the pairing strategy kicks in: if Blue cuts an edge in L, Red repairs L using an edge from R (and vice versa). The overlays let you see this structure evolve as the game progresses.

The **W** overlay computes optimal moves using the `getOptimalRedMoves` function, which implements the repair half of the pairing strategy. It checks which of Red's two trees (L or R) was broken by Blue's last move, then finds all edges from the *other* tree that would reconnect the broken one. These "bridging edges" are highlighted in green. If you always play a green move, you maintain two spanning trees and are guaranteed to win — no matter what Blue does.

## Development Journey

Building the bot was an iterative process — 50+ experiments, many of which made things worse. The biggest improvements came not from smarter algorithms, but from better benchmarking.

### The Plateau and Breakthrough: Better Opponents, Better Bot

After 35 experiments the bot appeared to plateau at ~92% win rate. But all those experiments were measured against `weakRed(0.9)` — a simulated opponent that plays the mathematically perfect strategy 90% of the time and makes a completely random move otherwise. This is not how humans play. Nobody alternates between genius and nonsense.

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

### Generational Evaluation

The first generation of the Blue bot was developed against Shannon pairing — Red's mathematically optimal strategy, played with occasional random mistakes. This is a natural bootstrap: a strong, well-understood opponent that requires no prior bot development.

But Shannon pairing is purely reactive — Red responds to Blue's moves by playing paired crossings, never proactively building attacks. Once the bot learns to exploit random mistakes, further improvements become invisible to this benchmark. Deeper search that defends against cascade attacks, for example, shows no gain against an opponent that never cascades.

To improve beyond the first generation, each new version is evaluated against the **previous generation** playing Red. The bot's own position evaluation — which scores how good a position is for Blue — is inverted: Red picks the move that makes Blue's score worst. This creates an opponent that adapts as the bot improves: it cascades when cascading hurts Blue, blocks when blocking is effective, and tests exactly the threats the current bot is vulnerable to.

### Human Playtesting

Against `weakRed(0.9)` (Shannon pairing 90%, random 10%), the ~8% loss rate is a hard ceiling — analysis of 20 lost games found 0 were winnable. Red plays near-perfectly in those games (96.9% optimal on average), leaving no exploitable mistakes.

But humans aren't `weakRed(0.9)`. A human player achieved a **50% win rate** against the bot — despite the bot crushing every automated opponent at 100%. The problem: **the bot over-defends against threats humans never make.**

The minimax's Red model (top-4 by distance) imagines punishing responses to offensive moves. But humans don't play like that — they advance their own path, respond to obvious threats, and miss non-obvious ones. So the bot avoids strong offensive moves because minimax "sees" punishment that never comes, and instead plays safe pairing repairs that don't advance Blue's path.

The fix came in two stages. First: scale pairing bonuses by urgency (low when Red is far, full when Red is close) and add a root-level bias toward path-advancing moves. Second: when pairing bonuses push ALL bd-advancing moves out of the top-20 candidates, inject up to 3 back and expand the search — the bot literally couldn't see the winning move. Result: all 8 recorded human losses flipped.

A second round (6 games, 3-3 split) revealed two new failure modes: **edge cascades** (6-move straight-line paths invisible to 4-ply search) and **fragile positions** (bd=3 paths devastated by a single Red cut). Adding `rdMin×500` to catch cascades and a fragility penalty for bd > 5 flipped all 10 recorded human losses with zero regression.

To validate against realistic play styles, several simulated opponents were built:

| Opponent | Style | Win Rate |
|----------|-------|----------|
| focusedRed | Always picks lowest distance-to-win | 100% |
| localRed | Prefers moves near recent action + low distance | 100% |
| forkRed | Greedy + considers blocking Blue | 100% |
| forkWeak-0.8 | Fork strategy 80%, random 20% | 98% |
| weakRed-0.9 | Shannon pairing 90%, random 10% | 89% |

The bot beats all human-like opponents. Only the proven winning strategy (Shannon pairing) consistently challenges it — and that's a mathematical certainty, not a bot weakness.

### What Worked

| Approach | Impact | Details |
|----------|--------|---------|
| **Pairing repair bonuses** | Foundational | +2000 for repair candidates, +5000 for gap-bridging. Win rate jumped from 55% to 86% vs a strong opponent |
| **Depth-2 minimax** | +5pp | Going from 1-ply to 4-ply search. The critical insight: Blue's follow-up moves must be dynamically re-evaluated at each intermediate board state. Using stale scores from the root position actually performed *worse* than no depth increase at all |
| **Width rebalancing** (12×4 → 20×4) | +1.2pp | More Blue candidates (20 vs 12) lets the bot consider creative moves |
| **Balanced Red model + wider Red** (20×4×6×4) | +17.5pp vs realistic opponents | Red responses ordered by balanced offense+defense score. Massive improvement against noisy heuristic opponents (63.5% → 81.0%) with no regression against optimal-strategy opponents |
| **Root-level bd bias + scaled bonuses** | 50% → 0% human win rate | Scale pairing bonuses by Red's distance, add `finalScore = minimax - bd×100` to prefer path-advancing moves when minimax scores are close |
| **BD-advancer injection** | 5/8 → 8/8 human losses flipped | When pairing bonuses push ALL bd-advancing moves out of the top-20, inject up to 3 back. Fixes the pre-filter bottleneck where the bot never even *considers* the winning move |
| **Minimax leaf: rdMin + fragility** | 7/10 → 10/10 human losses flipped | `+rdMin×500` catches edge cascades that rdSum misses; `−max(0,bd−5)×300` penalizes fragile positions |
| **Electrical resistance evaluation** | +22pp | Replaced BFS shortest-path with resistor-network model. Captures all paths simultaneously — parallel paths add up, bottlenecks are penalized. Depth-4 resistance alone (+14pp) beats depth-8 BFS |
| **Asymmetric resistance weights** (2000/1000) | +2.5pp | Blocking Red weighted 2× vs building Blue's path. Bot was overvaluing far-away path-building moves |
| **Voltage-based move ordering** | +10.7pp | Per-crossing current flow from Gauss-Seidel solve ranks bottleneck crossings highest. Replaced N×2 resistance scoring with 2 total computations, both faster and more accurate |

### What Didn't Work

| Approach | Result | Why It Failed |
|----------|--------|---------------|
| **Guaranteed win detection** | Impossible | Blue can never achieve two spanning trees — always 1 edge short |
| **Wider search** (16×5×8×4) | **-3pp** | More candidates introduced noise from stale move-ordering at inner levels |
| **Expectimax** (3 variants) | **-1.5 to -5pp** | Averaging strong Red moves just weakens Blue's defenses |
| **Depth-3 search** | **-8.5pp**, 5x slower | Narrow inner widths miss critical candidates |
| **Contested crossing bonus** | **-3pp** | The linear formula already captures dual-purpose signals |
| **Alpha-beta WASM engine** | **-6pp** | Searched deeper (depth 8-9) in less time, but bdBias and BD-advancer injection don't translate well — post-search score adjustments interact poorly with pruning. Beam search retained |
| **Endgame solver** (alpha-beta) | 0pp to **-1.7pp** | Too pessimistic against imperfect opponents; force-win variant never triggers |
| **Monte Carlo rollouts** | **-4.8pp** | Random play is too noisy to produce useful signal |
| **Blended minimax + pre-filter** | **-4.5pp** | Pre-filter is a coarse heuristic; blending it overrides tactical intelligence |
| **Fork potential bonus** | 0pp | Minimax already discovers forks through its multi-ply search |
| **Pairing-aware Red** in minimax | **-1pp** | Models Red too strongly; makes bot overly defensive |
| **Blue max-flow** in leaf eval | 0pp | Fundamentally new signal, but doesn't change move rankings |
| **Selective deepening** (6-ply on top 5) | **-3.4pp** | Deeper search with stale Red ordering makes bot pessimistic |
| **Fork detection & trap prevention** (5 variants) | 0pp to **-45pp** | More defense is catastrophically wrong — Blue needs offense |
| **Fast playouts** (8 variants) | 0pp to **-1.9pp** | Playout's weak Red model always favors offense, wrong against strong opponents |
| **Deeper d8 with resistance** | **-21pp** | Narrow beams at depth 8 miss good moves, same pattern as BFS |
| **Wider beams with resistance** ([61,30,30,15]) | **-4pp** | More candidates = more noise, consistent across BFS and resistance |
| **Bridge/virtual connection detection** | **-1.6pp** | Too many sole connections in early game; bonus adds noise |
| **Mustplay pruning** (BFS-based) | **-0.9pp** | Voltage drops already identify bottlenecks; BFS mustplay too coarse |
| **SOR + higher conductance** (omega=1.6, 30 iter) | **-5pp** | Conductance overweighted boundary moves |

All results were validated using **paired testing**: both bots face identical opponent move sequences (via seeded PRNG), eliminating variance. This revealed that most changes previously believed to help had **zero real impact** — earlier unpaired measurements were noise.

### Neural Network Experiments

**Goal:** Replace the hand-crafted BFS evaluation with a neural network. **Result:** After six training methodologies, the best NN matches the BFS heuristic (~92%) but doesn't surpass it. These experiments predate the electrical resistance evaluation, which ultimately achieved the breakthrough that NNs could not.

All NNs are dense MLPs with ReLU activations. Input: 61 values (one per crossing: 0 = unclaimed, +1 = Red, -1 = Blue). Output: single score from Blue's perspective. The NN replaces the BFS-based evaluation as the leaf evaluator inside the same minimax search. Win rates below are against `weakRed(0.9)`.

#### Game Outcomes and RL (failed)

Training on **game outcomes** (win/loss labels) produced classifiers that looked accurate (93% AUC overall) but on close games dropped to **55%** — no better than a coin flip. Game-outcome labels are too noisy for position evaluation: a position can be excellent but the game still lost due to later mistakes. Architecture (MLP, CNN, GNN) made no difference — the bottleneck is label quality. RL policy networks (REINFORCE) also failed: a single forward pass can't match 4-ply search with 1,920 leaf evaluations. Result: -0.8 to -4pp.

#### TD Self-Play (peaked at 89.5%)

Inspired by TD-Gammon: pure self-play with zero domain knowledge. One network plays both sides, learning through temporal consistency. The best variant (128→64→1, 16.5K params) reached **89.5%** but couldn't go further. Larger networks (256→128→1) and sparse topology-aware MLPs both performed worse — the small dense MLP consistently wins. CNN was rejected entirely (63% grid waste, ~6× slower than MLP).

**Why it stalled:** Bridg-It is deterministic. Tesauro noted that in deterministic games, self-play explores "only some very narrow portion of the state space." The value function becomes accurate for visited positions but brittle elsewhere.

#### Supervised Distillation (breakthrough: 78% → 88.5%)

Instead of game outcomes, train the NN to predict the **hand-crafted heuristic's score** at each position — the Stockfish NNUE approach.

Training on root positions (4-ply minimax scores) reached 78% with a small 64→32→1 network (6K params). **Breakthrough:** training on all ~1,920 **leaf positions** from the search tree — 200× more diverse data including hypothetical positions — boosted performance to **88.5%** at 2M samples. More data (5M) slightly regressed, as the small network averages away sharp evaluations. Deeper networks (3-4 layers) also hurt. Training metrics (MSE loss) do not predict game play.

#### Expert Iteration (peak: 92.2%)

The NN + 6-ply search generates training data with deeper evaluations. The NN learns to predict what 6-ply search would say — encoding deeper knowledge. Deploying at 4-ply gives it knowledge beyond its search horizon. This is the AlphaZero pattern: train with expensive deep search, deploy with cheap shallow search.

| Experiment | Benchmark |
|------------|-----------|
| Supervised baseline (2M leaves) | 89.0% |
| Expert iteration 1 (6-ply, 1K games) | **92.0%** |
| Expert iteration 2 | **92.2%** |
| Expert iteration 3 | 91.8% |
| 8-ply expert iteration | 91.0% |

**+3pp in one iteration**, then plateaued. 8-ply training was worse than 6-ply — the NN's small errors compound over more search plies. 5K games was worse than 1K — same over-averaging pattern.

#### Self-Play (failed)

Expert iteration trained Blue against a fixed Red opponent. Once Blue learned to exploit that strategy, further iterations learned nothing new. AlphaZero-style self-play (both sides use same NN + search) should fix this by creating progressively harder training positions.

All variants regressed: 6-ply self-play degraded from 92.2% to 89.4%, 2-ply self-play degraded to 73.2% over 17 iterations. Hybrid training (50% self-play + 50% vs Shannon Red, replay buffer) spent 13 iterations recovering to 90.6% — never surpassing the 92.2% starting point.

**Root cause: catastrophic forgetting.** Self-play produces fundamentally different positions than games against Shannon pairing Red. With only 6K parameters, the network can't accommodate both distributions.

#### Why NNs Don't Help for Bridg-It

1. **BFS distance is already near-perfect.** Bridg-It is a pure connectivity game, and BFS directly measures how far each player is from connecting their boundaries — an exact metric, not an approximation. In chess, the eval function is a crude proxy that NNs can massively improve. In Bridg-It, there's little room.
2. **The strategy space is narrow.** Key features (boundary distances, pair status, gap-bridging) are well-captured by the hand-crafted evaluation.
3. **Distribution mismatch.** Self-play positions differ from benchmark positions. A 6K-parameter network can't serve both.
4. **Deterministic games resist self-play.** Without stochasticity (like dice in backgammon), self-play explores only a narrow slice of the state space.
5. **The evaluation function is not the bottleneck.** NN and heuristic perform identically in the same search framework (~87% in JS minimax). Search depth is the bottleneck — humans exploit the bot with 6-move strategies invisible to 4-ply search.
6. **Smaller networks generalize better.** 64→32→1 (6K params) consistently beats larger architectures. The constraint forces sharper evaluations.
7. **More is not always better.** More data, deeper search (8-ply), and more training iterations all degraded performance — a consistent pattern.

In JavaScript, the NN is only 1.6× faster than BFS — not enough for an extra ply. BFS on a 42-node graph is inherently fast. The NN cannot enable deeper search. Additionally, Red's Shannon pairing implementation has a flaw (Blue wins 59% at strength=1.0, should be 0%), so all benchmark numbers are against a weaker-than-intended opponent.

Best model: 64→32→1, 6,081 params, 92.2% in Python alpha-beta. Not deployed — the WASM heuristic engine outperforms it.

### Move-Level Analysis

Given a recorded game log, move-level analysis identifies which Blue moves were mistakes by replaying each decision point and simulating the rest of the game with human-like opponents:

1. Replay the recorded game up to each Blue turn
2. Try the bot's actual move and the top 5 alternatives (by Blue distance)
3. Play out the rest of the game 20 times against randomly chosen human-like Red opponents
4. Report the win rate for each move

```
Turn 7: played 7,3 (win 70%) — best: 5,11 (win 100%) *** MISTAKE
Turn 8: played 7,7 (win 75%) — best: 7,7 (win 75%)
Turn 9: played 7,9 (win 65%) — best: 7,1 (win 100%) *** MISTAKE
```

This analysis revealed that in early losses, the bot ignored moves with **100% win rate** against human-like Red for 8+ consecutive turns — the pre-filter bottleneck that bd-advancer injection fixed.

## References

- [Bridg-It — HexWiki](https://www.hexwiki.net/index.php/Bridg-It)
- [Shannon Switching Game — Grokipedia](https://grokipedia.com/page/Shannon_switching_game)
- [CMU Lecture Notes — Shannon Switching](https://www.cs.cmu.edu/afs/cs/academic/class/15859-f01/www/notes/shannon.pdf)
- [Leiden University Thesis](https://studenttheses.universiteitleiden.nl/access/item:3762925/view)
- [Cornell Senior Project — Kimberly Wood](https://e.math.cornell.edu/people/belk/projects/KimberlyWood.pdf)
