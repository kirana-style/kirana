---
title: "Introducing Kirana: styling, compiled"
summary: Why a styling compiler exists at all, what it does differently, and what is honestly not built yet.
date: 2026-09-16
author: Kirana team
tags: [announcement, compiler]
cover: https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=1600&q=80&auto=format&fit=crop
coverAlt: White marble with faint grey veins
---

Kirana exists because we spent two years losing the same argument with our own
stylesheets.

We built a real application with Tailwind. It was quick to write and it shipped,
and then it got big. A `cn()` call would delete a font size and take its line
height with it, because the two arrived in one utility. A `group-hover:` variant
would silently never fire, because the group it named was three components away.
Which of two classes won came down to their order in a generated stylesheet,
which meant the answer lived in devtools, not in the file we were reading.

So we moved it to StyleX. That fixed the parts that were about class strings:
styles became typed objects, conditions became values, and the compiler started
telling us things. It did not fix the question we kept asking. A style that won
in one component lost in another. Overriding a property replaced everything the
component had said about it, hover states included, and nothing warned us. We
were still reading rendered pages to find out what our source meant.

Each of those bugs was findable. None of them was _predictable_, and that is the
part that cost weeks.

Kirana is what we wanted at the end of that: the ergonomics we had learned to
like, with the precedence question answered in the source.

## The thesis

Styling has two hard problems, and only one of them is generating CSS.

The other is answering **which style wins**, and being able to answer it while
reading the source, not by opening devtools on a rendered page. Class-string
systems answer it with ordering rules nobody can hold in their head. Runtime
CSS-in-JS answers it with insertion order that depends on render order.

Kirana answers it with a stated ladder, and the compiler reports every case the
ladder cannot settle instead of picking one and moving on.

## What it does

It compiles the styles next to your components into one stylesheet of atoms (one
class per declaration), and rewrites `sx` into `className`. Nothing of it
remains at runtime except an optional helper under 1 kB, and that only when a
style depends on a value known at render time.

Three things fall out of that design:

- **Conditions live inside the value they change.** `backgroundColor: { base, ":hover" }`
  rather than a hover prefix somewhere in a class list.
- **Merging replaces entries, not properties.** A later style replaces what it
  names and leaves your hover state alone, which is either a relief or a
  surprise, depending on where you are coming from.
- **Colours are `light-dark()` pairs.** Dark mode is one declaration on the root
  element, not a variant on every utility.

## What is not built

It is not published to npm. The CLI has three commands, not nine. There is no
language server yet, no bundler beyond Vite and Rolldown, no framework beyond
React, and the `presets` key in the specification will fail validation if you
write it today.

The [status page](/docs/project/status) lists all of it. That list is the point:
a pre-release that pretends to be finished wastes the time of the people most
willing to help.

## Where it has been used

Every shadcn/ui component, a demo application, sixty-odd blocks and one page per
component are built on it, and verified against independent builds of the same
markup by comparing computed styles element by element, at three widths, in both
colour schemes.

That is a deliberately unforgiving test, and it is what found the compiler's real
bugs. It is also why the diagnostics exist: each one is a mistake that was silent
once, in an application we had to ship.

If you want to see it, [start here](/docs).
