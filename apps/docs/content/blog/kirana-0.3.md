---
title: Kirana 0.3.0
summary: Typed states for headless components, values checked against the CSS grammar, Remix 3 and six more frameworks, and one breaking change to how variable tokens are written.
date: 2026-10-21
author: Kirana team
tags: [announcement, release]
---

Kirana 0.3.0 is on npm. Every package is released at the same version, so update
all the Kirana packages your project lists to 0.3.0 together, then run:

```console
$ npx kirana-style@latest doctor
```

`doctor` reads your project and says when its Kirana packages are not all on one
release. The rest of this post is what changed and why, starting with the one
change that can break a build.

## Breaking: a variable token is written only where it is used

A production build now writes a variable token's custom property only when
something uses it: a rule that reads it, or finished JavaScript that still names
it. A design system can define a hundred variable tokens, and a page that reads
ten ships ten.

What breaks is a token read by code the compiler never sees, such as a plain
script, a server-only template or a third party. Declare those `runtime: true`,
for one token or a whole group, and they are always written:

```tsx
export const brand = defineTokens(
  "brand",
  { accent: "oklch(0.7 0.15 150)" },
  { runtime: true }
)
```

If code rendered after the stylesheet names a token the build left out, the
build stops and names it, so a missing declaration never reaches a page. The
dev server, `kirana-style check` and bundlers other than Vite and Rolldown write
every variable token, as before. The details are in
[tokens nothing uses](/docs/tokens/overview).

## Component states, typed

A headless library tells you a part's state through data attributes: a switch
gets `data-checked`, a popup `data-side="bottom"`. The new
`@kirana-style/states` lists them, so you pick a state instead of typing its
attribute:

```tsx
import { css } from "@kirana-style/core"
import { Select, Switch } from "@kirana-style/states/base-ui"

const track = css({
  backgroundColor: {
    base: "gray",
    [Switch.Root.checked]: { base: "blue", [Switch.Root.disabled]: "silver" },
  },
})

const popup = css({ marginTop: { [Select.Popup.side.bottom]: "4px" } })
```

A misspelt state is a type error, and your editor shows Base UI's own
description of each one. The vocabulary is generated from the declarations Base
UI publishes, with the names Base UI exports, and CI checks it against them. Each
entry is a plain condition key, so it nests, sits beside a breakpoint, reads
through a relation and ships nothing.

Nothing about it is specific to Base UI. Any library that marks state with data
attributes, or your own components, takes a vocabulary of a few lines; the
[component states](/docs/styling/states) guide shows how.

## Values checked against the CSS grammar

`invalid-value` used to catch broken structure: an empty value, a stray `;`, an
unbalanced bracket. It now checks every value against its property's grammar,
as MDN writes it:

```tsx
css({ display: "center" }) // error: a keyword display does not take
css({ padding: "-4px" }) // error: padding is never negative
css({ padding: color.accent }) // error: a colour token on a length
```

The last line needs no new API: a variable token is checked through the value it
declares. What the check cannot judge it leaves alone, because rejecting valid
CSS is worse than missing a mistake. A keyword or function the data does not
know may be newer CSS than the data, so it passes, and so do function arguments
and `var()`. `calc-size()` and `anchor-center` compile as before.

The check found real mistakes on its first run, in Kirana's own preset:
`max-w-auto` and `max-h-auto`, which Tailwind does not have and `max-width`
does not accept. They are gone.

## Remix 3, and more frameworks

Remix 3 compiles TypeScript and JSX itself and offers no hook before that, so
the compiler learned to read compiled JSX. `@kirana-style/remix` adds a Node hook
after `node-tsx`, a loader for the asset server, and router middleware that
serves the stylesheet from the server's compiler session. The
[Remix guide](/docs/frameworks/remix) has the setup, and `npx kirana-style init`
writes most of it.

SolidStart, Vike, Waku, VitePress, Docusaurus and Storybook have guides and
example apps too, which makes {{fact:frameworks-count}} framework guides in all.

## Smaller and steadier

- **Rules share more.** Atoms within one conflict key are ordered so that
  neighbouring keys share a rule, which makes the stylesheet smaller with the
  same computed styles.
- **Less repeated work.** The compiler keeps the stylesheet and the project's
  diagnostics until something changes them, instead of producing them again.
- **Budgets on every pull request.** What the compiler's output weighs and what
  its types cost to check are recorded in the repository, so any change to
  either shows in the pull request's diff, for review.

## What 0.3.0 measured

[kirana-lab](https://github.com/kirana-style/kirana-lab) measured 0.3.0, installed
from npm, on 21 October ([the run](https://github.com/kirana-style/kirana-lab/actions/runs/39560109230)).
It made ten cold builds of each application with each tool, interleaved, on a
GitHub-hosted runner with 4 cores (Intel Xeon 6973P-C) and 16 GB. Every build
first passed the conformance check, element by element. Each comparison below
is a ratio of medians with a 95 % confidence interval, and "level" means the
interval includes 1. StyleX is measured twice, through its Babel plugin and its
SWC compiler, both at 0.19.1, and Tailwind at 4.3.3.

### The three applications

The demo page, sixty-odd shadcn/ui blocks and a page for every component,
added together:

|                          |   Kirana | StyleX (Babel) | StyleX (SWC) | Tailwind |
| ------------------------ | -------: | -------------: | -----------: | -------: |
| Cold builds              |   7.20 s |        23.11 s |      11.98 s |   7.47 s |
| CSS, gzip                |  63.0 kB |        62.8 kB |      62.8 kB |  87.1 kB |
| CSS, raw                 | 253.9 kB |       228.2 kB |     232.3 kB | 586.5 kB |
| CSS and JavaScript, gzip |  1.62 MB |        1.67 MB |      1.65 MB |  1.66 MB |

- **Builds:** 3.2× faster than StyleX through Babel, 1.7× faster than through
  SWC, and 4 % faster than Tailwind.
- **CSS, gzip:** 28 % smaller than Tailwind's, and under 1 % larger than
  StyleX's.
- **What a browser downloads,** CSS and JavaScript gzipped: 3 % smaller than
  StyleX through Babel, 2 % smaller than through SWC and than Tailwind.

### In the browser

On the demo page, about 6,200 elements, with the CPU throttled 4×:

- **Switching the colour scheme:** level with StyleX, and 4.4× less style
  recalculation time than Tailwind.
- **A hover:** level with StyleX, and 2.4× less recalculation time than
  Tailwind.

On a large page, an order table of 1,000 rows and about 22,500 elements:

- **Filtering and scrolling:** level with every other build.
- **A hover:** 23 % less recalculation time than Tailwind, level with StyleX.
- **Memory:** a 5 % smaller heap than StyleX's.
- **What a browser downloads:** 16 % less than Tailwind, 1 % less than StyleX.

### Where Kirana is behind

- **Raw CSS:** 11 % larger than StyleX's through Babel and 9 % larger than
  through SWC. Compressed, the gap is under 1 %, but it is there.
- **Builds as a project grows.** The scale curve writes the same components
  again and again, into a project of 100, 1,000 and 10,000. At 1,000 Kirana's
  build is 18 % slower than Tailwind's (4.1 s against 3.5 s), and at 10,000 it
  is 74 % slower (19.7 s against 11.3 s). It stays 2.1× and 2.9× faster than
  StyleX through SWC. Its CSS grows more slowly than both: at 10,000 its gzipped
  CSS is 29 % smaller than StyleX's through SWC and 30 % smaller than Tailwind's.
- **Memory on the large page:** Tailwind's heap is under 1 % smaller.

The [benchmarks page](/docs/project/benchmarks) has every measure with its
interval, and shows the newest run as the site takes it.
