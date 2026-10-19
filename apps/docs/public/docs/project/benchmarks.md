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

The figures below are Kirana 0.2.3.

| | |
| --- | --- |
| Kirana | 0.2.3, from npm |
| Date | 2026-10-19 |
| Versions | @stylexjs/stylex 0.19.1, @stylexjs/unplugin 0.19.1, @stylexswc/unplugin 0.19.1, @stylexswc/rs-compiler 0.19.1, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, vite 8.3.4, react 19.3.1 |
| Machine | GitHub-hosted runner, 4 cores (AMD EPYC 9V74), 16 GB, Linux 7.0.0-1017-azure |
| Tools | Node.js 26.3.0, Bun 1.4.3, Chrome 155.0.8059.84 |
| Rounds | 10 cold builds per app after 1 warm-up; 20 browser runs; 20 rounds at each large-dom size; 10 cold builds at each scale-curve size |
| Scale curve | its own GitHub-hosted runner, 4 cores (AMD EPYC 7763), 16 GB |
| Conformance | web passed, blocks passed, examples passed, large-dom passed, scale-curve passed |
| Run | https://github.com/kirana-style/kirana-lab/actions/runs/39195834342 |

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
- Build, cold, apps/examples: 1.01× Tailwind (1.01–1.02)
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
- JavaScript, gzip, apps/examples: 1.004× Tailwind (1.004–1.004)
- CSS, apps/large-dom: 1.12× StyleX (1.12–1.12)
- CSS, apps/large-dom: 1.11× StyleX (SWC) (1.11–1.11)
- CSS, gzip, apps/large-dom: 1.03× StyleX (1.03–1.03)
- CSS, gzip, apps/large-dom: 1.03× StyleX (SWC) (1.03–1.03)
- CSS, brotli, apps/large-dom: 1.01× StyleX (1.01–1.01)
- CSS, brotli, apps/large-dom: 1.01× StyleX (SWC) (1.01–1.01)
- JavaScript, apps/large-dom: 1.000× StyleX (SWC) (1.000–1.000)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 1,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 1,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- Filter, to the next frame, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.027× Tailwind (1.004–1.067)
- JavaScript heap, the large-dom table, 1,000 rows, CPU throttled 4×, about 22552 elements: 1.006× Tailwind (1.002–1.010)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (1.11–1.11)
- HTML, the large-dom table, 5,000 rows: 1.11× StyleX (SWC) (1.11–1.11)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (1.27–1.27)
- class attributes, the large-dom table, 5,000 rows: 1.27× StyleX (SWC) (1.27–1.27)
- Filter, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.022× Tailwind (1.002–1.038)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.04× StyleX (1.02–1.05)
- Every row again, to the next frame, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× StyleX (SWC) (1.01–1.04)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.11× StyleX (1.09–1.14)
- Every row again, style recalc, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.13× StyleX (SWC) (1.09–1.14)
- JavaScript heap, the large-dom table, 5,000 rows, CPU throttled 4×, about 112608 elements: 1.03× Tailwind (1.03–1.03)
- CSS, the scale curve, 100 components: 1.11× StyleX (1.11–1.11)
- CSS, the scale curve, 100 components: 1.08× StyleX (SWC) (1.08–1.08)
- CSS, gzip, the scale curve, 100 components: 1.01× StyleX (1.01–1.01)
- CSS, gzip, the scale curve, 100 components: 1.01× StyleX (SWC) (1.01–1.01)
- Build, cold, the scale curve, 1,000 components: 1.44× Tailwind (1.40–1.46)
- CSS, the scale curve, 1,000 components: 1.06× StyleX (1.06–1.06)
- Build, cold, the scale curve, 10,000 components: 2.51× Tailwind (2.47–2.56)

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 7.77 s | 24.85 s | 12.22 s | 7.72 s | 0.31× (0.31–0.31) lower | 0.64× (0.63–0.64) lower | 1.005× (0.997–1.012) no clear difference |
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
| Build, cold | 1.98 s | 4.77 s | 3.00 s | 2.11 s | 0.41× (0.41–0.42) lower | 0.66× (0.65–0.67) lower | 0.94× (0.92–0.95) lower |
| CSS | 76.7 kB | 65.4 kB | 66.5 kB | 184.2 kB | 1.17× (1.17–1.17) higher | 1.15× (1.15–1.15) higher | 0.42× (0.42–0.42) lower |
| CSS, gzip | 18.5 kB | 17.8 kB | 17.8 kB | 26.9 kB | 1.04× (1.04–1.04) higher | 1.04× (1.04–1.04) higher | 0.69× (0.69–0.69) lower |
| CSS, brotli | 16.1 kB | 15.8 kB | 15.9 kB | 21.7 kB | 1.02× (1.02–1.02) higher | 1.01× (1.01–1.01) higher | 0.74× (0.74–0.74) lower |
| JavaScript | 866.3 kB | 875.3 kB | 874.5 kB | 889.8 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.97× (0.97–0.97) lower |
| JavaScript, gzip | 279.0 kB | 284.9 kB | 284.6 kB | 282.5 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.99× (0.99–0.99) lower |
| CSS + JavaScript, gzip | 297.5 kB | 302.7 kB | 302.5 kB | 309.4 kB | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower | 0.96× (0.96–0.96) lower |
| Style rules | 1,189 | 1,059 | 1,101 | 724 | not judged | not judged | not judged |
| Declarations | 1,361 | 1,223 | 1,262 | 1,090 | not judged | not judged | not judged |

### apps/blocks

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.97 s | 11.44 s | 4.79 s | 2.83 s | 0.26× (0.26–0.26) lower | 0.62× (0.61–0.63) lower | 1.05× (1.04–1.06) higher |
| CSS | 90.9 kB | 80.9 kB | 82.3 kB | 204.0 kB | 1.12× (1.12–1.12) higher | 1.10× (1.10–1.10) higher | 0.45× (0.45–0.45) lower |
| CSS, gzip | 22.3 kB | 22.2 kB | 22.2 kB | 30.4 kB | 1.01× (1.01–1.01) higher | 1.01× (1.01–1.01) higher | 0.73× (0.73–0.73) lower |
| CSS, brotli | 19.0 kB | 19.4 kB | 19.5 kB | 24.1 kB | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower | 0.79× (0.79–0.79) lower |
| JavaScript | 1.91 MB | 1.93 MB | 1.91 MB | 1.99 MB | 0.99× (0.99–0.99) lower | 1.002× (1.002–1.002) higher | 0.96× (0.96–0.96) lower |
| JavaScript, gzip | 645.3 kB | 665.7 kB | 657.5 kB | 657.4 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.98× (0.98–0.98) lower |
| CSS + JavaScript, gzip | 667.6 kB | 687.9 kB | 679.7 kB | 687.8 kB | 0.97× (0.97–0.97) lower | 0.98× (0.98–0.98) lower | 0.97× (0.97–0.97) lower |
| Style rules | 1,524 | 1,404 | 1,452 | 881 | not judged | not judged | not judged |
| Declarations | 1,696 | 1,568 | 1,613 | 1,298 | not judged | not judged | not judged |

### apps/examples

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.80 s | 8.65 s | 4.43 s | 2.77 s | 0.32× (0.32–0.33) lower | 0.63× (0.63–0.64) lower | 1.01× (1.01–1.02) higher |
| CSS | 94.9 kB | 81.9 kB | 83.5 kB | 198.4 kB | 1.16× (1.16–1.16) higher | 1.14× (1.14–1.14) higher | 0.48× (0.48–0.48) lower |
| CSS, gzip | 23.3 kB | 22.8 kB | 22.8 kB | 29.7 kB | 1.02× (1.02–1.02) higher | 1.02× (1.02–1.02) higher | 0.78× (0.78–0.78) lower |
| CSS, brotli | 19.8 kB | 20.0 kB | 20.1 kB | 23.7 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| JavaScript | 2.06 MB | 2.08 MB | 2.06 MB | 2.09 MB | 0.99× (0.99–0.99) lower | 1.000× (1.000–1.000) lower | 0.99× (0.99–0.99) lower |
| JavaScript, gzip | 635.2 kB | 656.2 kB | 644.3 kB | 632.8 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 1.004× (1.004–1.004) higher |
| CSS + JavaScript, gzip | 658.4 kB | 679.0 kB | 667.1 kB | 662.6 kB | 0.97× (0.97–0.97) lower | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower |
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
| Colour-scheme switch, style recalc | 1.38 s | 1.40 s | 1.37 s | 5.22 s | 0.99× (0.94–1.03) no clear difference | 1.01× (0.95–1.09) no clear difference | 0.27× (0.26–0.27) lower |
| Colour-scheme switch, recalcs | 12 | 12 | 11 | 11 | 1.000× (0.870–1.100) no clear difference | 1.05× (0.91–1.09) no clear difference | 1.05× (0.91–1.09) no clear difference |
| Hover, style recalc | 9.3 ms | 9.9 ms | 9.2 ms | 23.3 ms | 0.94× (0.81–1.11) no clear difference | 1.02× (0.87–1.08) no clear difference | 0.40× (0.37–0.43) lower |
| Hover, recalcs | 19 | 19 | 19 | 39 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.49× (0.47–0.49) lower |
| Layout | 13.1 ms | 13.6 ms | 13.3 ms | 14.3 ms | 0.97× (0.93–1.04) no clear difference | 0.99× (0.95–1.05) no clear difference | 0.92× (0.89–0.98) lower |
| Frame time, p95 | 177.8 ms | 173.8 ms | 173.6 ms | 1.27 s | 1.02× (0.96–1.09) no clear difference | 1.02× (0.97–1.10) no clear difference | 0.14× (0.13–0.15) lower |

### CPU throttled 6×

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Colour-scheme switch, style recalc | 2.26 s | 2.19 s | 2.19 s | 8.12 s | 1.03× (0.97–1.09) no clear difference | 1.03× (0.96–1.11) no clear difference | 0.28× (0.26–0.29) lower |
| Colour-scheme switch, recalcs | 10 | 11 | 11 | 11 | 0.909× (0.909–1.000) no clear difference | 0.91× (0.91–1.05) no clear difference | 0.909× (0.909–1.000) no clear difference |
| Hover, style recalc | 13.6 ms | 13.3 ms | 12.9 ms | 34.6 ms | 1.02× (0.84–1.22) no clear difference | 1.05× (0.88–1.19) no clear difference | 0.39× (0.33–0.44) lower |
| Hover, recalcs | 19 | 19 | 19 | 36 | 1.000× (1.000–1.000) no clear difference | 1.000× (1.000–1.000) no clear difference | 0.53× (0.51–0.53) lower |
| Layout | 20.8 ms | 20.3 ms | 20.5 ms | 21.1 ms | 1.03× (0.97–1.08) no clear difference | 1.02× (0.98–1.07) no clear difference | 0.99× (0.93–1.05) no clear difference |
| Frame time, p95 | 283.2 ms | 290.9 ms | 288.1 ms | 1.99 s | 0.97× (0.92–1.08) no clear difference | 0.98× (0.93–1.06) no clear difference | 0.14× (0.13–0.15) lower |

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
| CSS | 36.1 kB | 32.3 kB | 32.6 kB | 183.4 kB | 1.12× (1.12–1.12) higher | 1.11× (1.11–1.11) higher | 0.20× (0.20–0.20) lower |
| CSS, gzip | 9.6 kB | 9.3 kB | 9.4 kB | 26.8 kB | 1.03× (1.03–1.03) higher | 1.03× (1.03–1.03) higher | 0.36× (0.36–0.36) lower |
| CSS, brotli | 8.5 kB | 8.4 kB | 8.4 kB | 21.6 kB | 1.01× (1.01–1.01) higher | 1.01× (1.01–1.01) higher | 0.39× (0.39–0.39) lower |
| JavaScript | 415.5 kB | 416.3 kB | 415.3 kB | 439.3 kB | 0.998× (0.998–0.998) lower | 1.000× (1.000–1.000) higher | 0.95× (0.95–0.95) lower |
| JavaScript, gzip | 134.7 kB | 135.8 kB | 135.4 kB | 143.0 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 144.3 kB | 145.1 kB | 144.8 kB | 169.8 kB | 0.99× (0.99–0.99) lower | 0.997× (0.997–0.997) lower | 0.85× (0.85–0.85) lower |
| Style rules | 479 | 484 | 494 | 710 | not judged | not judged | not judged |
| Declarations | 651 | 644 | 655 | 1,079 | not judged | not judged | not judged |

**1,000 rows, CPU throttled 4×, about 22552 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 4.80 MB | 4.33 MB | 4.33 MB | 5.76 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 2.26 MB | 1.78 MB | 1.78 MB | 3.20 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 318.8 ms | 321.5 ms | 322.4 ms | 310.3 ms | 0.99× (0.96–1.02) no clear difference | 0.99× (0.96–1.01) no clear difference | 1.027× (1.004–1.067) higher |
| Filter, style recalc | 1.8 ms | 1.8 ms | 1.7 ms | 2.5 ms | 1.01× (0.89–1.15) no clear difference | 1.06× (0.94–1.27) no clear difference | 0.75× (0.64–0.87) lower |
| Filter, layout | 46.3 ms | 46.5 ms | 45.8 ms | 47.8 ms | 0.99× (0.95–1.05) no clear difference | 1.01× (0.96–1.05) no clear difference | 0.97× (0.94–1.02) no clear difference |
| Every row again, to the next frame | 1.66 s | 1.64 s | 1.62 s | 1.82 s | 1.01× (0.99–1.03) no clear difference | 1.025× (1.000–1.038) no clear difference | 0.91× (0.89–0.93) lower |
| Every row again, style recalc | 411.6 ms | 433.0 ms | 417.8 ms | 647.8 ms | 0.95× (0.92–1.01) no clear difference | 0.99× (0.95–1.04) no clear difference | 0.64× (0.61–0.66) lower |
| Every row again, layout | 405.3 ms | 402.6 ms | 410.4 ms | 415.2 ms | 1.01× (0.98–1.04) no clear difference | 0.99× (0.94–1.03) no clear difference | 0.98× (0.96–1.01) no clear difference |
| Scroll, frame time p95 | 113.0 ms | 111.7 ms | 108.0 ms | 114.0 ms | 1.01× (0.99–1.07) no clear difference | 1.05× (0.97–1.08) no clear difference | 0.99× (0.94–1.04) no clear difference |
| Scroll, style recalc | 0.6 ms | 0.8 ms | 0.9 ms | 1.8 ms | 0.79× (0.29–1.61) no clear difference | 0.67× (0.24–1.20) no clear difference | 0.34× (0.13–0.60) lower |
| Hover across rows, style recalc | 27.2 ms | 28.7 ms | 28.6 ms | 33.6 ms | 0.95× (0.81–1.14) no clear difference | 0.95× (0.79–1.07) no clear difference | 0.81× (0.71–0.93) lower |
| JavaScript heap | 16.46 MB | 17.38 MB | 17.39 MB | 16.37 MB | 0.95× (0.94–0.95) lower | 0.95× (0.94–0.95) lower | 1.006× (1.002–1.010) higher |

**5,000 rows, CPU throttled 4×, about 112608 elements**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HTML | 23.98 MB | 21.63 MB | 21.63 MB | 28.77 MB | 1.11× (1.11–1.11) higher | 1.11× (1.11–1.11) higher | 0.83× (0.83–0.83) lower |
| class attributes | 11.28 MB | 8.88 MB | 8.88 MB | 15.96 MB | 1.27× (1.27–1.27) higher | 1.27× (1.27–1.27) higher | 0.71× (0.71–0.71) lower |
| Filter, to the next frame | 1.67 s | 1.75 s | 1.75 s | 1.63 s | 0.95× (0.93–0.97) lower | 0.95× (0.94–0.97) lower | 1.022× (1.002–1.038) higher |
| Filter, style recalc | 2.6 ms | 3.3 ms | 3.5 ms | 3.3 ms | 0.80× (0.54–0.95) lower | 0.75× (0.68–0.86) lower | 0.80× (0.73–0.87) lower |
| Filter, layout | 268.9 ms | 358.8 ms | 342.7 ms | 253.4 ms | 0.75× (0.72–0.80) lower | 0.78× (0.74–0.85) lower | 1.061× (1.000–1.104) no clear difference |
| Every row again, to the next frame | 8.78 s | 8.43 s | 8.56 s | 10.22 s | 1.04× (1.02–1.05) higher | 1.03× (1.01–1.04) higher | 0.86× (0.84–0.87) lower |
| Every row again, style recalc | 2.32 s | 2.09 s | 2.06 s | 3.81 s | 1.11× (1.09–1.14) higher | 1.13× (1.09–1.14) higher | 0.61× (0.60–0.62) lower |
| Every row again, layout | 1.97 s | 2.27 s | 2.25 s | 2.09 s | 0.87× (0.85–0.88) lower | 0.88× (0.86–0.89) lower | 0.94× (0.92–0.96) lower |
| Scroll, frame time p95 | 516.8 ms | 516.9 ms | 521.4 ms | 526.6 ms | 1.000× (0.970–1.031) no clear difference | 0.99× (0.96–1.01) no clear difference | 0.98× (0.96–1.01) no clear difference |
| Scroll, style recalc | 0.1 ms | 0.1 ms | 0.1 ms | 0.6 ms | 0.79× (0.11–6.79) no clear difference | 0.85× (0.38–7.73) no clear difference | 0.10× (0.08–0.98) lower |
| Hover across rows, style recalc | 102.0 ms | 102.9 ms | 99.4 ms | 103.8 ms | 0.99× (0.96–1.02) no clear difference | 1.026× (0.996–1.057) no clear difference | 0.98× (0.96–1.04) no clear difference |
| JavaScript heap | 66.70 MB | 71.27 MB | 71.26 MB | 64.91 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 1.03× (1.03–1.03) higher |

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
| Kirana | 2.63 s | 5.05 s | 30.30 s |
| StyleX | 10.14 s | 61.50 s | 606.69 s |
| StyleX (SWC) | 4.07 s | 9.04 s | 59.86 s |
| Tailwind | 2.76 s | 3.52 s | 12.06 s |
| Kirana ÷ StyleX | 0.26× (0.25–0.27) lower | 0.08× (0.08–0.08) lower | 0.05× (0.05–0.05) lower |
| Kirana ÷ StyleX (SWC) | 0.65× (0.63–0.66) lower | 0.56× (0.55–0.57) lower | 0.51× (0.50–0.52) lower |
| Kirana ÷ Tailwind | 0.95× (0.94–0.97) lower | 1.44× (1.40–1.46) higher | 2.51× (2.47–2.56) higher |

**CSS + JavaScript, gzip, at every size**

|  | 100 | 1,000 | 10,000 |
| --- | --- | --- | --- |
| Kirana | 145.6 kB | 174.7 kB | 448.7 kB |
| StyleX | 147.2 kB | 184.4 kB | 527.9 kB |
| StyleX (SWC) | 146.9 kB | 184.2 kB | 527.8 kB |
| Tailwind | 172.5 kB | 206.6 kB | 522.8 kB |
| Kirana ÷ StyleX | 0.99× (0.99–0.99) lower | 0.95× (0.95–0.95) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ StyleX (SWC) | 0.99× (0.99–0.99) lower | 0.95× (0.95–0.95) lower | 0.85× (0.85–0.85) lower |
| Kirana ÷ Tailwind | 0.84× (0.84–0.84) lower | 0.85× (0.85–0.85) lower | 0.86× (0.86–0.86) lower |

**100 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 2.63 s | 10.14 s | 4.07 s | 2.76 s | 0.26× (0.25–0.27) lower | 0.65× (0.63–0.66) lower | 0.95× (0.94–0.97) lower |
| CSS | 35.5 kB | 31.9 kB | 32.7 kB | 185.5 kB | 1.11× (1.11–1.11) higher | 1.08× (1.08–1.08) higher | 0.19× (0.19–0.19) lower |
| CSS, gzip | 9.4 kB | 9.3 kB | 9.3 kB | 27.1 kB | 1.01× (1.01–1.01) higher | 1.01× (1.01–1.01) higher | 0.35× (0.35–0.35) lower |
| CSS, brotli | 8.2 kB | 8.3 kB | 8.3 kB | 21.8 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.38× (0.38–0.38) lower |
| JavaScript | 465.3 kB | 470.5 kB | 469.5 kB | 506.7 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.92× (0.92–0.92) lower |
| JavaScript, gzip | 136.2 kB | 138.0 kB | 137.5 kB | 145.4 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.94× (0.94–0.94) lower |
| CSS + JavaScript, gzip | 145.6 kB | 147.2 kB | 146.9 kB | 172.5 kB | 0.99× (0.99–0.99) lower | 0.99× (0.99–0.99) lower | 0.84× (0.84–0.84) lower |
| Style rules | 446 | 451 | 484 | 712 | not judged | not judged | not judged |
| Declarations | 618 | 611 | 645 | 1,081 | not judged | not judged | not judged |

**1,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 5.05 s | 61.50 s | 9.04 s | 3.52 s | 0.08× (0.08–0.08) lower | 0.56× (0.55–0.57) lower | 1.44× (1.40–1.46) higher |
| CSS | 44.6 kB | 42.1 kB | 48.2 kB | 202.4 kB | 1.06× (1.06–1.06) higher | 0.93× (0.93–0.93) lower | 0.22× (0.22–0.22) lower |
| CSS, gzip | 11.7 kB | 12.7 kB | 12.9 kB | 29.3 kB | 0.92× (0.92–0.92) lower | 0.91× (0.91–0.91) lower | 0.40× (0.40–0.40) lower |
| CSS, brotli | 9.8 kB | 10.7 kB | 10.8 kB | 22.5 kB | 0.91× (0.91–0.91) lower | 0.91× (0.91–0.91) lower | 0.44× (0.44–0.44) lower |
| JavaScript | 982.1 kB | 1.03 MB | 1.03 MB | 1.18 MB | 0.96× (0.96–0.96) lower | 0.96× (0.96–0.96) lower | 0.83× (0.83–0.83) lower |
| JavaScript, gzip | 163.0 kB | 171.7 kB | 171.3 kB | 177.3 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.92× (0.92–0.92) lower |
| CSS + JavaScript, gzip | 174.7 kB | 184.4 kB | 184.2 kB | 206.6 kB | 0.95× (0.95–0.95) lower | 0.95× (0.95–0.95) lower | 0.85× (0.85–0.85) lower |
| Style rules | 446 | 451 | 725 | 712 | not judged | not judged | not judged |
| Declarations | 618 | 611 | 886 | 1,081 | not judged | not judged | not judged |

**10,000 components**

| Measure | Kirana | StyleX | StyleX (SWC) | Tailwind | Kirana ÷ StyleX | Kirana ÷ StyleX (SWC) | Kirana ÷ Tailwind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build, cold | 30.30 s | 606.69 s | 59.86 s | 12.06 s | 0.05× (0.05–0.05) lower | 0.51× (0.50–0.52) lower | 2.51× (2.47–2.56) higher |
| CSS | 127.8 kB | 134.9 kB | 189.2 kB | 355.6 kB | 0.95× (0.95–0.95) lower | 0.68× (0.68–0.68) lower | 0.36× (0.36–0.36) lower |
| CSS, gzip | 31.0 kB | 41.8 kB | 42.1 kB | 43.1 kB | 0.74× (0.74–0.74) lower | 0.74× (0.74–0.74) lower | 0.72× (0.72–0.72) lower |
| CSS, brotli | 22.7 kB | 31.0 kB | 31.3 kB | 28.3 kB | 0.73× (0.73–0.73) lower | 0.72× (0.72–0.72) lower | 0.80× (0.80–0.80) lower |
| JavaScript | 6.19 MB | 6.62 MB | 6.62 MB | 7.98 MB | 0.94× (0.94–0.94) lower | 0.94× (0.94–0.94) lower | 0.78× (0.78–0.78) lower |
| JavaScript, gzip | 417.7 kB | 486.1 kB | 485.6 kB | 479.7 kB | 0.86× (0.86–0.86) lower | 0.86× (0.86–0.86) lower | 0.87× (0.87–0.87) lower |
| CSS + JavaScript, gzip | 448.7 kB | 527.9 kB | 527.8 kB | 522.8 kB | 0.85× (0.85–0.85) lower | 0.85× (0.85–0.85) lower | 0.86× (0.86–0.86) lower |
| Style rules | 446 | 451 | 2,914 | 712 | not judged | not judged | not judged |
| Declarations | 618 | 611 | 3,075 | 1,081 | not judged | not judged | not judged |

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
