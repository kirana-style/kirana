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

The figures below are Kirana 0.3.2.

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
| Kirana | 0.3.2, from npm |
| Date | 2026-10-24 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, @stylexswc/unplugin 0.19.1, @stylexswc/rs-compiler 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB, Linux 7.0.0-1017-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 156.0.8078.47 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs; 20 rounds at each large-dom size; 10 cold builds at each scale-curve size |
| Scale curve | its own GitHub-hosted runner, 4 cores (AMD EPYC 9V45), 16 GB |
| Conformance | web passed, blocks passed, examples passed, large-dom passed, scale-curve/100 passed, scale-curve/1000 passed, scale-curve/10000 passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/40082074398 |

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
- Hover, style recalc, apps/web, CPU throttled 6×, about 6211 elements: 1.28× StyleX (SWC) (1.01–1.56)
- JavaScript, apps/large-dom: 1.000× StyleX (SWC) (1.000–1.000)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- Filter, to the next frame, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.08× Tailwind (1.03–1.12)
- JavaScript heap, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.005× Tailwind (1.003–1.009)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- Filter, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.06× Tailwind (1.03–1.07)
- Filter, layout, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.10× Tailwind (1.04–1.18)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× StyleX (1.01–1.05)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× StyleX (SWC) (1.02–1.05)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.07× StyleX (1.05–1.10)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.08× StyleX (SWC) (1.06–1.10)
- JavaScript heap, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× Tailwind (1.03–1.03)
- Build, cold, the scale curve, 1,000 components: 1.14× Tailwind (1.09–1.18)
- Build, cold, the scale curve, 10,000 components: 1.66× Tailwind (1.59–1.76)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 9.94 s | 33.33 s | 17.21 s | 10.39 s | 0.30× (0.30–0.30) lower | 0.58× (0.57–0.58) lower | 0.96× (0.95–0.96) lower |
| CSS | 246.7 kB | 228.2 kB | 232.3 kB | 586.5 kB | 1.08× (1.08–1.08) higher | 1.06× (1.06–1.06) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 61.7 kB | 62.8 kB | 62.8 kB | 87.1 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.71× (0.71–0.71) lower |
| CSS, brotli | 52.7 kB | 55.3 kB | 55.5 kB | 69.5 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.76× (0.76–0.76) lower |
| JavaScript | 4.84 MB | 4.88 MB | 4.84 MB | 4.96 MB | 0.99× (0.99–0.99) lower | 0.999× (0.999–0.999) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 1.56 MB | 1.61 MB | 1.59 MB | 1.57 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 1.62 MB | 1.67 MB | 1.65 MB | 1.66 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| Style rules | 4,163 | 3,878 | 4,016 | 2,460 | not judged | not judged | not judged |
| Declarations | 4,616 | 4,370 | 4,499 | 3,674 | not judged | not judged | not judged |

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.63 s | 6.52 s | 4.33 s | 2.84 s | 0.40× (0.40–0.41) lower | 0.61× (0.60–0.61) lower | 0.93× (0.91–0.94) lower |
| CSS | 71.5 kB | 65.4 kB | 66.5 kB | 184.2 kB | 1.09× (1.09–1.09) higher | 1.07× (1.07–1.07) higher | 0.39× (0.39–0.39) lower |
| CSS, gzip | 17.7 kB | 17.8 kB | 17.8 kB | 26.9 kB | 0.996× (0.996–0.996) lower | 0.99× (0.99–0.99) lower | 0.66× (0.66–0.66) lower |
| CSS, brotli | 15.3 kB | 15.8 kB | 15.9 kB | 21.7 kB | 0.97× (0.97–0.97) lower | 0.96× (0.96–0.96) lower | 0.71× (0.71–0.71) lower |
| JavaScript | 866.3 kB | 875.3 kB | 874.5 kB | 889.8 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 279.0 kB | 284.9 kB | 284.6 kB | 282.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 296.7 kB | 302.7 kB | 302.5 kB | 309.4 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| Style rules | 1,150 | 1,059 | 1,101 | 724 | not judged | not judged | not judged |
| Declarations | 1,296 | 1,223 | 1,262 | 1,090 | not judged | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 3.72 s | 15.22 s | 6.68 s | 3.81 s | 0.24× (0.24–0.25) lower | 0.56× (0.55–0.56) lower | 0.97× (0.96–0.99) lower |
| CSS | 85.7 kB | 80.9 kB | 82.3 kB | 204.0 kB | 1.06× (1.06–1.06) higher | 1.04× (1.04–1.04) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 21.5 kB | 22.2 kB | 22.2 kB | 30.4 kB | 0.97× (0.97–0.97) lower | 0.97× (0.97–0.97) lower | 0.71× (0.71–0.71) lower |
| CSS, brotli | 18.3 kB | 19.4 kB | 19.5 kB | 24.1 kB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.76× (0.76–0.76) lower |
| JavaScript | 1.91 MB | 1.93 MB | 1.91 MB | 1.99 MB | 0.99× (0.99–0.99) lower | 1.002× (1.002–1.002) higher | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 645.3 kB | 665.7 kB | 657.5 kB | 657.4 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 666.8 kB | 687.9 kB | 679.7 kB | 687.8 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower |
| Style rules | 1,477 | 1,404 | 1,452 | 881 | not judged | not judged | not judged |
| Declarations | 1,631 | 1,568 | 1,613 | 1,298 | not judged | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 3.60 s | 11.53 s | 6.22 s | 3.73 s | 0.31× (0.31–0.31) lower | 0.58× (0.57–0.58) lower | 0.97× (0.96–0.97) lower |
| CSS | 89.5 kB | 81.9 kB | 83.5 kB | 198.4 kB | 1.09× (1.09–1.09) higher | 1.07× (1.07–1.07) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 22.5 kB | 22.8 kB | 22.8 kB | 29.7 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.76× (0.76–0.76) lower |
| CSS, brotli | 19.1 kB | 20.0 kB | 20.1 kB | 23.7 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.80× (0.80–0.80) lower |
| JavaScript | 2.06 MB | 2.08 MB | 2.06 MB | 2.09 MB | 0.99× (0.99–0.99) lower | 1.000× (1.000–1.000) lower | 0.99× (0.99–0.99) lower |
| JavaScript, gzip | 635.2 kB | 656.2 kB | 644.3 kB | 632.8 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 1.004× (1.004–1.004) higher |
| CSS + JavaScript, gzip | 657.6 kB | 679.0 kB | 667.1 kB | 662.6 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower |
| Style rules | 1,536 | 1,415 | 1,463 | 855 | not judged | not judged | not judged |
| Declarations | 1,689 | 1,579 | 1,624 | 1,286 | not judged | not judged | not judged |

## In the browser

The `web` app is grown to the same number of elements in each build, the CPU is
throttled, and Chrome's own counters are read through the DevTools protocol: the
style recalculation when the colour scheme switches, a hover, layout, and the
95th percentile of frame times.

### CPU throttled 4×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 1.53 s | 1.50 s | 1.52 s | 5.76 s | 1.021× (0.998–1.054) no clear difference | 1.01× (0.98–1.05) no clear difference | 0.27× (0.26–0.27) lower |
| Colour-scheme switch, recalcs | 12 | 12 | 12 | 11 | 1.04× (0.92–1.20) no clear difference | 1.000× (0.917–1.043) no clear difference | 1.091× (1.000–1.091) no clear difference |
| Hover, style recalc | 4.2 ms | 4.0 ms | 4.0 ms | 18.3 ms | 1.05× (0.86–1.21) no clear difference | 1.06× (0.84–1.21) no clear difference | 0.23× (0.19–0.25) lower |
| Hover, recalcs | 19 | 19 | 19 | 39 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.49× (0.49–0.49) lower |
| Layout | 15.1 ms | 13.5 ms | 13.7 ms | 14.3 ms | 1.116× (0.996–1.188) no clear difference | 1.10× (0.95–1.17) no clear difference | 1.05× (0.93–1.13) no clear difference |
| Frame time, p95 | 184.6 ms | 185.4 ms | 185.3 ms | 1.44 s | 0.996× (0.974–1.040) no clear difference | 0.996× (0.969–1.032) no clear difference | 0.13× (0.12–0.13) lower |

### CPU throttled 6×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 2.38 s | 2.31 s | 2.34 s | 8.90 s | 1.03× (0.99–1.06) no clear difference | 1.02× (0.98–1.05) no clear difference | 0.27× (0.26–0.27) lower |
| Colour-scheme switch, recalcs | 11 | 12 | 12 | 11 | 0.96× (0.87–1.09) no clear difference | 0.96× (0.87–1.09) no clear difference | 1.000× (0.909–1.091) no clear difference |
| Hover, style recalc | 8.8 ms | 7.6 ms | 6.9 ms | 26.5 ms | 1.16× (0.92–1.51) no clear difference | 1.28× (1.01–1.56) higher | 0.33× (0.29–0.38) lower |
| Hover, recalcs | 19 | 19 | 19 | 36 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.53× (0.53–0.53) lower |
| Layout | 20.9 ms | 21.6 ms | 21.1 ms | 22.0 ms | 0.96× (0.89–1.02) no clear difference | 0.99× (0.94–1.05) no clear difference | 0.95× (0.86–0.98) lower |
| Frame time, p95 | 288.1 ms | 288.3 ms | 287.6 ms | 2.21 s | 0.999× (0.972–1.043) no clear difference | 1.002× (0.967–1.052) no clear difference | 0.13× (0.13–0.14) lower |

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
| JavaScript | 415.5 kB | 416.3 kB | 415.3 kB | 439.3 kB | 0.998× (0.998–0.998) lower | 1.000× (1.000–1.000) higher | 0.95× (0.95–0.95) lower |
| JavaScript, gzip | 134.7 kB | 135.8 kB | 135.4 kB | 143.0 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 142.8 kB | 145.1 kB | 144.8 kB | 169.8 kB | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| Style rules | 459 | 484 | 494 | 710 | not judged | not judged | not judged |
| Declarations | 546 | 644 | 655 | 1,079 | not judged | not judged | not judged |

**1,000 rows, CPU throttled 4×, about 22552 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 4.80 MB | 4.33 MB | 4.33 MB | 5.76 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 2.26 MB | 1.78 MB | 1.78 MB | 3.20 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 323.4 ms | 313.6 ms | 320.0 ms | 298.6 ms | 1.032× (0.997–1.072) no clear difference | 1.01× (0.98–1.04) no clear difference | 1.08× (1.03–1.12) higher |
| Filter, style recalc | 1.5 ms | 1.7 ms | 1.8 ms | 2.3 ms | 0.85× (0.75–0.96) lower | 0.81× (0.75–0.95) lower | 0.63× (0.54–0.72) lower |
| Filter, layout | 49.7 ms | 47.1 ms | 47.2 ms | 46.5 ms | 1.06× (0.99–1.11) no clear difference | 1.05× (0.98–1.12) no clear difference | 1.07× (0.96–1.13) no clear difference |
| Every row again, to the next frame | 1.96 s | 1.94 s | 1.94 s | 2.18 s | 1.009× (0.999–1.029) no clear difference | 1.01× (0.98–1.03) no clear difference | 0.90× (0.88–0.92) lower |
| Every row again, style recalc | 523.7 ms | 531.1 ms | 577.4 ms | 850.2 ms | 0.99× (0.94–1.06) no clear difference | 0.91× (0.83–1.02) no clear difference | 0.62× (0.59–0.65) lower |
| Every row again, layout | 490.0 ms | 486.6 ms | 478.1 ms | 496.9 ms | 1.01× (0.97–1.06) no clear difference | 1.02× (0.96–1.13) no clear difference | 0.99× (0.95–1.04) no clear difference |
| Scroll, frame time p95 | 78.7 ms | 78.5 ms | 78.6 ms | 79.2 ms | 1.002× (0.932–1.064) no clear difference | 1.001× (0.952–1.060) no clear difference | 0.99× (0.93–1.05) no clear difference |
| Scroll, style recalc | 0.4 ms | 0.6 ms | 0.5 ms | 2.0 ms | 0.68× (0.16–1.66) no clear difference | 0.86× (0.19–4.04) no clear difference | 0.21× (0.07–0.45) lower |
| Hover across rows, style recalc | 10.2 ms | 13.0 ms | 13.3 ms | 14.8 ms | 0.78× (0.75–0.93) lower | 0.77× (0.70–0.90) lower | 0.69× (0.62–0.80) lower |
| JavaScript heap | 16.46 MB | 17.38 MB | 17.37 MB | 16.37 MB | 0.95× (0.94–0.95) lower | 0.95× (0.94–0.95) lower | 1.005× (1.003–1.009) higher |

**5,000 rows, CPU throttled 4×, about 112608 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 23.98 MB | 21.63 MB | 21.63 MB | 28.77 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 11.28 MB | 8.88 MB | 8.88 MB | 15.96 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 1.70 s | 1.75 s | 1.74 s | 1.61 s | 0.97× (0.95–0.99) lower | 0.98× (0.96–0.99) lower | 1.06× (1.03–1.07) higher |
| Filter, style recalc | 2.4 ms | 2.9 ms | 3.4 ms | 3.4 ms | 0.84× (0.69–1.35) no clear difference | 0.72× (0.60–0.83) lower | 0.71× (0.64–0.89) lower |
| Filter, layout | 279.6 ms | 411.9 ms | 408.9 ms | 254.7 ms | 0.68× (0.65–0.72) lower | 0.68× (0.66–0.72) lower | 1.10× (1.04–1.18) higher |
| Every row again, to the next frame | 10.48 s | 10.19 s | 10.15 s | 12.01 s | 1.03× (1.01–1.05) higher | 1.03× (1.02–1.05) higher | 0.87× (0.86–0.88) lower |
| Every row again, style recalc | 2.98 s | 2.79 s | 2.76 s | 5.16 s | 1.07× (1.05–1.10) higher | 1.08× (1.06–1.10) higher | 0.58× (0.57–0.59) lower |
| Every row again, layout | 2.40 s | 2.61 s | 2.59 s | 2.55 s | 0.92× (0.90–0.94) lower | 0.93× (0.90–0.95) lower | 0.94× (0.92–0.96) lower |
| Scroll, frame time p95 | 372.6 ms | 402.6 ms | 394.3 ms | 452.6 ms | 0.93× (0.84–0.97) lower | 0.95× (0.84–0.98) lower | 0.82× (0.75–0.89) lower |
| Scroll, style recalc | 0.1 ms | 0.1 ms | 0.1 ms | 0.7 ms | 1.37× (0.15–7.28) no clear difference | 1.43× (0.37–7.51) no clear difference | 0.16× (0.09–0.94) lower |
| Hover across rows, style recalc | 44.8 ms | 49.1 ms | 51.0 ms | 46.9 ms | 0.91× (0.83–1.01) no clear difference | 0.88× (0.80–0.98) lower | 0.96× (0.87–1.05) no clear difference |
| JavaScript heap | 66.70 MB | 71.24 MB | 71.24 MB | 64.92 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 1.03× (1.03–1.03) higher |

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
| Kirana | 1.33 s | 2.27 s | 11.39 s |
| StyleX | 5.27 s | 34.22 s | 346.63 s |
| StyleX (SWC) | 2.05 s | 5.13 s | 36.09 s |
| Tailwind | 1.46 s | 1.99 s | 6.87 s |
| Kirana ÷ StyleX | 0.25× (0.24–0.26) lower | 0.07× (0.06–0.07) lower | 0.03× (0.03–0.03) lower |
| Kirana ÷ StyleX (SWC) | 0.65× (0.63–0.67) lower | 0.44× (0.43–0.45) lower | 0.32× (0.30–0.33) lower |
| Kirana ÷ Tailwind | 0.91× (0.87–0.93) lower | 1.14× (1.09–1.18) higher | 1.66× (1.59–1.76) higher |

**CSS + JavaScript, gzip, at every size**

|  | 100 | 1,000 | 10,000 |
| --- | --- | --- | --- |
| Kirana | 144.1 kB | 173.2 kB | 447.1 kB |
| StyleX | 147.2 kB | 184.4 kB | 527.9 kB |
| StyleX (SWC) | 146.9 kB | 184.2 kB | 527.8 kB |
| Tailwind | 172.5 kB | 206.6 kB | 522.8 kB |
| Kirana ÷ StyleX | 0.98× (0.98–0.98) lower | 0.94× (0.94–0.94) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ StyleX (SWC) | 0.98× (0.98–0.98) lower | 0.94× (0.94–0.94) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ Tailwind | 0.84× (0.84–0.84) lower | 0.84× (0.84–0.84) lower | 0.86× (0.86–0.86) lower |

**100 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 1.33 s | 5.27 s | 2.05 s | 1.46 s | 0.25× (0.24–0.26) lower | 0.65× (0.63–0.67) lower | 0.91× (0.87–0.93) lower |
| CSS | 28.3 kB | 31.9 kB | 32.7 kB | 185.5 kB | 0.89× (0.89–0.89) lower | 0.86× (0.86–0.86) lower | 0.15× (0.15–0.15) lower |
| CSS, gzip | 7.9 kB | 9.3 kB | 9.3 kB | 27.1 kB | 0.85× (0.85–0.85) lower | 0.84× (0.84–0.84) lower | 0.29× (0.29–0.29) lower |
| CSS, brotli | 6.9 kB | 8.3 kB | 8.3 kB | 21.8 kB | 0.83× (0.83–0.83) lower | 0.82× (0.82–0.82) lower | 0.32× (0.32–0.32) lower |
| JavaScript | 465.3 kB | 470.5 kB | 469.5 kB | 506.7 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.92× (0.92–0.92) lower |
| JavaScript, gzip | 136.2 kB | 138.0 kB | 137.5 kB | 145.4 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 144.1 kB | 147.2 kB | 146.9 kB | 172.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.84× (0.84–0.84) lower |
| Style rules | 429 | 451 | 484 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 645 | 1,081 | not judged | not judged | not judged |

**1,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.27 s | 34.22 s | 5.13 s | 1.99 s | 0.07× (0.06–0.07) lower | 0.44× (0.43–0.45) lower | 1.14× (1.09–1.18) higher |
| CSS | 37.4 kB | 42.1 kB | 48.2 kB | 202.4 kB | 0.89× (0.89–0.89) lower | 0.78× (0.78–0.78) lower | 0.18× (0.18–0.18) lower |
| CSS, gzip | 10.2 kB | 12.7 kB | 12.9 kB | 29.3 kB | 0.81× (0.81–0.81) lower | 0.79× (0.79–0.79) lower | 0.35× (0.35–0.35) lower |
| CSS, brotli | 8.4 kB | 10.7 kB | 10.8 kB | 22.5 kB | 0.78× (0.78–0.78) lower | 0.78× (0.78–0.78) lower | 0.37× (0.37–0.37) lower |
| JavaScript | 982.1 kB | 1.03 MB | 1.03 MB | 1.18 MB | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower | 0.83× (0.83–0.83) lower |
| JavaScript, gzip | 163.0 kB | 171.7 kB | 171.3 kB | 177.3 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.92× (0.92–0.92) lower |
| CSS + JavaScript, gzip | 173.2 kB | 184.4 kB | 184.2 kB | 206.6 kB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.84× (0.84–0.84) lower |
| Style rules | 429 | 451 | 725 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 886 | 1,081 | not judged | not judged | not judged |

**10,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 11.39 s | 346.63 s | 36.09 s | 6.87 s | 0.03× (0.03–0.03) lower | 0.32× (0.30–0.33) lower | 1.66× (1.59–1.76) higher |
| CSS | 120.6 kB | 134.9 kB | 189.2 kB | 355.6 kB | 0.89× (0.89–0.89) lower | 0.64× (0.64–0.64) lower | 0.34× (0.34–0.34) lower |
| CSS, gzip | 29.5 kB | 41.8 kB | 42.1 kB | 43.1 kB | 0.71× (0.71–0.71) lower | 0.70× (0.70–0.70) lower | 0.68× (0.68–0.68) lower |
| CSS, brotli | 21.3 kB | 31.0 kB | 31.3 kB | 28.3 kB | 0.69× (0.69–0.69) lower | 0.68× (0.68–0.68) lower | 0.75× (0.75–0.75) lower |
| JavaScript | 6.19 MB | 6.62 MB | 6.62 MB | 7.98 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.78× (0.78–0.78) lower |
| JavaScript, gzip | 417.7 kB | 486.1 kB | 485.6 kB | 479.7 kB | 0.86× (0.86–0.86) lower | 0.86× (0.86–0.86) lower | 0.87× (0.87–0.87) lower |
| CSS + JavaScript, gzip | 447.1 kB | 527.9 kB | 527.8 kB | 522.8 kB | 0.85× (0.85–0.85) lower | 0.85× (0.85–0.85) lower | 0.86× (0.86–0.86) lower |
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
