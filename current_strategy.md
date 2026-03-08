# Blue Bot Improvement Strategy

## Current: 108/122 (88.5%) — up from 98/122 (80.3%)

Active techniques: electrical resistance evaluation, voltage-based move ordering (now used at ply 2), pairing repair detection, beam-search minimax (6-ply, widths 61×20×18×12 + 8×6), adaptive depth (8-ply when ≤28 unclaimed), opening book (610 entries for move 2), first-move adjacency blocking, endgame exact solver (≤14 unclaimed).

## Changes Made

### 1. Voltage-based ply-2 ordering (code change)
Previously, Blue's ply-2 follow-up moves were sorted by BFS distance (`cmp_blue_by_bd`). Now when resistance is enabled, they're sorted by voltage score (`cmp_blue_desc`), which uses voltage drops from the pre-computed resistance network. This gives better move ordering at ply 2, matching the successful voltage ordering already used at ply 0.

### 2. Beam width retuning (config change)
Expert widths changed from `[61, 20, 20, 10]` to `[61, 20, 18, 12]`:
- Ply-2 Blue beam: 20 → 18 (slightly narrower — better ordering means fewer candidates needed)
- Ply-3 Red beam: 10 → 12 (wider — Blue now considers more Red threats, defending better)

These changes are synergistic: better ply-2 ordering makes narrowing safe, and the freed compute budget allows widening ply-3 Red responses.

## Full Beam Width Exploration Results

| Width Config (ply-0, 1, 2, 3) | Wins/122 | Rate | vs old baseline |
|-------------------------------|----------|------|-----------------|
| **61, 20, 18, 12** | **108/122** | **88.5%** | **+10** |
| 61, 20, 18, 10 | 105/122 | 86.1% | +7 |
| 61, 20, 18, 14 | 105/122 | 86.1% | +7 |
| 61, 20, 20, 12 | 105/122 | 86.1% | +7 |
| 61, 20, 16, 10 | 105/122 | 86.1% | +7 |
| 61, 20, 16, 12 | 103/122 | 84.4% | +5 |
| 61, 20, 15, 8 | 101/122 | 82.8% | +3 |
| 61, 20, 20, 10 (old) | 98/122 | 80.3% | baseline |
| 61, 20, 15, 6 | 96/122 | 78.7% | -2 |
| 61, 20, 20, 8 | 93/122 | 76.2% | -5 |
| 61, 20, 12, 10 | 90/122 | 73.8% | -8 |
| 61, 20, 10, 10 | 86/122 | 70.5% | -12 |

## What Was Tried and Didn't Help

### Round 1: Endgame solver & convergence (all regressed)
| Change | Wins/122 | Rate | Delta |
|--------|----------|------|-------|
| Red move ordering in exact_solve (t14) | 91/122 | 74.6% | -7 |
| Red ordering + threshold 16 | 94/122 | 77.0% | -4 |
| Red ordering + threshold 18 | 93/122 | 76.2% | -5 |
| GS convergence early exit | 91/122 | 74.6% | -7 |
| SOR omega=1.3 | 97/122 | 79.5% | -1 |

Why Red ordering regressed: the endgame solver assumes perfect Red play. Since Blue is theoretically lost, better Red ordering just confirms Blue's loss faster without changing the outcome. The old unordered traversal sometimes accidentally missed Red wins, giving Blue "undeserved" wins.

### Round 2: Search architecture (most regressed)
| Change | Wins/122 | Rate | Delta |
|--------|----------|------|-------|
| Red beam width 25 | 93/122 | 76.2% | -5 |
| Adaptive depth threshold 35 | 90/122 | 73.8% | -8 |
| Context-dependent Red ordering | 92/122 | 75.4% | -6 |
| Dynamic Red width | 91/122 | 74.6% | -7 |
| SOR + voltage ply-2 combo | 98/122 | 80.3% | 0 |

## Research Findings (from agent team)

### Connection game literature
- Bridg-It is a solved game (Lehman 1964) — Red always wins with perfect play
- Wolve won Computer Olympiad with alpha-beta + resistance + virtual connections at just 2-ply
- "Minimax Strikes Back" (AAMAS 2023): minimax + strong evaluation beats MCTS — validates beam-search
- Virtual connections augmenting resistance networks (Wolve's approach) remain unexplored here

### Code analysis findings
- Losses cluster in mid-to-late game
- Endgame solver is only useful when Blue CAN win (rare since Blue is theoretically lost)
- Wider search introduces noise; better ordering is more valuable than more candidates

## Remaining Ideas (diminishing returns expected)
1. **Transposition table** — cache resistance evaluations to avoid redundant computation
2. **History heuristic** — track tactically important crossings across positions
3. **VC-augmented resistance** — add virtual edges for bridge patterns (Wolve's key innovation)
4. **Extend opening book to move 3** — ~6,100 entries, covers early midgame
