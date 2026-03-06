# Bridg-It

A browser-based implementation of [Bridg-It](https://en.wikipedia.org/wiki/Bridg-It), a classic connection board game from the 1960s, featuring a bot opponent powered by beam-search minimax with electrical resistance evaluation.

<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/BridgeIt2.svg/500px-BridgeIt2.svg.png" alt="Bridg-It game board" width="300">

### Where to play

**[Play it here](https://mglaezer.github.io/bridgit/)**

## About

Bridg-It is a two-player connection game played on a grid of interlocking red and blue dots. You play as **Red**, trying to connect the **top** row to the **bottom** row. The bot plays as **Blue**, trying to connect the **left** column to the **right** column.

On each turn, you claim one crossing — a gap between two of your dots. Claiming a crossing connects your dots along that edge and simultaneously *blocks* your opponent's perpendicular connection through the same point. The first player to complete a path wins.

Bridg-It is a solved game — Red has a guaranteed winning strategy. But knowing a winning strategy exists and actually executing it over the board are very different things. Can you find and follow the winning strategy under pressure, or will the bot punish your mistakes?

## How to Play

1. **Click** on any gap between two red dots to claim it
2. The bot responds immediately with its blue move (highlighted in light blue)
3. Keep going until someone completes a path
4. Press **New Game** to start over (counts as a forfeit)

## Why Red Wins

Bridg-It is a special case of the [Shannon switching game](https://en.wikipedia.org/wiki/Shannon_switching_game), solved in 1964 by Alfred Lehman. The key insight: Blue's graph of 61 crossings + 10 boundary edges can be partitioned into L (a spanning tree, 31 edges) and R (a 2-component forest, 30 edges). R falls one edge short of a spanning tree. Since Blue lacks two edge-disjoint spanning trees, Lehman's theorem proves Blue has no guaranteed win.

Red exploits this by maintaining its own partition. After Red's first move bridges R's gap, both L and R become spanning trees. From then on, whichever tree Blue breaks, Red repairs from the other. This pairing strategy is unbeatable.

The bot plays Blue — the losing side. There is no winning theorem to follow, so the bot uses practical search to exploit human mistakes.

## The Bot's Strategy

The bot combines seven techniques. Each was validated by ablation testing over 122 games (61 openings × 2 Red variants).

**1. Electrical Resistance Evaluation**

The board is modeled as a resistor network: unclaimed crossings are 1Ω resistors, claimed crossings are wires, opponent crossings are removed. Voltages are solved via Gauss-Seidel iteration. Lower resistance = stronger position, capturing all parallel paths simultaneously — something BFS shortest-path cannot do.

```
score = red_resistance × 2000 − blue_resistance × 1000
```

The 2:1 defensive bias reflects Blue's second-player disadvantage.

**2. Voltage-Based Move Ordering**

Voltage drops across crossings measure current flow — how critical each crossing is as a bottleneck. This ranks all candidate moves with just 2 resistance computations (one per player), replacing per-move evaluation that required ~120 computations.

**3. Pairing Repair Detection**

The bot maintains Blue's partition (L = spanning tree, R = 2-component forest). After Red cuts an edge, the bot identifies valid repair edges and boosts their scores. Gap-bridging moves (connecting R's two components) get the highest bonus.

**4. Beam-Search Minimax**

6-ply beam search at Expert strength (widths 61×20×20×10 + 8×6). All candidates are scored by voltage drops + repair bonuses, then the top moves are searched with full resistance evaluation at leaf nodes.

**5. Adaptive Depth**

When ≤28 crossings remain (above the endgame solver threshold of 14), search increases from 6-ply to 8-ply. The narrower late-game branching factor makes this affordable (~0.5-1.5s vs ~20ms per move).

**6. Opening Book**

Blue's second move uses a 610-entry precomputed lookup table (61 openings × top 10 Red responses), generated offline at depth 8 by `wasm/gen_opening_book.js`.

**7. First-Move Adjacency Blocking**

On Blue's first move, resistance evaluation is boundary-biased (a physics property, not a tuning issue). Instead, the bot restricts candidates to the 4-6 crossings adjacent to Red's opening and picks the one that maximizes Red's BFS distance, with center tiebreak.

### Design Philosophy

Blue is theoretically lost — so the bot is an adversarial optimizer: every move maximizes the chance a human makes a mistake. Repair bonuses keep Blue's partition healthy, resistance evaluation creates positional pressure, and minimax anticipates Red's strongest responses.

## WASM Search Engine

Written in C, compiled to WebAssembly via Emscripten. Uses precomputed topology tables, static arrays (no heap allocation), union-find for component merging, and Gauss-Seidel iteration for resistance. Output: ~28KB `.wasm` + ~12KB JS loader, runs client-side with no server.

Five difficulty levels: Beginner (2-ply) through Expert (6-ply, adaptive to 8-ply). Expert evaluates positions in ~20ms per move in opening/midgame, ~0.5-1.5s in late game.

## Board Layout

`(2N+1) × (2N+1)` grid (13×13 for N=6). Cell roles by coordinate parity: `(even, odd)` = Red dot, `(odd, even)` = Blue dot, `(even, even)` and `(odd, odd)` = crossings. For N=6: 42 dots per player, 61 playable crossings, 20 boundary edges.

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

## Overlays

Three debug overlays show Red's game-theoretic strategy. Toggle with **L**, **R**, **W** buttons or keys **1**, **2**, **3**.

| Button | What it shows |
|--------|---------------|
| **L** | Red's spanning tree partition — the edges Red is maintaining |
| **R** | Red's 2-component forest — the backup edges for repairs |
| **W** | Optimal Red moves (green) — play these to guarantee a win |

## Development

Built over 50+ experiments across several generations. Most ideas made things worse.

### Evolution

The bot started with BFS shortest-path evaluation and 1-ply search. Early gains came from adding pairing repair bonuses (+31pp), then deepening to 4-ply minimax (+5pp) and widening the beam (20 Blue candidates instead of 12). A tournament against realistic opponents — greedy attackers, balanced players, balanced players with noise — revealed the bot was over-tuned for Shannon pairing and weak against human-like play. Widening Red's response model and modeling Red as a balanced player (not pure attacker) added +17pp against realistic opponents.

Human playtesting exposed a different problem: the bot over-defended against threats humans never make. Scaling repair bonuses by urgency and injecting path-advancing moves back into the candidate pool when pairing bonuses pushed them out fixed all recorded human losses.

The biggest single improvement was switching from BFS to electrical resistance evaluation (+22pp). Depth-4 resistance beats depth-8 BFS because it captures all parallel paths simultaneously. Voltage-based move ordering added another +10pp by identifying bottleneck crossings with just 2 computations instead of ~120.

Late-game adaptive depth (+2pp) and a precomputed opening book (+2pp) were the final additions, both validated by ablation testing.

### What didn't work

Wider beams (more noise), deeper search with narrow beams (missed good moves), Monte Carlo rollouts (too noisy), expectimax (weakened defenses), alpha-beta pruning (incompatible with beam-search score adjustments), fork detection (Blue needs offense, not more defense), bridge/virtual connection bonuses (too noisy in early game), mustplay pruning (voltage drops already do this), SOR with higher conductance (boundary-biased), phase-dependent evaluation weights (≤1 game difference in ablation), human-predictive Red move ordering (zero contribution in ablation).

Six neural network training methodologies (game outcomes, TD self-play, supervised distillation, expert iteration, AlphaZero-style self-play) peaked at 92.2% with a 6K-parameter MLP — still below resistance evaluation. The NN experiments predate the resistance breakthrough.

### Key lessons

- **Benchmark opponents matter as much as the algorithm.** Optimizing against an unrealistic opponent led to over-tuning for a scenario that rarely occurs.
- **Paired testing is essential.** Both bots face identical opponent sequences, eliminating variance. Many changes that appeared to help were actually noise.

## References

- [Bridg-It — HexWiki](https://www.hexwiki.net/index.php/Bridg-It)
- [Shannon Switching Game — Grokipedia](https://grokipedia.com/page/Shannon_switching_game)
- [CMU Lecture Notes — Shannon Switching](https://www.cs.cmu.edu/afs/cs/academic/class/15859-f01/www/notes/shannon.pdf)
- [Leiden University Thesis](https://studenttheses.universiteitleiden.nl/access/item:3762925/view)
- [Cornell Senior Project — Kimberly Wood](https://e.math.cornell.edu/people/belk/projects/KimberlyWood.pdf)
