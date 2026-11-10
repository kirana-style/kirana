# Benchmarks
Source: https://site.kirana-style.workers.dev/docs/project/benchmarks

# Benchmarks

Every number the site quotes comes from
[kirana-lab](https://github.com/kirana-style/kirana-lab), a public repository
that builds the same three applications three ways: with the published Kirana
release, with a StyleX port and with the Tailwind original. The StyleX port is
built twice, by StyleX's Babel plugin and by its Rust compiler on SWC, so a
comparison with StyleX holds whichever one you use. It measures on every Kirana
release and once a week, so an update to StyleX or Tailwind shows up too, and the
site takes the newest run through a pull request.

The figures below are Kirana 0.4.1.

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
| Kirana | 0.4.1, from npm |
| Date | 2026-11-09 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, @stylexswc/unplugin 0.19.1, @stylexswc/rs-compiler 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB, Linux 7.0.0-1019-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 157.0.8103.38 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs; 20 rounds at each large-dom size; 10 cold builds at each scale-curve size |
| Scale curve | its own GitHub-hosted runner, 4 cores (INTEL(R) XEON(R) PLATINUM 8573C), 16 GB |
| Conformance | web passed, blocks passed, examples passed, large-dom passed, scale-curve/100 passed, scale-curve/1000 passed, scale-curve/10000 passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/42580600448 |

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

- CSS, apps/web: 1.004× StyleX (1.004–1.004)
- CSS, apps/examples: 1.003× StyleX (1.003–1.003)
- Layout, apps/web, CPU throttled 4×, about 6211 elements: 1.11× StyleX (SWC) (1.01–1.17)
- Filter, to the next frame, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.06× Tailwind (1.02–1.09)
- Every row again, layout, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.07× StyleX (SWC) (1.01–1.12)
- Scroll, frame time p95, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.07× StyleX (SWC) (1.01–1.12)
- JavaScript heap, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.007× Tailwind (1.003–1.009)
- Filter, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.05× Tailwind (1.04–1.07)
- Filter, layout, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.15× Tailwind (1.06–1.21)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× StyleX (1.02–1.04)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× StyleX (SWC) (1.02–1.04)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.09× StyleX (1.06–1.12)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.11× StyleX (SWC) (1.09–1.12)
- JavaScript heap, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× Tailwind (1.03–1.03)
- Build, cold, the scale curve, 10,000 components: 1.16× Tailwind (1.13–1.19)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 10.11 s | 34.44 s | 17.76 s | 10.64 s | 0.29× (0.29–0.30) lower | 0.57× (0.57–0.57) lower | 0.95× (0.94–0.96) lower |
| CSS | 226.4 kB | 228.2 kB | 232.3 kB | 586.9 kB | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower | 0.39× (0.39–0.39) lower |
| CSS, gzip | 50.9 kB | 62.8 kB | 62.8 kB | 87.1 kB | 0.81× (0.81–0.81) lower | 0.81× (0.81–0.81) lower | 0.58× (0.58–0.58) lower |
| CSS, brotli | 42.7 kB | 55.3 kB | 55.5 kB | 69.5 kB | 0.77× (0.77–0.77) lower | 0.77× (0.77–0.77) lower | 0.61× (0.61–0.61) lower |
| JavaScript | 4.76 MB | 4.88 MB | 4.84 MB | 4.96 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 1.53 MB | 1.61 MB | 1.59 MB | 1.57 MB | 0.95× (0.95–0.95) lower | 0.96× (0.96–0.96) lower | 0.97× (0.97–0.97) lower |
| CSS + JavaScript, gzip | 1.58 MB | 1.67 MB | 1.65 MB | 1.66 MB | 0.94× (0.94–0.94) lower | 0.96× (0.96–0.96) lower | 0.95× (0.95–0.95) lower |
| Style rules | 4,163 | 3,878 | 4,016 | 2,467 | not judged | not judged | not judged |
| Declarations | 4,616 | 4,370 | 4,499 | 3,681 | not judged | not judged | not judged |

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.70 s | 6.66 s | 4.47 s | 2.90 s | 0.41× (0.40–0.41) lower | 0.60× (0.60–0.61) lower | 0.93× (0.92–0.94) lower |
| CSS | 65.7 kB | 65.4 kB | 66.5 kB | 184.2 kB | 1.004× (1.004–1.004) higher | 0.99× (0.99–0.99) lower | 0.36× (0.36–0.36) lower |
| CSS, gzip | 14.7 kB | 17.8 kB | 17.8 kB | 26.9 kB | 0.83× (0.83–0.83) lower | 0.82× (0.82–0.82) lower | 0.55× (0.55–0.55) lower |
| CSS, brotli | 12.5 kB | 15.8 kB | 15.9 kB | 21.7 kB | 0.79× (0.79–0.79) lower | 0.78× (0.78–0.78) lower | 0.58× (0.58–0.58) lower |
| JavaScript | 852.8 kB | 875.4 kB | 874.6 kB | 889.9 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 274.1 kB | 284.9 kB | 284.7 kB | 282.5 kB | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower | 0.97× (0.97–0.97) lower |
| CSS + JavaScript, gzip | 288.8 kB | 302.8 kB | 302.6 kB | 309.4 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.93× (0.93–0.93) lower |
| Style rules | 1,150 | 1,059 | 1,101 | 724 | not judged | not judged | not judged |
| Declarations | 1,296 | 1,223 | 1,262 | 1,090 | not judged | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 3.76 s | 15.73 s | 6.87 s | 3.93 s | 0.24× (0.24–0.24) lower | 0.55× (0.54–0.55) lower | 0.96× (0.95–0.97) lower |
| CSS | 78.6 kB | 80.9 kB | 82.3 kB | 204.0 kB | 0.97× (0.97–0.97) lower | 0.95× (0.95–0.95) lower | 0.39× (0.39–0.39) lower |
| CSS, gzip | 17.7 kB | 22.2 kB | 22.2 kB | 30.4 kB | 0.80× (0.80–0.80) lower | 0.80× (0.80–0.80) lower | 0.58× (0.58–0.58) lower |
| CSS, brotli | 14.8 kB | 19.4 kB | 19.5 kB | 24.1 kB | 0.76× (0.76–0.76) lower | 0.76× (0.76–0.76) lower | 0.61× (0.61–0.61) lower |
| JavaScript | 1.87 MB | 1.93 MB | 1.91 MB | 1.99 MB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.94× (0.94–0.94) lower |
| JavaScript, gzip | 629.8 kB | 665.8 kB | 657.6 kB | 657.4 kB | 0.95× (0.95–0.95) lower | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower |
| CSS + JavaScript, gzip | 647.5 kB | 688.0 kB | 679.7 kB | 687.9 kB | 0.94× (0.94–0.94) lower | 0.95× (0.95–0.95) lower | 0.94× (0.94–0.94) lower |
| Style rules | 1,477 | 1,404 | 1,452 | 881 | not judged | not judged | not judged |
| Declarations | 1,631 | 1,568 | 1,613 | 1,298 | not judged | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 3.65 s | 12.04 s | 6.43 s | 3.84 s | 0.30× (0.30–0.31) lower | 0.57× (0.56–0.57) lower | 0.95× (0.94–0.96) lower |
| CSS | 82.2 kB | 81.9 kB | 83.5 kB | 198.7 kB | 1.003× (1.003–1.003) higher | 0.98× (0.98–0.98) lower | 0.41× (0.41–0.41) lower |
| CSS, gzip | 18.5 kB | 22.8 kB | 22.8 kB | 29.8 kB | 0.81× (0.81–0.81) lower | 0.81× (0.81–0.81) lower | 0.62× (0.62–0.62) lower |
| CSS, brotli | 15.4 kB | 20.0 kB | 20.1 kB | 23.7 kB | 0.77× (0.77–0.77) lower | 0.77× (0.77–0.77) lower | 0.65× (0.65–0.65) lower |
| JavaScript | 2.03 MB | 2.08 MB | 2.06 MB | 2.09 MB | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 622.8 kB | 656.3 kB | 644.4 kB | 632.9 kB | 0.95× (0.95–0.95) lower | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 641.2 kB | 679.2 kB | 667.2 kB | 662.7 kB | 0.94× (0.94–0.94) lower | 0.96× (0.96–0.96) lower | 0.97× (0.97–0.97) lower |
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
| Colour-scheme switch, style recalc | 1.65 s | 1.65 s | 1.63 s | 5.93 s | 1.002× (0.972–1.032) no clear difference | 1.01× (0.98–1.04) no clear difference | 0.28× (0.27–0.28) lower |
| Colour-scheme switch, recalcs | 12 | 12 | 11 | 11 | 1.000× (0.917–1.200) no clear difference | 1.091× (1.000–1.200) no clear difference | 1.091× (1.000–1.091) no clear difference |
| Hover, style recalc | 7.2 ms | 7.3 ms | 7.1 ms | 19.5 ms | 0.98× (0.86–1.08) no clear difference | 1.01× (0.84–1.25) no clear difference | 0.37× (0.31–0.39) lower |
| Hover, recalcs | 19 | 19 | 19 | 39 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.49× (0.49–0.49) lower |
| Layout | 15.9 ms | 14.3 ms | 14.4 ms | 15.7 ms | 1.116× (0.997–1.175) no clear difference | 1.11× (1.01–1.17) higher | 1.01× (0.91–1.08) no clear difference |
| Frame time, p95 | 200.4 ms | 203.8 ms | 203.8 ms | 1.35 s | 0.98× (0.95–1.02) no clear difference | 0.98× (0.95–1.03) no clear difference | 0.15× (0.14–0.15) lower |

### CPU throttled 6×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 2.52 s | 2.57 s | 2.54 s | 9.23 s | 0.977× (0.954–1.002) no clear difference | 0.99× (0.98–1.03) no clear difference | 0.27× (0.27–0.28) lower |
| Colour-scheme switch, recalcs | 11 | 11 | 11 | 11 | 1.000× (0.955–1.100) no clear difference | 1.048× (1.000–1.150) no clear difference | 1.000× (1.000–1.091) no clear difference |
| Hover, style recalc | 11.0 ms | 9.8 ms | 10.8 ms | 29.7 ms | 1.12× (0.93–1.20) no clear difference | 1.02× (0.84–1.17) no clear difference | 0.37× (0.33–0.40) lower |
| Hover, recalcs | 19 | 19 | 19 | 36 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.53× (0.51–0.53) lower |
| Layout | 21.9 ms | 24.4 ms | 21.6 ms | 25.3 ms | 0.899× (0.854–1.001) no clear difference | 1.01× (0.95–1.07) no clear difference | 0.87× (0.79–0.94) lower |
| Frame time, p95 | 319.6 ms | 326.1 ms | 329.9 ms | 2.13 s | 0.98× (0.95–1.01) no clear difference | 0.969× (0.950–1.000) lower | 0.15× (0.15–0.15) lower |

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
| CSS | 26.8 kB | 32.3 kB | 32.6 kB | 183.4 kB | 0.83× (0.83–0.83) lower | 0.82× (0.82–0.82) lower | 0.15× (0.15–0.15) lower |
| CSS, gzip | 6.8 kB | 9.3 kB | 9.4 kB | 26.8 kB | 0.73× (0.73–0.73) lower | 0.73× (0.73–0.73) lower | 0.25× (0.25–0.25) lower |
| CSS, brotli | 5.8 kB | 8.4 kB | 8.4 kB | 21.6 kB | 0.69× (0.69–0.69) lower | 0.69× (0.69–0.69) lower | 0.27× (0.27–0.27) lower |
| JavaScript | 412.9 kB | 416.4 kB | 415.4 kB | 439.4 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| JavaScript, gzip | 133.6 kB | 135.9 kB | 135.4 kB | 143.1 kB | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower | 0.93× (0.93–0.93) lower |
| CSS + JavaScript, gzip | 140.4 kB | 145.2 kB | 144.8 kB | 169.9 kB | 0.97× (0.97–0.97) lower | 0.97× (0.97–0.97) lower | 0.83× (0.83–0.83) lower |
| Style rules | 459 | 484 | 494 | 710 | not judged | not judged | not judged |
| Declarations | 546 | 644 | 655 | 1,079 | not judged | not judged | not judged |

**1,000 rows, CPU throttled 4×, about 22552 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 3.92 MB | 4.33 MB | 4.33 MB | 5.76 MB | 0.91× (0.91–0.91) lower | 0.91× (0.91–0.91) lower | 0.68× (0.68–0.68) lower |
| class attributes | 1.38 MB | 1.78 MB | 1.78 MB | 3.20 MB | 0.78× (0.78–0.78) lower | 0.78× (0.78–0.78) lower | 0.43× (0.43–0.43) lower |
| Filter, to the next frame | 315.8 ms | 321.9 ms | 323.9 ms | 297.3 ms | 0.98× (0.95–1.01) no clear difference | 0.975× (0.948–1.005) no clear difference | 1.06× (1.02–1.09) higher |
| Filter, style recalc | 1.8 ms | 1.7 ms | 2.0 ms | 2.5 ms | 1.03× (0.82–1.14) no clear difference | 0.91× (0.78–1.01) no clear difference | 0.72× (0.63–0.78) lower |
| Filter, layout | 47.4 ms | 48.8 ms | 49.8 ms | 46.9 ms | 0.97× (0.92–1.04) no clear difference | 0.95× (0.91–1.02) no clear difference | 1.01× (0.94–1.08) no clear difference |
| Every row again, to the next frame | 2.01 s | 1.96 s | 2.04 s | 2.20 s | 1.03× (0.99–1.04) no clear difference | 0.99× (0.95–1.02) no clear difference | 0.91× (0.88–0.93) lower |
| Every row again, style recalc | 524.6 ms | 504.1 ms | 594.9 ms | 831.0 ms | 1.04× (0.99–1.09) no clear difference | 0.88× (0.79–1.02) no clear difference | 0.63× (0.60–0.66) lower |
| Every row again, layout | 516.4 ms | 509.7 ms | 483.5 ms | 509.9 ms | 1.01× (0.99–1.04) no clear difference | 1.07× (1.01–1.12) higher | 1.01× (0.98–1.03) no clear difference |
| Scroll, frame time p95 | 95.9 ms | 94.6 ms | 89.9 ms | 93.3 ms | 1.01× (0.96–1.08) no clear difference | 1.07× (1.01–1.12) higher | 1.03× (0.98–1.10) no clear difference |
| Scroll, style recalc | 0.0 ms | 0.4 ms | 0.0 ms | 1.6 ms | not judged | not judged | not judged |
| Hover across rows, style recalc | 14.8 ms | 17.1 ms | 18.3 ms | 18.8 ms | 0.86× (0.76–0.99) lower | 0.81× (0.65–0.96) lower | 0.78× (0.68–0.90) lower |
| JavaScript heap | 16.49 MB | 17.39 MB | 17.37 MB | 16.38 MB | 0.95× (0.94–0.95) lower | 0.95× (0.95–0.95) lower | 1.007× (1.003–1.009) higher |

**5,000 rows, CPU throttled 4×, about 112608 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 19.60 MB | 21.63 MB | 21.63 MB | 28.77 MB | 0.91× (0.91–0.91) lower | 0.91× (0.91–0.91) lower | 0.68× (0.68–0.68) lower |
| class attributes | 6.90 MB | 8.88 MB | 8.88 MB | 15.96 MB | 0.78× (0.78–0.78) lower | 0.78× (0.78–0.78) lower | 0.43× (0.43–0.43) lower |
| Filter, to the next frame | 1.72 s | 1.78 s | 1.81 s | 1.63 s | 0.97× (0.96–0.99) lower | 0.95× (0.94–0.97) lower | 1.05× (1.04–1.07) higher |
| Filter, style recalc | 2.5 ms | 3.0 ms | 3.5 ms | 3.4 ms | 0.83× (0.67–1.46) no clear difference | 0.72× (0.65–0.82) lower | 0.76× (0.69–0.85) lower |
| Filter, layout | 345.0 ms | 412.6 ms | 419.0 ms | 300.9 ms | 0.84× (0.81–0.86) lower | 0.82× (0.79–0.85) lower | 1.15× (1.06–1.21) higher |
| Every row again, to the next frame | 10.63 s | 10.31 s | 10.30 s | 11.65 s | 1.03× (1.02–1.04) higher | 1.03× (1.02–1.04) higher | 0.91× (0.90–0.92) lower |
| Every row again, style recalc | 3.02 s | 2.76 s | 2.72 s | 4.67 s | 1.09× (1.06–1.12) higher | 1.11× (1.09–1.12) higher | 0.65× (0.63–0.65) lower |
| Every row again, layout | 2.38 s | 2.67 s | 2.70 s | 2.51 s | 0.89× (0.88–0.90) lower | 0.88× (0.87–0.90) lower | 0.95× (0.94–0.96) lower |
| Scroll, frame time p95 | 403.9 ms | 425.9 ms | 420.1 ms | 424.1 ms | 0.95× (0.92–0.99) lower | 0.962× (0.924–1.000) no clear difference | 0.95× (0.92–0.99) lower |
| Scroll, style recalc | 0.1 ms | 0.4 ms | 0.1 ms | 0.6 ms | 0.18× (0.10–1.25) no clear difference | 1.19× (0.44–3.88) no clear difference | 0.11× (0.08–0.38) lower |
| Hover across rows, style recalc | 78.1 ms | 80.1 ms | 79.6 ms | 79.8 ms | 0.97× (0.87–1.06) no clear difference | 0.98× (0.91–1.04) no clear difference | 0.98× (0.94–1.04) no clear difference |
| JavaScript heap | 66.75 MB | 71.26 MB | 71.26 MB | 64.98 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 1.03× (1.03–1.03) higher |

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
| Kirana | 1.76 s | 2.49 s | 9.21 s |
| StyleX | 7.36 s | 46.00 s | 447.68 s |
| StyleX (SWC) | 2.82 s | 7.04 s | 47.09 s |
| Tailwind | 2.01 s | 2.58 s | 7.91 s |
| Kirana ÷ StyleX | 0.24× (0.24–0.24) lower | 0.05× (0.05–0.05) lower | 0.02× (0.02–0.02) lower |
| Kirana ÷ StyleX (SWC) | 0.62× (0.61–0.63) lower | 0.35× (0.35–0.36) lower | 0.20× (0.19–0.20) lower |
| Kirana ÷ Tailwind | 0.87× (0.86–0.89) lower | 0.97× (0.94–0.98) lower | 1.16× (1.13–1.19) higher |

**CSS + JavaScript, gzip, at every size**

|  | 100 | 1,000 | 10,000 |
| --- | --- | --- | --- |
| Kirana | 141.7 kB | 169.1 kB | 427.0 kB |
| StyleX | 147.3 kB | 184.4 kB | 527.9 kB |
| StyleX (SWC) | 146.9 kB | 184.2 kB | 527.8 kB |
| Tailwind | 172.6 kB | 206.6 kB | 522.9 kB |
| Kirana ÷ StyleX | 0.96× (0.96–0.96) lower | 0.92× (0.92–0.92) lower | 0.81× (0.81–0.81) lower |
| Kirana ÷ StyleX (SWC) | 0.96× (0.96–0.96) lower | 0.92× (0.92–0.92) lower | 0.81× (0.81–0.81) lower |
| Kirana ÷ Tailwind | 0.82× (0.82–0.82) lower | 0.82× (0.82–0.82) lower | 0.82× (0.82–0.82) lower |

**100 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 1.76 s | 7.36 s | 2.82 s | 2.01 s | 0.24× (0.24–0.24) lower | 0.62× (0.61–0.63) lower | 0.87× (0.86–0.89) lower |
| CSS | 26.2 kB | 31.9 kB | 32.7 kB | 185.5 kB | 0.82× (0.82–0.82) lower | 0.80× (0.80–0.80) lower | 0.14× (0.14–0.14) lower |
| CSS, gzip | 6.6 kB | 9.3 kB | 9.3 kB | 27.1 kB | 0.72× (0.72–0.72) lower | 0.71× (0.71–0.71) lower | 0.24× (0.24–0.24) lower |
| CSS, brotli | 5.6 kB | 8.3 kB | 8.3 kB | 21.8 kB | 0.68× (0.68–0.68) lower | 0.67× (0.67–0.67) lower | 0.26× (0.26–0.26) lower |
| JavaScript | 454.5 kB | 470.6 kB | 469.7 kB | 506.8 kB | 0.97× (0.97–0.97) lower | 0.97× (0.97–0.97) lower | 0.90× (0.90–0.90) lower |
| JavaScript, gzip | 135.1 kB | 138.0 kB | 137.6 kB | 145.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.93× (0.93–0.93) lower |
| CSS + JavaScript, gzip | 141.7 kB | 147.3 kB | 146.9 kB | 172.6 kB | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower | 0.82× (0.82–0.82) lower |
| Style rules | 429 | 451 | 484 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 645 | 1,081 | not judged | not judged | not judged |

**1,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.49 s | 46.00 s | 7.04 s | 2.58 s | 0.05× (0.05–0.05) lower | 0.35× (0.35–0.36) lower | 0.97× (0.94–0.98) lower |
| CSS | 34.1 kB | 42.1 kB | 48.2 kB | 202.4 kB | 0.81× (0.81–0.81) lower | 0.71× (0.71–0.71) lower | 0.17× (0.17–0.17) lower |
| CSS, gzip | 8.5 kB | 12.7 kB | 12.9 kB | 29.3 kB | 0.67× (0.67–0.67) lower | 0.66× (0.66–0.66) lower | 0.29× (0.29–0.29) lower |
| CSS, brotli | 6.6 kB | 10.7 kB | 10.8 kB | 22.5 kB | 0.61× (0.61–0.61) lower | 0.61× (0.61–0.61) lower | 0.29× (0.29–0.29) lower |
| JavaScript | 891.4 kB | 1.03 MB | 1.03 MB | 1.18 MB | 0.87× (0.87–0.87) lower | 0.87× (0.87–0.87) lower | 0.75× (0.75–0.75) lower |
| JavaScript, gzip | 160.6 kB | 171.8 kB | 171.4 kB | 177.3 kB | 0.93× (0.93–0.93) lower | 0.94× (0.94–0.94) lower | 0.91× (0.91–0.91) lower |
| CSS + JavaScript, gzip | 169.1 kB | 184.4 kB | 184.2 kB | 206.6 kB | 0.92× (0.92–0.92) lower | 0.92× (0.92–0.92) lower | 0.82× (0.82–0.82) lower |
| Style rules | 429 | 451 | 725 | 712 | not judged | not judged | not judged |
| Declarations | 513 | 611 | 886 | 1,081 | not judged | not judged | not judged |

**10,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 9.21 s | 447.68 s | 47.09 s | 7.91 s | 0.02× (0.02–0.02) lower | 0.20× (0.19–0.20) lower | 1.16× (1.13–1.19) higher |
| CSS | 106.4 kB | 134.9 kB | 189.2 kB | 355.6 kB | 0.79× (0.79–0.79) lower | 0.56× (0.56–0.56) lower | 0.30× (0.30–0.30) lower |
| CSS, gzip | 23.8 kB | 41.8 kB | 42.1 kB | 43.1 kB | 0.57× (0.57–0.57) lower | 0.57× (0.57–0.57) lower | 0.55× (0.55–0.55) lower |
| CSS, brotli | 14.7 kB | 31.0 kB | 31.3 kB | 28.3 kB | 0.47× (0.47–0.47) lower | 0.47× (0.47–0.47) lower | 0.52× (0.52–0.52) lower |
| JavaScript | 5.30 MB | 6.62 MB | 6.62 MB | 7.98 MB | 0.80× (0.80–0.80) lower | 0.80× (0.80–0.80) lower | 0.66× (0.66–0.66) lower |
| JavaScript, gzip | 403.2 kB | 486.2 kB | 485.7 kB | 479.8 kB | 0.83× (0.83–0.83) lower | 0.83× (0.83–0.83) lower | 0.84× (0.84–0.84) lower |
| CSS + JavaScript, gzip | 427.0 kB | 527.9 kB | 527.8 kB | 522.9 kB | 0.81× (0.81–0.81) lower | 0.81× (0.81–0.81) lower | 0.82× (0.82–0.82) lower |
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
