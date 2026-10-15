---
title: What we measured
summary: Build time and output size against StyleX and Tailwind on the same three applications, with the method and with the caveats stated first.
date: 2026-09-20
author: Kirana team
tags: [benchmark, performance]
cover: https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?w=1600&q=80&auto=format&fit=crop
coverAlt: White walls meeting at an angle
---

Performance claims in styling tools are usually a number without a method. This
post is the method, and the caveats come first.

## The caveats

- The numbers below come from **shared CI machines**, not dedicated hardware.
  They are advisory. Treat them as "the same order of magnitude", not as a
  benchmark result.
- The comparison is **our shadcn/ui port**: the same three applications (a demo,
  sixty-odd blocks, one page per component), built three ways.
- All three are the same markup, kept deliberately identical in structure and
  checked against each other by comparing computed styles. That is what makes the
  comparison fair; it is also what makes it narrow.

## What is measured

Two things in the build benchmark:

1. **Build time**: a full production build, several rounds, median.
2. **Output size**: CSS and JavaScript, raw and gzipped, each file gzipped on
   its own, as a browser receives them.

A third thing is measured separately, because build size says nothing about it:
what the stylesheet costs the browser. One class per declaration means more
selectors to match per element, and `:where()` and relation selectors mean more
again. So the same page is opened in all three builds, grown to six thousand
elements, and driven through colour-scheme switches and hovers with the CPU
throttled, reading the renderer's own recalculation numbers.

## The shape of the result

On the corpus total, Kirana built fastest and shipped the smallest gzipped CSS,
with total gzipped CSS + JavaScript below both baselines. StyleX produced smaller
raw CSS before compression (about 8 % smaller), and we have not closed that gap;
Tailwind's CSS was the largest, raw and gzipped.

The interesting part is _why_, and it is not cleverness:

- **Atoms are shared.** One class per declaration means a declaration written in
  forty components is one rule.
- **Unused styles emit nothing**, so an imported preset costs nothing.
- **The prefilter** means the compiler looks at the modules that carry styles,
  not at the dependency graph.

And the raw-CSS gap has a cause too. Kirana's class names carry structure (a
property code, a condition hash, a value hash), which costs characters and pays
them back under compression, because the same fragments repeat and gzip finds
them. Random per-atom names are shorter on disk and larger over the wire; we
measured that swap and it cost 2.1 kB gzipped. So the raw number is a real trade,
not an oversight, and it is the compressed number that reaches a browser.

## What would change the numbers

Being honest about this matters more than the numbers. Results depend on:

- how much of your CSS is shared versus unique;
- how many values are dynamic, since a bridged value is a rule plus a custom
  property, which is cheap but not free;
- whether the baseline uses a design system with its own variants.

A different corpus would produce different numbers, and we would publish those
too.

## Reproducing it

The benchmark script lives in the repository and takes the three checkouts as
arguments; CI runs it on every push and writes the table into the job summary.
The method, including the claims policy this post follows, is in the
specification.

If you want a number for _your_ application, run it on your application. That is
the only number that means anything.
