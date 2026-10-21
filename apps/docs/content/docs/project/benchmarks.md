---
title: Benchmarks
description: Kirana measured against StyleX, compiled by Babel and by SWC, and Tailwind on the same applications, on every release, with every number's confidence interval.
section: project
order: 4
keywords:
  [
    benchmarks,
    performance,
    build time,
    css size,
    bundle size,
    stylex,
    swc,
    tailwind,
    confidence interval,
    kirana-lab,
  ]
---

# Benchmarks

Every number the site quotes comes from
[kirana-lab](https://github.com/kirana-style/kirana-lab), a public repository
that builds the same three applications three ways: with the published Kirana
release, with a StyleX port and with the Tailwind original. The StyleX port is
built twice, by StyleX's Babel plugin and by its Rust compiler on SWC, so a
comparison with StyleX holds whichever one you use. It measures on every Kirana
release and once a week, so an update to StyleX or Tailwind shows up too, and the
site takes the newest run through a pull request.

The figures below are Kirana {{fact:bench-version}}.

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

<!-- ::benchmarks part="run" -->

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

<!-- ::benchmarks part="behind" -->

## Build and output

Builds are each app's own `vite build`, cold (its output and Vite's cache removed
first), and interleaved, so a round builds Kirana, StyleX, StyleX (SWC) and
Tailwind in turn and a machine that slows down slows them all. Sizes are every client asset of the
type, each compressed on its own as a browser receives it: gzip at level 9,
brotli at quality 11.

### All three apps

<!-- ::benchmarks part="build" corpus="total" -->

Style rules and declarations are shown without a verdict: an atomic stylesheet
always has more, smaller rules, and what that costs is measured by the sizes and
the browser times.

### apps/web

<!-- ::benchmarks part="build" corpus="web" -->

### apps/blocks

<!-- ::benchmarks part="build" corpus="blocks" -->

### apps/examples

<!-- ::benchmarks part="build" corpus="examples" -->

## In the browser

The `web` app is grown to the same number of elements in each build, the CPU is
throttled, and Chrome's own counters are read through the DevTools protocol: the
style recalculation when the colour scheme switches, a hover, layout, and the
95th percentile of frame times.

### CPU throttled 4×

<!-- ::benchmarks part="browser" corpus="web" scenario="0" -->

### CPU throttled 6×

<!-- ::benchmarks part="browser" corpus="web" scenario="1" -->

## A large page

The demos above are small pages. The large-dom corpus is an order table of
thousands of rows, as an admin screen has, written in each implementation with its
own components: a status badge, a select, an icon button, and an Approve button on
pending orders. Every build renders the same rows, from one seeded generator.

Each round filters the table to the overdue orders and back to all of them, each
timed from the click to the next frame, scrolls through it, moves the pointer
across rows, and reads the JavaScript heap after a garbage collection. The page's
HTML and `class` attributes are its size.

<!-- ::benchmarks part="large-dom" -->

## The same components, more of them

The scale curve asks how the cost grows. A generator writes the same components
for every implementation, each in its own idiom: tokens, a recipe and a font size
with its line height in every one, and in fixed shares a hover state, a
breakpoint, a relation and a value known only at runtime. Each size is built cold,
and the curve is read across the sizes, never from one of them. It runs on a
runner of its own beside the rest, so compare its numbers with each other, not
with the tables above.

<!-- ::benchmarks part="scale-curve" -->

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
