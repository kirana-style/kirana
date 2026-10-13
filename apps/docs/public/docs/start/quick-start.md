# Quick start
Source: https://kirana.style/docs/start/quick-start

# Quick start

This page runs Kirana inside the repository it is built in, which needs nothing
but a checkout. To add it to your own project instead, run `npx kirana init` there
— it shows the setup as a diff before writing it ([installation](/docs/start/installation#let-kirana-init-do-it))
— or follow the guide for your framework in
[supported frameworks](/docs/frameworks/overview).

> [!IMPORTANT] Before you start
> You need [Bun](https://bun.com) 1.4 or newer and Node.js 22.18 or newer. The
> compiler is written in Rust and compiled to a native addon; building it needs a
> Rust toolchain through [rustup](https://rustup.rs).

## 1. Get the repository running

```bash
git clone https://github.com/kirana-style/kirana.git && cd kirana
bun install
bun run build
```

`bun run build` compiles the native engine first, then this documentation site. When it
finishes, the compiler is ready to use.

## 2. Look at a component

Every component in `packages/ui` is written with Kirana. Open one — say
`packages/ui/src/components/badge.tsx` — and you will find style handles at the
top of the file and an `sx` prop on the elements below.

```tsx file="a-component.tsx"
import { css } from "@kirana-style/core"

const styles = {
  root: css({
    display: "inline-flex",
    borderRadius: "9999px",
    paddingInline: "0.5rem",
    fontSize: "0.75rem",
  }),
}

export function Badge(props: React.ComponentProps<"span">) {
  return <span {...props} sx={styles.root} />
}
```

## 3. Start the site and change something

```bash
bun dev
```

This documentation is on <http://localhost:3000>. Change a value in any `css({ … })` call and the
page updates without a reload: the compiler rebuilds the stylesheet and sends it
through Vite's hot update channel.

## 4. See what it compiled to

Ask the compiler what it produced, and why a value won:

```bash
# every diagnostic in a directory
node packages/kirana/npm/compiler/bin/kirana.ts check packages/ui/src

# which declaration wins for a property, and why
node packages/kirana/npm/compiler/bin/kirana.ts trace packages/ui/src/components/badge.tsx:12 color
```

`trace` prints one line per candidate declaration, marks the winner, and names
the step of the [precedence ladder](/docs/styling/precedence) that decided it.

## Where to go next

- [Installation](/docs/start/installation) — adding Kirana to an app of your own.
- [Your first component](/docs/start/first-component) — a button, with the CSS it
  compiles to.
- [Mental model](/docs/start/mental-model) — the four ideas that make the rest
  predictable.
