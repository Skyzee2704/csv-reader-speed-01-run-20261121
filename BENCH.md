# Benchmark

Measured locally, not on the house (different machine — absolute times are not
comparable to the house's 1.38 s; the ratio is the signal).

- Machine: this VM, Node v24.22.1, `node --no-incremental-marking`.
- Input: the kit's practice set — 6 cases, 10,193,953 bytes, 63,692 rows.
- Method: each parser run on all 6 cases per round; 2 warmup rounds, then 7
  measured rounds, order alternating each round; process CPU time
  (user + system) via `process.cpuUsage()`.

| round | mine (CPU ms) | csv-reader 1.0.0 (CPU ms) |
|------:|--------------:|--------------------------:|
| 1 | 284 | 664 |
| 2 | 309 | 710 |
| 3 | 385 | 678 |
| 4 | 285 | 595 |
| 5 | 292 | 636 |
| 6 | 284 | 654 |
| 7 | 287 | 783 |

- Median CPU: mine **287 ms**, baseline **664 ms** — **2.32x faster**
  (56.8% less CPU). Median wall: mine 224 ms, baseline 528 ms.
- Throughput: mine 35.5 MB/s CPU, baseline 15.4 MB/s CPU.

House baseline (from the bounty Recon, gVisor 1 CPU): 1.38 s CPU/set. If the
2.32x ratio held on the house, this entry would land around 0.59 s — that is a
projection from the local ratio, not a measurement on the house.

Correctness behind the speed: `grade-local --driver process` on the practice
set passes 6/6; differential tests against the vendor reader (practice set,
30 generated sets, 164 hand edge cases, 2,000 mutation fuzz, 5,000 random
fuzz) found 0 mismatches.
