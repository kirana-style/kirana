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

The figures below are Kirana 0.3.3.

## What the numbers include

A styling compiler can be timed on a few lines in memory, or on an application.
The two answer different questions, and only the second is the one you have.
Every headline number here is the second kind:

- **Real applications, built whole.** The corpus is a demo page, sixty-odd
  shadcn/ui blocks and a page for every component, written three times, plus a
  large order table. Each number is that app's own production build, cold, from
  source. Parsing, extracting, transforming, bundling and minifying are all
  inside the time, and the sizes are the files a browser downloads.
- **The release you would install.** Kirana comes from npm at the measured
  version, never from a build of this repository, and StyleX and Tailwind from
  their own pinned releases.
- **The same pages in every build.** Before anything is timed, every element on
  every route is compared property by property, at three widths in both colour
  schemes. A run whose builds do not render alike is published as a pre-release,
  and the site does not take it.
- **A difference only where the rounds show one.** Each cell is a median over
  interleaved rounds, with a 95 % confidence interval. A ratio whose interval
  includes 1 is "level", in Kirana's favour or not.
- **What is not counted.** No input is prepared in advance, no compiler is timed
  apart from its bundler, and no figure is one fast round. The scale curve,
  generated components of growing size, is reported on its own and never as a
  headline.

| | |
| --- | --- |
| Kirana | 0.3.3, from npm |
| Date | 2026-10-26 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, @stylexswc/unplugin 0.19.1, @stylexswc/rs-compiler 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 9V45), 16 GB, Linux 7.0.0-1017-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 156.0.8078.47 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs; 20 rounds at each large-dom size; 10 cold builds at each scale-curve size |
| Scale curve | its own GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB |
| Conformance | web passed, blocks passed, examples passed, large-dom passed, scale-curve/100 passed, scale-curve/1000 passed, scale-curve/10000 passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/40265315165 |

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

- CSS, apps/web: 1.09× StyleX (1.09–1.09)
- CSS, apps/web: 1.07× StyleX (SWC) (1.07–1.07)
- CSS, apps/blocks: 1.06× StyleX (1.06–1.06)
- CSS, apps/blocks: 1.04× StyleX (SWC) (1.04–1.04)
- CSS, apps/examples: 1.09× StyleX (1.09–1.09)
- CSS, apps/examples: 1.07× StyleX (SWC) (1.07–1.07)
- CSS, all three apps: 1.08× StyleX (1.08–1.08)
- CSS, all three apps: 1.06× StyleX (SWC) (1.06–1.06)
- JavaScript, apps/blocks: 1.002× StyleX (SWC) (1.002–1.002)
- JavaScript, gzip, apps/examples: 1.004× Tailwind (1.004–1.004)
- JavaScript, apps/large-dom: 1.000× StyleX (SWC) (1.000–1.000)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- JavaScript heap, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.008× Tailwind (1.004–1.011)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.032× StyleX (1.004–1.053)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.15× StyleX (1.10–1.18)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.14× StyleX (SWC) (1.10–1.17)
- JavaScript heap, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× Tailwind (1.03–1.03)
- Build, cold, the scale curve, 1,000 components: 1.18× Tailwind (1.17–1.20)
- Build, cold, the scale curve, 10,000 components: 1.79× Tailwind (1.71–1.84)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 6.24 s | 20.67 s | 10.16 s | 6.62 s | 0.30× (0.29–0.31) lower | 0.61× (0.59–0.62) lower | 0.94× (0.91–0.97) lower |
| CSS | 246.7 kB | 228.2 kB | 232.3 kB | 586.9 kB | 1.08× (1.08–1.08) higher | 1.06× (1.06–1.06) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 61.7 kB | 62.8 kB | 62.8 kB | 87.1 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.71× (0.71–0.71) lower |
| CSS, brotli | 52.7 kB | 55.3 kB | 55.5 kB | 69.5 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.76× (0.76–0.76) lower |
| JavaScript | 4.84 MB | 4.88 MB | 4.84 MB | 4.96 MB | 0.99× (0.99–0.99) lower | 0.999× (0.999–0.999) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 1.56 MB | 1.61 MB | 1.59 MB | 1.57 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 1.62 MB | 1.67 MB | 1.65 MB | 1.66 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| Style rules | 4,163 | 3,878 | 4,016 | 2,467 | not judged | not judged | not judged |
| Declarations | 4,616 | 4,370 | 4,499 | 3,681 | not judged | not judged | not judged |

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 1.61 s | 3.94 s | 2.45 s | 1.77 s | 0.41× (0.39–0.43) lower | 0.66× (0.64–0.67) lower | 0.91× (0.88–0.93) lower |
| CSS | 71.5 kB | 65.4 kB | 66.5 kB | 184.2 kB | 1.09× (1.09–1.09) higher | 1.07× (1.07–1.07) higher | 0.39× (0.39–0.39) lower |
| CSS, gzip | 17.7 kB | 17.8 kB | 17.8 kB | 26.9 kB | 0.996× (0.996–0.996) lower | 0.99× (0.99–0.99) lower | 0.66× (0.66–0.66) lower |
| CSS, brotli | 15.3 kB | 15.8 kB | 15.9 kB | 21.7 kB | 0.97× (0.97–0.97) lower | 0.96× (0.96–0.96) lower | 0.71× (0.71–0.71) lower |
| JavaScript | 866.4 kB | 875.4 kB | 874.6 kB | 889.9 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 279.0 kB | 284.9 kB | 284.7 kB | 282.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 296.8 kB | 302.8 kB | 302.6 kB | 309.4 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| Style rules | 1,150 | 1,059 | 1,101 | 724 | not judged | not judged | not judged |
| Declarations | 1,296 | 1,223 | 1,262 | 1,090 | not judged | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.33 s | 9.40 s | 3.97 s | 2.45 s | 0.25× (0.24–0.25) lower | 0.59× (0.57–0.60) lower | 0.950× (0.934–0.995) lower |
| CSS | 85.7 kB | 80.9 kB | 82.3 kB | 204.0 kB | 1.06× (1.06–1.06) higher | 1.04× (1.04–1.04) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 21.5 kB | 22.2 kB | 22.2 kB | 30.4 kB | 0.97× (0.97–0.97) lower | 0.97× (0.97–0.97) lower | 0.71× (0.71–0.71) lower |
| CSS, brotli | 18.3 kB | 19.4 kB | 19.5 kB | 24.1 kB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.76× (0.76–0.76) lower |
| JavaScript | 1.91 MB | 1.93 MB | 1.91 MB | 1.99 MB | 0.99× (0.99–0.99) lower | 1.002× (1.002–1.002) higher | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 645.4 kB | 665.8 kB | 657.6 kB | 657.4 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 666.9 kB | 688.0 kB | 679.7 kB | 687.9 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower |
| Style rules | 1,477 | 1,404 | 1,452 | 881 | not judged | not judged | not judged |
| Declarations | 1,631 | 1,568 | 1,613 | 1,298 | not judged | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.25 s | 7.19 s | 3.71 s | 2.35 s | 0.31× (0.30–0.32) lower | 0.61× (0.59–0.62) lower | 0.96× (0.92–0.98) lower |
| CSS | 89.5 kB | 81.9 kB | 83.5 kB | 198.7 kB | 1.09× (1.09–1.09) higher | 1.07× (1.07–1.07) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 22.5 kB | 22.8 kB | 22.8 kB | 29.8 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.75× (0.75–0.75) lower |
| CSS, brotli | 19.1 kB | 20.0 kB | 20.1 kB | 23.7 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.80× (0.80–0.80) lower |
| JavaScript | 2.06 MB | 2.08 MB | 2.06 MB | 2.09 MB | 0.99× (0.99–0.99) lower | 1.000× (1.000–1.000) lower | 0.99× (0.99–0.99) lower |
| JavaScript, gzip | 635.3 kB | 656.3 kB | 644.4 kB | 632.9 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 1.004× (1.004–1.004) higher |
| CSS + JavaScript, gzip | 657.7 kB | 679.2 kB | 667.2 kB | 662.7 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower |
| Style rules | 1,536 | 1,415 | 1,463 | 862 | not judged | not judged | not judged |
| Declarations | 1,689 | 1,579 | 1,624 | 1,293 | not judged | not judged | not judged |

## In the browser

The `web` app is grown to the same number of elements in each build, the CPU is
throttled, and Chrome's own counters are read through the DevTools protocol: the
style recalculation when the colour scheme switches, a hover, layout, and the
95th percentile of frame times.

### CPU throttled 4×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 941.6 ms | 994.5 ms | 924.6 ms | 3.88 s | 0.95× (0.89–1.05) no clear difference | 1.02× (0.92–1.07) no clear difference | 0.24× (0.23–0.27) lower |
| Colour-scheme switch, recalcs | 10 | 10 | 10 | 12 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.83× (0.83–0.91) lower |
| Hover, style recalc | 10.7 ms | 10.3 ms | 10.1 ms | 24.8 ms | 1.04× (0.74–2.02) no clear difference | 1.06× (0.76–1.58) no clear difference | 0.43× (0.30–0.51) lower |
| Hover, recalcs | 19 | 19 | 19 | 40 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.47× (0.47–0.48) lower |
| Layout | 11.2 ms | 11.0 ms | 11.1 ms | 11.7 ms | 1.01× (0.96–1.06) no clear difference | 1.01× (0.96–1.05) no clear difference | 0.96× (0.91–1.02) no clear difference |
| Frame time, p95 | 130.8 ms | 131.8 ms | 126.9 ms | 1.07 s | 0.99× (0.90–1.08) no clear difference | 1.03× (0.92–1.11) no clear difference | 0.12× (0.11–0.13) lower |

### CPU throttled 6×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 1.47 s | 1.46 s | 1.46 s | 5.84 s | 1.002× (0.886–1.178) no clear difference | 1.003× (0.890–1.132) no clear difference | 0.25× (0.23–0.28) lower |
| Colour-scheme switch, recalcs | 11 | 12 | 11 | 12 | 0.92× (0.92–1.05) no clear difference | 1.000× (0.917–1.091) no clear difference | 0.917× (0.917–1.000) no clear difference |
| Hover, style recalc | 12.6 ms | 12.6 ms | 12.7 ms | 38.0 ms | 0.996× (0.729–1.499) no clear difference | 0.99× (0.70–1.56) no clear difference | 0.33× (0.23–0.40) lower |
| Hover, recalcs | 19 | 19 | 19 | 41 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.47× (0.46–0.47) lower |
| Layout | 16.4 ms | 16.7 ms | 16.9 ms | 17.4 ms | 0.99× (0.94–1.03) no clear difference | 0.97× (0.92–1.03) no clear difference | 0.95× (0.92–0.98) lower |
| Frame time, p95 | 204.9 ms | 199.6 ms | 190.3 ms | 1.62 s | 1.03× (0.88–1.14) no clear difference | 1.08× (0.93–1.20) no clear difference | 0.13× (0.11–0.14) lower |

## A large page

The demos above are small pages. The large-dom corpus is an order table of
thousands of rows, as an admin screen has, written in each implementation with its
own components: a status badge, a select, an icon button, and an Approve button on
pending orders. Every build renders the same rows, from one seeded generator.

Each round filters the table to the overdue orders and back to all of them, each
timed from the click to the next frame, scrolls through it, moves the pointer
across rows, and reads the JavaScript heap after a garbage collection. The page's
HTML and `class` attributes are its size.

**The app's build**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CSS | 29.0 kB | 32.3 kB | 32.6 kB | 183.4 kB | 0.90× (0.90–0.90) lower | 0.89× (0.89–0.89) lower | 0.16× (0.16–0.16) lower |
| CSS, gzip | 8.1 kB | 9.3 kB | 9.4 kB | 26.8 kB | 0.87× (0.87–0.87) lower | 0.87× (0.87–0.87) lower | 0.30× (0.30–0.30) lower |
| CSS, brotli | 7.1 kB | 8.4 kB | 8.4 kB | 21.6 kB | 0.85× (0.85–0.85) lower | 0.85× (0.85–0.85) lower | 0.33× (0.33–0.33) lower |
| JavaScript | 415.6 kB | 416.4 kB | 415.4 kB | 439.4 kB | 0.998× (0.998–0.998) lower | 1.000× (1.000–1.000) higher | 0.95× (0.95–0.95) lower |
| JavaScript, gzip | 134.7 kB | 135.9 kB | 135.4 kB | 143.1 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 142.9 kB | 145.2 kB | 144.8 kB | 169.9 kB | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| Style rules | 459 | 484 | 494 | 710 | not judged | not judged | not judged |
| Declarations | 546 | 644 | 655 | 1,079 | not judged | not judged | not judged |

**1,000 rows, CPU throttled 4×, about 22552 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 4.80 MB | 4.33 MB | 4.33 MB | 5.76 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 2.26 MB | 1.78 MB | 1.78 MB | 3.20 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 283.6 ms | 289.8 ms | 286.1 ms | 273.6 ms | 0.98× (0.93–1.02) no clear difference | 0.99× (0.94–1.03) no clear difference | 1.04× (0.98–1.09) no clear difference |
| Filter, style recalc | 1.5 ms | 1.9 ms | 1.8 ms | 2.6 ms | 0.80× (0.72–0.92) lower | 0.84× (0.70–0.99) lower | 0.59× (0.54–0.69) lower |
| Filter, layout | 42.0 ms | 42.6 ms | 41.5 ms | 43.1 ms | 0.98× (0.93–1.04) no clear difference | 1.01× (0.95–1.07) no clear difference | 0.97× (0.92–1.04) no clear difference |
| Every row again, to the next frame | 1.32 s | 1.34 s | 1.34 s | 1.52 s | 0.98× (0.94–1.02) no clear difference | 0.98× (0.94–1.03) no clear difference | 0.87× (0.84–0.91) lower |
| Every row again, style recalc | 292.7 ms | 300.5 ms | 298.0 ms | 473.7 ms | 0.97× (0.92–1.01) no clear difference | 0.98× (0.95–1.02) no clear difference | 0.62× (0.59–0.65) lower |
| Every row again, layout | 367.1 ms | 372.0 ms | 371.1 ms | 387.7 ms | 0.99× (0.94–1.08) no clear difference | 0.99× (0.95–1.03) no clear difference | 0.947× (0.898–0.996) lower |
| Scroll, frame time p95 | 109.0 ms | 107.4 ms | 105.2 ms | 109.6 ms | 1.01× (0.93–1.15) no clear difference | 1.04× (0.94–1.17) no clear difference | 0.99× (0.91–1.19) no clear difference |
| Scroll, style recalc | 1.0 ms | 1.1 ms | 1.1 ms | 2.0 ms | 0.92× (0.64–1.39) no clear difference | 0.87× (0.56–1.56) no clear difference | 0.49× (0.33–0.84) lower |
| Hover across rows, style recalc | 22.7 ms | 27.6 ms | 28.2 ms | 30.0 ms | 0.82× (0.62–1.18) no clear difference | 0.81× (0.61–1.07) no clear difference | 0.758× (0.529–1.002) no clear difference |
| JavaScript heap | 16.52 MB | 17.39 MB | 17.39 MB | 16.39 MB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 1.008× (1.004–1.011) higher |

**5,000 rows, CPU throttled 4×, about 112608 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 23.98 MB | 21.63 MB | 21.63 MB | 28.77 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 11.28 MB | 8.88 MB | 8.88 MB | 15.96 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 1.43 s | 1.51 s | 1.49 s | 1.42 s | 0.950× (0.929–0.999) lower | 0.960× (0.919–0.997) lower | 1.01× (0.96–1.09) no clear difference |
| Filter, style recalc | 2.7 ms | 3.4 ms | 3.7 ms | 5.2 ms | 0.80× (0.62–0.89) lower | 0.73× (0.62–0.88) lower | 0.52× (0.39–0.62) lower |
| Filter, layout | 271.8 ms | 338.6 ms | 337.6 ms | 275.0 ms | 0.80× (0.70–1.06) no clear difference | 0.81× (0.69–1.06) no clear difference | 0.99× (0.80–1.47) no clear difference |
| Every row again, to the next frame | 6.66 s | 6.46 s | 6.53 s | 7.22 s | 1.032× (1.004–1.053) higher | 1.02× (0.99–1.04) no clear difference | 0.92× (0.89–0.94) lower |
| Every row again, style recalc | 1.71 s | 1.49 s | 1.50 s | 2.55 s | 1.15× (1.10–1.18) higher | 1.14× (1.10–1.17) higher | 0.67× (0.64–0.68) lower |
| Every row again, layout | 1.65 s | 1.90 s | 1.92 s | 1.73 s | 0.87× (0.84–0.89) lower | 0.86× (0.83–0.89) lower | 0.96× (0.90–1.01) no clear difference |
| Scroll, frame time p95 | 391.3 ms | 425.0 ms | 412.1 ms | 393.6 ms | 0.921× (0.822–1.000) lower | 0.95× (0.85–1.02) no clear difference | 0.99× (0.86–1.16) no clear difference |
| Scroll, style recalc | 0.2 ms | 0.5 ms | 0.1 ms | 0.7 ms | 0.40× (0.11–5.47) no clear difference | 2.79× (0.24–7.95) no clear difference | 0.30× (0.09–0.94) lower |
| Hover across rows, style recalc | 60.0 ms | 74.3 ms | 78.8 ms | 64.4 ms | 0.81× (0.52–1.15) no clear difference | 0.76× (0.48–1.20) no clear difference | 0.93× (0.51–1.22) no clear difference |
| JavaScript heap | 66.72 MB | 71.26 MB | 71.26 MB | 64.96 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 1.03× (1.03–1.03) higher |

## The same components, more of them

The scale curve asks how the cost grows. A generator writes the same components
for every implementation, each in its own idiom: tokens, a recipe and a font size
with its line height in every one, and in fixed shares a hover state, a
breakpoint, a relation and a value known only at runtime. Each size is built cold,
and the curve is read across the sizes, never from one of them. It runs on a
runner of its own beside the rest, so compare its numbers with each other, not
with the tables above.

**Build, cold, at every size**

|  | 100 | 1,000 | 10,000 |
| --- | --- | --- | --- |
| Kirana | 2.56 s | 4.27 s | 21.69 s |
| StyleX | 10.18 s | 62.47 s | 620.42 s |
| StyleX (SWC) | 4.08 s | 9.20 s | 60.30 s |
| Tailwind | 2.77 s | 3.61 s | 12.09 s |
| Kirana ÷ StyleX | 0.25× (0.25–0.26) lower | 0.07× (0.07–0.07) lower | 0.03× (0.03–0.04) lower |
| Kirana ÷ StyleX (SWC) | 0.63× (0.62–0.63) lower | 0.46× (0.46–0.47) lower | 0.36× (0.35–0.37) lower |
| Kirana ÷ Tailwind | 0.92× (0.90–0.95) lower | 1.18× (1.17–1.20) higher | 1.79× (1.71–1.84) higher |

**CSS + JavaScript, gzip, at every size**

|  | 100 | 1,000 | 10,000 |
| --- | --- | --- | --- |
| Kirana | 144.2 kB | 173.3 kB | 447.2 kB |
| StyleX | 147.3 kB | 184.4 kB | 527.9 kB |
| StyleX (SWC) | 146.9 kB | 184.2 kB | 527.8 kB |
| Tailwind | 172.6 kB | 206.6 kB | 522.9 kB |
| Kirana ÷ StyleX | 0.98× (0.98–0.98) lower | 0.94× (0.94–0.94) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ StyleX (SWC) | 0.98× (0.98–0.98) lower | 0.94× (0.94–0.94) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ Tailwind | 0.84× (0.84–0.84) lower | 0.84× (0.84–0.84) lower | 0.86× (0.86–0.86) lower |

**100 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.56 s | 10.18 s | 4.08 s | 2.77 s | 0.25× (0.25–0.26) lower | 0.63× (0.62–0.63) lower | 0.92× (0.90–0.95) lower |
| CSS | 28.3 kB | 31.9 kB | 32.7 kB | 185.5 kB | 0.89× (0.89–0.89) lower | 0.86× (0.86–0.86) lower | 0.15× (0.15–0.15) lower |
| CSS, gzip | 7.9 kB | 9.3 kB | 9.3 kB | 27.1 kB | 0.85× (0.85–0.85) lower | 0.84× (0.84–0.84) lower | 0.29× (0.29–0.29) lower |
| CSS, brotli | 6.9 kB | 8.3 kB | 8.3 kB | 21.8 kB | 0.83× (0.83–0.83) lower | 0.82× (0.82–0.82) lower | 0.32× (0.32–0.32) lower |
| JavaScript | 465.4 kB | 470.6 kB | 469.7 kB | 506.8 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.92× (0.92–0.92) lower |
| JavaScript, gzip | 136.3 kB | 138.0 kB | 137.6 kB | 145.5 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 144.2 kB | 147.3 kB | 146.9 kB | 172.6 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.84× (0.84–0.84) lower |
| Style rules | 429 | 451 | 484 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 645 | 1,081 | not judged | not judged | not judged |

**1,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 4.27 s | 62.47 s | 9.20 s | 3.61 s | 0.07× (0.07–0.07) lower | 0.46× (0.46–0.47) lower | 1.18× (1.17–1.20) higher |
| CSS | 37.4 kB | 42.1 kB | 48.2 kB | 202.4 kB | 0.89× (0.89–0.89) lower | 0.78× (0.78–0.78) lower | 0.18× (0.18–0.18) lower |
| CSS, gzip | 10.2 kB | 12.7 kB | 12.9 kB | 29.3 kB | 0.81× (0.81–0.81) lower | 0.79× (0.79–0.79) lower | 0.35× (0.35–0.35) lower |
| CSS, brotli | 8.4 kB | 10.7 kB | 10.8 kB | 22.5 kB | 0.78× (0.78–0.78) lower | 0.78× (0.78–0.78) lower | 0.37× (0.37–0.37) lower |
| JavaScript | 982.2 kB | 1.03 MB | 1.03 MB | 1.18 MB | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower | 0.83× (0.83–0.83) lower |
| JavaScript, gzip | 163.1 kB | 171.8 kB | 171.4 kB | 177.3 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.92× (0.92–0.92) lower |
| CSS + JavaScript, gzip | 173.3 kB | 184.4 kB | 184.2 kB | 206.6 kB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.84× (0.84–0.84) lower |
| Style rules | 429 | 451 | 725 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 886 | 1,081 | not judged | not judged | not judged |

**10,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 21.69 s | 620.42 s | 60.30 s | 12.09 s | 0.03× (0.03–0.04) lower | 0.36× (0.35–0.37) lower | 1.79× (1.71–1.84) higher |
| CSS | 120.6 kB | 134.9 kB | 189.2 kB | 355.6 kB | 0.89× (0.89–0.89) lower | 0.64× (0.64–0.64) lower | 0.34× (0.34–0.34) lower |
| CSS, gzip | 29.5 kB | 41.8 kB | 42.1 kB | 43.1 kB | 0.71× (0.71–0.71) lower | 0.70× (0.70–0.70) lower | 0.68× (0.68–0.68) lower |
| CSS, brotli | 21.3 kB | 31.0 kB | 31.3 kB | 28.3 kB | 0.69× (0.69–0.69) lower | 0.68× (0.68–0.68) lower | 0.75× (0.75–0.75) lower |
| JavaScript | 6.19 MB | 6.62 MB | 6.62 MB | 7.98 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.78× (0.78–0.78) lower |
| JavaScript, gzip | 417.7 kB | 486.2 kB | 485.7 kB | 479.8 kB | 0.86× (0.86–0.86) lower | 0.86× (0.86–0.86) lower | 0.87× (0.87–0.87) lower |
| CSS + JavaScript, gzip | 447.2 kB | 527.9 kB | 527.8 kB | 522.9 kB | 0.85× (0.85–0.85) lower | 0.85× (0.85–0.85) lower | 0.86× (0.86–0.86) lower |
| Style rules | 429 | 451 | 2,914 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 3,075 | 1,081 | not judged | not judged | not judged |

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
