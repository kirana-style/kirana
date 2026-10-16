# Benchmarks
Source: https://kirana.style/docs/project/benchmarks

# Benchmarks

Every number the site quotes comes from
[kirana-lab](https://github.com/kirana-style/kirana-lab), a public repository
that builds the same three applications three ways: with the published Kirana
release, with a StyleX port and with the Tailwind original. The StyleX port is
built twice, by StyleX's Babel plugin and by its Rust compiler on SWC, so a
comparison with StyleX holds whichever one you use. It measures on every Kirana
release and once a week, so an update to StyleX or Tailwind shows up too, and the
site takes the newest run through a pull request.

The figures below are Kirana 0.2.0.

| | |
| --- | --- |
| Kirana | 0.2.0, from npm |
| Date | 2026-10-15 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB, Linux 7.0.0-1017-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 155.0.8059.84 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs |
| Conformance | web passed, blocks passed, examples passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/38826139395 |

## How to read it

Each cell is the median of every round. **Kirana ÷ StyleX** is Kirana's median
over StyleX's, so below 1 is lower for Kirana, and lower is better for every
measure. Beside each ratio is its 95 % confidence interval, from resampling the
rounds, and a difference is called one only when that interval excludes 1. A
ratio whose interval includes 1 is "no clear difference", and the site words it
as "level".

**StyleX** is the port built by StyleX's Babel plugin, and **StyleX (SWC)** the
same port built by `@stylexswc/unplugin`. Where the site makes one claim about
StyleX, it compares Kirana with whichever of the two Kirana does less well
against on that measure, and names it.

Before anything is timed, the builds of each app are crawled and compared
property by property, at three widths in both colour schemes; the SWC build is
compared with the Babel one. A run whose builds
do not render alike publishes its numbers as a pre-release, and the site does not
take them.

## Where Kirana is behind

Every measure on which Kirana measured higher, by its interval:

- Build, cold, apps/blocks: 1.04× Tailwind (1.04–1.05)
- Build, cold, apps/examples: 1.013× Tailwind (1.002–1.024)
- CSS, apps/web: 1.17× StyleX (1.17–1.17)
- CSS, apps/blocks: 1.12× StyleX (1.12–1.12)
- CSS, apps/examples: 1.16× StyleX (1.16–1.16)
- CSS, all three apps: 1.15× StyleX (1.15–1.15)
- CSS, gzip, apps/web: 1.04× StyleX (1.04–1.04)
- CSS, gzip, apps/blocks: 1.01× StyleX (1.01–1.01)
- CSS, gzip, apps/examples: 1.02× StyleX (1.02–1.02)
- CSS, gzip, all three apps: 1.02× StyleX (1.02–1.02)
- CSS, brotli, apps/web: 1.02× StyleX (1.02–1.02)
- JavaScript, gzip, apps/examples: 1.003× Tailwind (1.003–1.003)
- Colour-scheme switch, style recalc, apps/web, CPU throttled 4×, about 6211 elements: 1.04× StyleX (1.01–1.06)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |
| Build, cold | 10.97 s | 35.22 s | 10.93 s | 0.31× (0.31–0.31) lower | 1.004× (0.997–1.011) no clear difference |
| CSS | 262.5 kB | 228.2 kB | 586.5 kB | 1.15× (1.15–1.15) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 64.1 kB | 62.8 kB | 87.1 kB | 1.02× (1.02–1.02) higher | 0.74× (0.74–0.74) lower |
| CSS, brotli | 54.9 kB | 55.3 kB | 69.5 kB | 0.99× (0.99–0.99) lower | 0.79× (0.79–0.79) lower |
| JavaScript | 4837.1 kB | 4880.7 kB | 4963.2 kB | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 1558.9 kB | 1606.8 kB | 1572.6 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 1623.0 kB | 1669.6 kB | 1659.7 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower |
| Style rules | 4,304 | 3,878 | 2,460 | not judged | not judged |
| Declarations | 4,820 | 4,370 | 3,674 | not judged | not judged |

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |
| Build, cold | 2.81 s | 6.90 s | 3.00 s | 0.41× (0.40–0.42) lower | 0.94× (0.92–0.95) lower |
| CSS | 76.7 kB | 65.4 kB | 184.2 kB | 1.17× (1.17–1.17) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 18.5 kB | 17.8 kB | 26.9 kB | 1.04× (1.04–1.04) higher | 0.69× (0.69–0.69) lower |
| CSS, brotli | 16.1 kB | 15.8 kB | 21.7 kB | 1.02× (1.02–1.02) higher | 0.74× (0.74–0.74) lower |
| JavaScript | 866.3 kB | 875.3 kB | 889.8 kB | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 278.9 kB | 284.9 kB | 282.5 kB | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 297.4 kB | 302.7 kB | 309.4 kB | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| Style rules | 1,189 | 1,059 | 724 | not judged | not judged |
| Declarations | 1,361 | 1,223 | 1,090 | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |
| Build, cold | 4.20 s | 16.05 s | 4.02 s | 0.26× (0.26–0.26) lower | 1.04× (1.04–1.05) higher |
| CSS | 90.9 kB | 80.9 kB | 204.0 kB | 1.12× (1.12–1.12) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 22.3 kB | 22.2 kB | 30.4 kB | 1.01× (1.01–1.01) higher | 0.73× (0.73–0.73) lower |
| CSS, brotli | 19.0 kB | 19.4 kB | 24.1 kB | 0.98× (0.98–0.98) lower | 0.79× (0.79–0.79) lower |
| JavaScript | 1911.6 kB | 1927.5 kB | 1985.8 kB | 0.99× (0.99–0.99) lower | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 645.0 kB | 665.7 kB | 657.4 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 667.3 kB | 687.9 kB | 687.8 kB | 0.97× (0.97–0.97) lower | 0.97× (0.97–0.97) lower |
| Style rules | 1,524 | 1,404 | 881 | not judged | not judged |
| Declarations | 1,696 | 1,568 | 1,298 | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |
| Build, cold | 3.96 s | 12.25 s | 3.90 s | 0.32× (0.32–0.33) lower | 1.013× (1.002–1.024) higher |
| CSS | 94.9 kB | 81.9 kB | 198.4 kB | 1.16× (1.16–1.16) higher | 0.48× (0.48–0.48) lower |
| CSS, gzip | 23.3 kB | 22.8 kB | 29.7 kB | 1.02× (1.02–1.02) higher | 0.78× (0.78–0.78) lower |
| CSS, brotli | 19.8 kB | 20.0 kB | 23.7 kB | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| JavaScript | 2059.1 kB | 2077.9 kB | 2087.7 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower |
| JavaScript, gzip | 634.9 kB | 656.2 kB | 632.8 kB | 0.97× (0.97–0.97) lower | 1.003× (1.003–1.003) higher |
| CSS + JavaScript, gzip | 658.2 kB | 679.0 kB | 662.6 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower |
| Style rules | 1,591 | 1,415 | 855 | not judged | not judged |
| Declarations | 1,763 | 1,579 | 1,286 | not judged | not judged |

## In the browser

The `web` app is grown to the same number of elements in each build, the CPU is
throttled, and Chrome's own counters are read through the DevTools protocol: the
style recalculation when the colour scheme switches, a hover, layout, and the
95th percentile of frame times.

### CPU throttled 4×

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |

### CPU throttled 6×

| Measure | Kirana | StyleX | Tailwind | Kirana ÷ StyleX | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- |

## What it does not say

- **The machine is a shared CI runner.** Absolute times move from run to run,
  and GitHub does not promise the same processor twice: the run above names the
  one it had. Compare ratios within one run, never times from two runs.
- **Three applications are one corpus.** They are a shadcn/ui port: many small
  components, shared tokens. A codebase with other habits may measure otherwise,
  and the lab's corpus will grow.
- **The editor is not measured here yet.** The language server's latency and the
  time from saving a file to the updated stylesheet are from one developer
  machine, in
  [the benchmark notes](https://github.com/kirana-style/kirana/blob/main/packages/kirana/design-notes/benchmark-results.md).

The rules a quoted number has to meet, the fairness checks and the statistics are
in the lab's
[METHODOLOGY.md](https://github.com/kirana-style/kirana-lab/blob/main/METHODOLOGY.md).
