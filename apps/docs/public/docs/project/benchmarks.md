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

The figures below are Kirana 0.2.1.

| | |
| --- | --- |
| Kirana | 0.2.1, from npm |
| Date | 2026-10-16 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, @stylexswc/unplugin 0.19.1, @stylexswc/rs-compiler 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB, Linux 7.0.0-1017-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 155.0.8059.84 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs |
| Conformance | web passed, blocks passed, examples passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/38868790222 |

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

- Build, cold, apps/blocks: 1.05× Tailwind (1.04–1.06)
- CSS, apps/web: 1.17× StyleX (1.17–1.17)
- CSS, apps/web: 1.15× StyleX (SWC) (1.15–1.15)
- CSS, apps/blocks: 1.12× StyleX (1.12–1.12)
- CSS, apps/blocks: 1.10× StyleX (SWC) (1.10–1.10)
- CSS, apps/examples: 1.16× StyleX (1.16–1.16)
- CSS, apps/examples: 1.14× StyleX (SWC) (1.14–1.14)
- CSS, all three apps: 1.15× StyleX (1.15–1.15)
- CSS, all three apps: 1.13× StyleX (SWC) (1.13–1.13)
- CSS, gzip, apps/web: 1.04× StyleX (1.04–1.04)
- CSS, gzip, apps/web: 1.04× StyleX (SWC) (1.04–1.04)
- CSS, gzip, apps/blocks: 1.01× StyleX (1.01–1.01)
- CSS, gzip, apps/blocks: 1.01× StyleX (SWC) (1.01–1.01)
- CSS, gzip, apps/examples: 1.02× StyleX (1.02–1.02)
- CSS, gzip, apps/examples: 1.02× StyleX (SWC) (1.02–1.02)
- CSS, gzip, all three apps: 1.02× StyleX (1.02–1.02)
- CSS, gzip, all three apps: 1.02× StyleX (SWC) (1.02–1.02)
- CSS, brotli, apps/web: 1.02× StyleX (1.02–1.02)
- CSS, brotli, apps/web: 1.01× StyleX (SWC) (1.01–1.01)
- JavaScript, apps/blocks: 1.002× StyleX (SWC) (1.002–1.002)
- JavaScript, gzip, apps/examples: 1.003× Tailwind (1.003–1.003)
- Layout, apps/web, CPU throttled 4×, about 6211 elements: 1.06× StyleX (SWC) (1.01–1.15)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 11.22 s | 36.10 s | 18.48 s | 11.16 s | 0.31× (0.31–0.31) lower | 0.61× (0.60–0.61) lower | 1.01× (0.99–1.01) no clear difference |
| CSS | 262.5 kB | 228.2 kB | 232.3 kB | 586.5 kB | 1.15× (1.15–1.15) higher | 1.13× (1.13–1.13) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 64.1 kB | 62.8 kB | 62.8 kB | 87.1 kB | 1.02× (1.02–1.02) higher | 1.02× (1.02–1.02) higher | 0.74× (0.74–0.74) lower |
| CSS, brotli | 54.9 kB | 55.3 kB | 55.5 kB | 69.5 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.79× (0.79–0.79) lower |
| JavaScript | 4.84 MB | 4.88 MB | 4.84 MB | 4.96 MB | 0.99× (0.99–0.99) lower | 0.999× (0.999–0.999) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 1.56 MB | 1.61 MB | 1.59 MB | 1.57 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 1.62 MB | 1.67 MB | 1.65 MB | 1.66 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| Style rules | 4,304 | 3,878 | 4,016 | 2,460 | not judged | not judged | not judged |
| Declarations | 4,820 | 4,370 | 4,499 | 3,674 | not judged | not judged | not judged |

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.89 s | 7.05 s | 4.65 s | 3.06 s | 0.41× (0.40–0.41) lower | 0.62× (0.62–0.63) lower | 0.94× (0.94–0.95) lower |
| CSS | 76.7 kB | 65.4 kB | 66.5 kB | 184.2 kB | 1.17× (1.17–1.17) higher | 1.15× (1.15–1.15) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 18.5 kB | 17.8 kB | 17.8 kB | 26.9 kB | 1.04× (1.04–1.04) higher | 1.04× (1.04–1.04) higher | 0.69× (0.69–0.69) lower |
| CSS, brotli | 16.1 kB | 15.8 kB | 15.9 kB | 21.7 kB | 1.02× (1.02–1.02) higher | 1.01× (1.01–1.01) higher | 0.74× (0.74–0.74) lower |
| JavaScript | 866.3 kB | 875.3 kB | 874.5 kB | 889.8 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 278.9 kB | 284.9 kB | 284.6 kB | 282.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 297.4 kB | 302.7 kB | 302.5 kB | 309.4 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| Style rules | 1,189 | 1,059 | 1,101 | 724 | not judged | not judged | not judged |
| Declarations | 1,361 | 1,223 | 1,262 | 1,090 | not judged | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 4.28 s | 16.55 s | 7.14 s | 4.09 s | 0.26× (0.26–0.26) lower | 0.60× (0.59–0.61) lower | 1.05× (1.04–1.06) higher |
| CSS | 90.9 kB | 80.9 kB | 82.3 kB | 204.0 kB | 1.12× (1.12–1.12) higher | 1.10× (1.10–1.10) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 22.3 kB | 22.2 kB | 22.2 kB | 30.4 kB | 1.01× (1.01–1.01) higher | 1.01× (1.01–1.01) higher | 0.73× (0.73–0.73) lower |
| CSS, brotli | 19.0 kB | 19.4 kB | 19.5 kB | 24.1 kB | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower | 0.79× (0.79–0.79) lower |
| JavaScript | 1.91 MB | 1.93 MB | 1.91 MB | 1.99 MB | 0.99× (0.99–0.99) lower | 1.002× (1.002–1.002) higher | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 645.0 kB | 665.7 kB | 657.5 kB | 657.4 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 667.3 kB | 687.9 kB | 679.7 kB | 687.8 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower |
| Style rules | 1,524 | 1,404 | 1,452 | 881 | not judged | not judged | not judged |
| Declarations | 1,696 | 1,568 | 1,613 | 1,298 | not judged | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 4.04 s | 12.55 s | 6.69 s | 4.02 s | 0.32× (0.32–0.32) lower | 0.60× (0.60–0.61) lower | 1.003× (0.989–1.019) no clear difference |
| CSS | 94.9 kB | 81.9 kB | 83.5 kB | 198.4 kB | 1.16× (1.16–1.16) higher | 1.14× (1.14–1.14) higher | 0.48× (0.48–0.48) lower |
| CSS, gzip | 23.3 kB | 22.8 kB | 22.8 kB | 29.7 kB | 1.02× (1.02–1.02) higher | 1.02× (1.02–1.02) higher | 0.78× (0.78–0.78) lower |
| CSS, brotli | 19.8 kB | 20.0 kB | 20.1 kB | 23.7 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| JavaScript | 2.06 MB | 2.08 MB | 2.06 MB | 2.09 MB | 0.99× (0.99–0.99) lower | 1.000× (1.000–1.000) lower | 0.99× (0.99–0.99) lower |
| JavaScript, gzip | 634.9 kB | 656.2 kB | 644.3 kB | 632.8 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 1.003× (1.003–1.003) higher |
| CSS + JavaScript, gzip | 658.2 kB | 679.0 kB | 667.1 kB | 662.6 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower |
| Style rules | 1,591 | 1,415 | 1,463 | 855 | not judged | not judged | not judged |
| Declarations | 1,763 | 1,579 | 1,624 | 1,286 | not judged | not judged | not judged |

## In the browser

The `web` app is grown to the same number of elements in each build, the CPU is
throttled, and Chrome's own counters are read through the DevTools protocol: the
style recalculation when the colour scheme switches, a hover, layout, and the
95th percentile of frame times.

### CPU throttled 4×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 1.85 s | 1.85 s | 1.82 s | 6.71 s | 0.998× (0.974–1.031) no clear difference | 1.018× (0.999–1.045) no clear difference | 0.28× (0.27–0.28) lower |
| Colour-scheme switch, recalcs | 10 | 11 | 11 | 11 | 0.909× (0.833–1.000) no clear difference | 0.909× (0.909–1.000) no clear difference | 0.909× (0.909–1.000) no clear difference |
| Hover, style recalc | 9.1 ms | 9.2 ms | 9.1 ms | 23.9 ms | 0.99× (0.87–1.12) no clear difference | 1.001× (0.901–1.099) no clear difference | 0.38× (0.35–0.41) lower |
| Hover, recalcs | 19 | 19 | 19 | 39 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.49× (0.49–0.49) lower |
| Layout | 16.8 ms | 15.5 ms | 15.7 ms | 17.6 ms | 1.08× (0.95–1.15) no clear difference | 1.06× (1.01–1.15) higher | 0.95× (0.86–1.08) no clear difference |
| Frame time, p95 | 232.4 ms | 229.9 ms | 233.9 ms | 1.54 s | 1.01× (0.98–1.04) no clear difference | 0.99× (0.96–1.02) no clear difference | 0.15× (0.15–0.15) lower |

### CPU throttled 6×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 2.94 s | 2.88 s | 2.91 s | 10.56 s | 1.02× (0.98–1.05) no clear difference | 1.01× (0.98–1.04) no clear difference | 0.28× (0.27–0.29) lower |
| Colour-scheme switch, recalcs | 11 | 11 | 11 | 11 | 1.000× (0.909–1.100) no clear difference | 1.000× (0.909–1.048) no clear difference | 1.000× (0.909–1.000) no clear difference |
| Hover, style recalc | 14.1 ms | 12.6 ms | 13.4 ms | 33.7 ms | 1.13× (0.98–1.22) no clear difference | 1.06× (0.95–1.26) no clear difference | 0.42× (0.40–0.45) lower |
| Hover, recalcs | 19 | 19 | 19 | 36 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.53× (0.51–0.53) lower |
| Layout | 25.2 ms | 24.0 ms | 25.8 ms | 26.4 ms | 1.05× (0.94–1.10) no clear difference | 0.98× (0.89–1.04) no clear difference | 0.955× (0.879–1.005) no clear difference |
| Frame time, p95 | 367.2 ms | 362.6 ms | 376.5 ms | 2.38 s | 1.01× (0.99–1.04) no clear difference | 0.98× (0.96–1.02) no clear difference | 0.15× (0.15–0.16) lower |

## A large page

The demos above are small pages. The large-dom corpus is an order table of
thousands of rows, as an admin screen has, written in each implementation with its
own components: a status badge, a select, an icon button, and an Approve button on
pending orders. Every build renders the same rows, from one seeded generator.

Each round filters the table to the overdue orders and back to all of them, each
timed from the click to the next frame, scrolls through it, moves the pointer
across rows, and reads the JavaScript heap after a garbage collection. The page's
HTML and `class` attributes are its size.

This run did not measure the large-dom table.

## What it does not say

- **The machine is a shared CI runner.** Absolute times move from run to run,
  and GitHub does not promise the same processor twice: the run above names the
  one it had. Compare ratios within one run, never times from two runs.
- **The applications are one shadcn/ui port.** Many small components, shared
  tokens, and one large table. A codebase with other habits may measure
  otherwise, and the lab's corpus will grow.
- **The editor is not measured here yet.** The language server's latency and the
  time from saving a file to the updated stylesheet are from one developer
  machine, in
  [the benchmark notes](https://github.com/kirana-style/kirana/blob/main/packages/kirana/design-notes/benchmark-results.md).

The rules a quoted number has to meet, the fairness checks and the statistics are
in the lab's
[METHODOLOGY.md](https://github.com/kirana-style/kirana-lab/blob/main/METHODOLOGY.md).
