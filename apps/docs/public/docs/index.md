# Introduction
Source: https://kirana.style/docs

# Introduction

Kirana compiles the styles you write next to your components into a plain CSS file.
There is no style engine in the browser, no class-name soup to decode, and no
guessing about which rule wins: the compiler decides at build time, and tells you
when it cannot.

## Start here

The docs have five parts: learn the model, set up your framework, move an
existing project, look something up, or see where the project stands.

- **Documentation** — The model, writing styles, tokens and configuration. [Quick start](/docs/start/quick-start), [How it works](/docs/start/how-it-works), [Mental model](/docs/start/mental-model)
- **Frameworks** — An install guide for every framework and bundler, each built on every change. [Vue](/docs/frameworks/vue), [Next.js](/docs/frameworks/nextjs), [TanStack Start](/docs/frameworks/tanstack-start)
- **Guides** — Moving from Tailwind or StyleX, and building larger systems. [From Tailwind](/docs/migration/from-tailwind), [From StyleX](/docs/migration/from-stylex), [A design system](/docs/advanced/design-system)
- **Reference** — The API, the command line, and every diagnostic with its code. [API](/docs/reference/api), [CLI](/docs/tooling/cli), [Diagnostics](/docs/tooling/diagnostics)
- **Project** — Where Kirana stands, what comes next, and how to help. [Status](/docs/project/status), [Roadmap](/docs/project/roadmap), [Contributing](/docs/project/contributing)

## A first look

A card, as you would write it, and what the compiler in this repository made of
it when this site was built. Nothing under CSS or Classes is written by hand:

<!-- ::example name="compile-card" -->

Each declaration became one class, and the `sx` prop became `className`. Nothing
of Kirana is left at runtime.

## Works with your framework

React, Next.js, React Router, TanStack Start, Gatsby, Preact, Solid, Vue, Nuxt, Svelte, SvelteKit, Astro, Qwik, Angular, Ember and Meteor; server templates in Laravel, Symfony, Rails, Phoenix and AdonisJS; or no
framework at all — on Vite, Rolldown, webpack, Rspack, Rsbuild, Parcel, Bun and esbuild, or Angular's CLI. Each has a complete
install guide, and each is built and checked in a browser on every change:
**[pick yours](/docs/frameworks/overview)**.

## What it gives you

- **Typed styles.** Ordinary objects, checked by TypeScript, with camelCase CSS
  property names and real values — not a string vocabulary you have to learn.
- **Conditions inside values.** `{ base: x, ":hover": y }` reads in the order it
  applies, instead of scattering `hover:` prefixes across a class list.
- **Predictable precedence.** A stated ladder decides which value wins, and the
  `ambiguous-precedence` diagnostic tells you when two values could both apply.
- **Tokens and themes.** Design tokens compile to constants or custom properties,
  and every colour can be a `light-dark()` pair, so dark mode needs no variant.
- **Real diagnostics.** 38 checks with codes, severities and help text, from
  unknown properties to a component that forgets to pass `sx` on.

## What it is not

Kirana is not a utility-class framework, and it does not generate CSS in the
browser. It does not try to style markup you do not render: the compiler works on
the source it can see.

> [!NOTE] Pre-release
> Kirana is built and used inside this repository, but it is not published to npm
> yet, and the name is a working name. Every page tells you what works today.
