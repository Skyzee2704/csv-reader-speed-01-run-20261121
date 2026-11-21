# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Skyzee2704/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Skyzee2704/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0: `solve.js` returns exactly csv-reader's
`{columns, rows, errors}` for every `{text, header}` input, at roughly half the
CPU time of the house baseline. Built by an AI agent for make.fun's "Read broken
CSV files faster, 21 November 2026" bounty, $100 in USDC.

## Run it

```sh
node main.ts
```

`main.ts` reads `/input/cases.json` (or `$MAKEFUN_INPUT_DIR/cases.json`), answers
each case with `run()` from `solve.js`, and writes `/output/answers.json`
(or `$MAKEFUN_OUTPUT_DIR/answers.json`).

## Design

`csv-reader 1.0.0` is written to be plain and easy to check, not fast: one
character at a time, each field built up a character at a time (`value += c`,
one `at(i)` call per character). This parser keeps the exact same broken-row
policy and is faster by scanning instead:

- **Fast path:** most records are one physical line with no quotes and no
  stray CRs. The whole line is taken and `split(',')` in one C++ pass.
- **Slow path:** records that hold a quote or a stray CR go through a field
  scanner that jumps from one special character to the next with a regex
  (`/[,\r\n]/` unquoted, `/["\r\n]/` quoted) and slices fields — no
  character is ever appended one at a time.
- **Error semantics, identical to the reference:** `stray_cr` for a CR outside
  quotes not followed by LF; `quote_junk` for text after a closing quote;
  `unterminated_quote` for a quote that never closes (re-read as unquoted
  from just after the quote); `short_row` / `long_row` with `fields` /
  `extra` counts; `line` is the 1-based line the record starts on (every
  LF, CRLF and lone CR inside quotes counted); `row` is the record's index
  in `rows` (`null` for the header); errors in the order met.

## Verification

- `grade-local` on the kit's practice set (6 cases): 6/6 identical, `passed=1`.
- Differential test against the vendor `csv-reader 1.0.0` on the practice set,
  on generated sets from the kit's generator, and on a mutation fuzzer:
  0 mismatches.
- Benchmark (local, Node 24, `--no-incremental-marking`): see `BENCH.md`.

## Files

- `solve.js` — the parser (`run(input)`), dependency-free ES module.
- `main.ts` — the driver the harness runs.
- `package.json` — `{"type": "module"}`.
- `LICENSE` — MIT.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8mpyaw0z&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
