# Bridg-It Bot Improvement Strategy

## History: What We Tried and What Failed

### Beam Search Tuning with BFS (all failed at depth 8)

Heuristic changes:
- bdBias=0: -4.9pp
- pathWidth in scoring: 0pp
- pathWidth in EVAL_LEAF: -6.6pp
- Weight tuning (rdMin, rdSum, bdWeight): 0 divergence
- Simplified EVAL_LEAF (removed rdSum+fragility): -4.9pp

Structural search changes:
- Alpha-beta pruning: 0pp divergence, ~50% speedup (speed, not strength)
- Wider beams [61,8,14,10]+[10,6]: -4.1pp
- Wider Red ply-1 [61,12,10,8]+[8,6]: -1.6pp
- Local Red re-ordering at ply 1: -11pp
- Iterative deepening (depth-6 pre-pass): 0% speedup
- Variable depth (depth-10 for top 5): -11.5pp
- Endgame solver (exact minimax, ≤14 empties): 0pp (already correct)

**Every BFS-based change regressed or was neutral.** Root cause: BFS shortest-path is inherently weak for connection games — it only sees one path and misses path redundancy/fragility.

### Root Cause and Fix

Four research agents concluded the evaluation function was the bottleneck. BFS distance noise amplifies through deeper search, explaining all regressions. Solution: electrical resistance evaluation, used by Wolve (Computer Olympiad winner with just 2-ply + resistance).

## Electrical Resistance Evaluation (implemented, validated)

### How it works

Model the board as an electrical circuit:
- Unclaimed crossing = 1 ohm resistor
- Player-claimed crossing = wire (0 ohms)
- Opponent-claimed crossing = removed
- Boundary dots merged into supernodes via union-find
- Solve voltages via Gauss-Seidel (15 iterations)
- Resistance = 1 / total current

Lower resistance = stronger position. Captures ALL paths simultaneously — parallel paths add up, bottlenecks are naturally penalized.

### Where it's used

1. EVAL_LEAF: `leafScore = rr * RED_W - br * BLUE_W` (full resistance at search leaves)
2. Voltage-drop move ordering (Steps 1 & 5): 2 Gauss-Seidel solves total instead of N×2
3. No post-minimax bd bias (resistance subsumes it)
4. BFS retained only for instant-win check (bd==0) and emergency handler (redDist<=1)

### Bug fixes

- Emergency handler tiebreaker: was comparing rdSum against itself (tracked crossing index instead of scored-array index). Fixed.
- Depth < 4 finalScore: was applying bd*300 bias even with resistance. Fixed.
- Alpha0 pruning bound: was inconsistent for resistance mode. Fixed.

### Benchmark results (all vs frozen baseline: BFS depth-8, widths [61,8,10,8]+[8,6])

| Configuration | Wins | Rate | Net gain | Avg time/move |
|---|---|---|---|---|
| BFS depth-8 (baseline) | 67/122 | 54.9% | — | ~450ms |
| Resistance depth-4, width [61,20] | 84/122 | 68.9% | +14pp | ~2ms |
| Resistance depth-4, width [61,40] | 88/122 | 72.1% | +17pp | ~3ms |
| Resistance depth-6, narrow [61,6,8,4] | 79/122 | 64.8% | +10pp | ~9ms |
| Resistance depth-6, wide [61,20,20,10]+[8,6] | 94/122 | 77.0% | +22.1pp | ~38ms |
| Resistance depth-8, standard [61,8,10,8]+[8,6] | 71/122 | 58.2% | +3pp | ~167ms |
| Resistance d6 wide + asymmetric 2000/1000 | 97/122 | 79.5% | +24.6pp | ~38ms |
| **Resistance d6 wide + voltage-drop ordering** | **110/122** | **90.2%** | **+35.2pp** | **~20ms** |

### Key insights

1. With good evaluation, wider search beats deeper search. Depth 6 wide (+22pp) >> depth 8 narrow (+3pp).
2. Resistance at depth 4 alone (+14-17pp) already beats BFS at depth 8. Confirms the Wolve finding.
3. Depth 8 with resistance barely helps because the narrow beam misses good moves. The evaluation is now so accurate that seeing more candidate moves matters more than looking further ahead.
4. The winning config (depth 6 wide) is 10x faster than the old bot (38ms vs 450ms).

### Asymmetric resistance weighting (implemented, validated)

Problem: bot overvalued building its own path vs blocking Red. In a real game, bot played 7,11 and 7,9 (far-right path building) while Red advanced unchallenged through the center.

Fix: `score = red_R * RED_W - blue_R * BLUE_W` where RED_W > BLUE_W.

| Config | Wins | Rate |
|--------|------|------|
| 1000/1000 (symmetric) | 94/122 | 77.0% |
| 1500/1000 | 96/122 | 78.7% |
| **2000/1000** | **97/122** | **79.5%** |
| 2500/1000 | 96/122 | 78.7% |

Best ratio: 2:1 (blocking Red weighted 2x vs building own path). Net +2.5pp.

### Voltage-based move ordering (implemented, validated)

Problem: Steps 1 and 5 computed N×2 full resistance evaluations per move (place stone → compute resistance). This was slow (~120 resistance computations per move) and ranked all openings similarly since one stone barely changes the network.

Fix: Compute voltage drops across all empty crossings once (2 Gauss-Seidel solves total), then rank each crossing by `red_vdrop * RED_W + blue_vdrop * BLUE_W`. Voltage drop = current flowing through that crossing = how critical it is as a bottleneck.

| Config | Wins | Rate | Net gain |
|--------|------|------|----------|
| Resistance N×2 scoring (prev best) | 97/122 | 79.5% | +24.6pp |
| **Voltage-drop ordering** | **110/122** | **90.2%** | **+35.2pp** |

Net improvement: +13 games / +10.7pp. Also ~2x faster (Steps 1+5 go from ~240 resistance computations to 2).

Why it works: voltage drops concentrate near existing stones and bottlenecks. A single Red stone at 2,6 creates high current through adjacent crossings in Red's network, naturally prioritizing nearby blocking moves. The old approach (try each move, compute full resistance) couldn't detect this because placing one Blue stone on a 61-crossing board barely changes total resistance.

## Production configuration

**Depth 6, beam widths [61, 20, 20, 10] + [8, 6], resistance enabled, weights 2000/1000, voltage-drop move ordering.**

### What failed on top of resistance

| Change | Result | Notes |
|---|---|---|
| SOR (omega=1.6) + conductance 2.0 + 30 iterations | 88/122 (72.1%) = -5pp | Conductance overweighted boundary moves |
| Wider beams [61,61,50,25]+[16,12] | 90/122 (73.8%) = -3.3pp | More candidates = more noise |
| Deeper d8 narrow [61,14,10,6]+[4,3]+[2,2] | 65/122 (53.3%) = -23.8pp | Narrow beams at d8 miss good moves |
| Bridge/virtual connection detection (forced override) | Fires every move | Too many sole connections in early game |
| Bridge bonus in scoring (+30 to +200 for bridge crossings) | 92/122 (75.4%) = -1.6pp | Noise, doesn't help |
| Mustplay bonus (+5000 for rdMin > redDist crossings) | 109/122 (89.3%) = -0.9pp | Voltage drops already capture bottlenecks |
| Mustplay injection (inject all rdMin > redDist into pool) | 109/122 (89.3%) = -0.9pp | Same: BFS mustplay too coarse |
| Wider beams with voltage [61,30,30,15]+[10,8] | 105/122 (86.1%) = -4.1pp | More candidates = more noise, consistent |
| Deeper d8 with voltage [61,20,14,10]+[8,6]+[4,3] | 84/122 (68.9%) = -21.3pp | Narrow deep beams still lose, consistent |
| Symmetric weights 1000/1000 with voltage | 101/122 (82.8%) = -7.4pp | Asymmetric still needed |
| Higher weights 3000/1000 with voltage | 109/122 (89.3%) = -0.9pp | 2000/1000 remains optimal |

### Self-play benchmark

Resistance Blue vs Resistance Red, both d6 [61,20,20,10]+[8,6]:
- Blue wins: 44/122 (36.1%), Red wins: 78/122 (63.9%)
- Red has first-move advantage as expected in Bridg-It

### Research findings

**Shannon switching game / connection game literature:**

- Bridg-It is a **solved game** (Lehman 1964) — first player always wins with perfect play
- Computer Olympiad progression: Wolve (alpha-beta+resistance) → MoHex (MCTS+RAVE) → MoHex-CNN → KataHex (AlphaZero)
- "Minimax Strikes Back" (AAMAS 2023): minimax + strong evaluation beats MCTS for connection games — validates our beam search architecture
- Virtual connections / bridge detection worth ~100 Elo in MoHex (but requires MCTS integration, pure beam search version regressed)

**Techniques from Wolve/MoHex/Hex literature (ranked by expected impact):**

1. ~~**Mustplay pruning** (est. +150-300 Elo)~~: **Tested, neutral.** BFS-based mustplay (rdMin > redDist) too coarse — voltage drops already identify bottlenecks better. Real Wolve mustplay uses H-search / virtual connections for tighter carriers, which would require a fundamentally different architecture.
2. ~~**Voltage-based move ordering** (est. +100-200 Elo)~~: **Implemented.** +10.7pp over previous best. Per-crossing current flow replaces expensive N×2 resistance scoring.
3. **Dead/captured cell pruning**: Cells provably irrelevant to the outcome can be eliminated. Reduces effective board size.
4. **H-search for virtual connections**: Detects combinatorial patterns where a player can connect regardless of opponent's response. More sophisticated than simple bridge detection.
5. **Null move pruning, LMR, aspiration windows**: Standard alpha-beta enhancements applicable to beam search.

## Possible future improvements

- MCTS with RAVE (fundamentally different and stronger search algorithm)
- Neural network evaluation trained via self-play
