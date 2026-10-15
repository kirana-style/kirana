---
title: No framework
description: Use Kirana without a framework: style handles are class strings, merged with cx, for plain TypeScript, web components and server templates.
section: frameworks
order: 14
keywords: [vanilla, no framework, web components, typescript, cx, className]
---

# No framework

A style handle is a class string, and `cx` merges handles the way `sx` does. That
is all plain TypeScript, a web component or a server template needs. Tested by
`examples/vite-vanilla`.

<!-- ::npm-status -->

## 1. Install

<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->

## 2. Add the plugin

```ts file="vite.config.ts"
import kirana from "@kirana-style/vite"
import { defineConfig } from "vite"

export default defineConfig({ plugins: [kirana()] })
```

## 3. Import the stylesheet

```ts file="src/main.ts"
import "@kirana-style/core/stylesheet.css"
```

## 4. Style elements

```ts file="src/main.ts"
import { css, cx } from "@kirana-style/core"

const button = css({ paddingInline: "1rem", borderRadius: "0.5rem" })
const primary = css({ backgroundColor: "black", color: "white" })

const element = document.createElement("button")
element.className = String(cx(button, primary))
```

Later handles win, exactly as in an `sx` list, so `cx(button, primary)` is the
merge you want and `cx(primary, button)` the reverse.

## Without a bundler

`kirana-style build src --out styles.css` writes the stylesheet from the command line;
see the [CLI](/docs/tooling/cli).

## Next

- [Your first component](/docs/start/first-component): a button with a hover state
  and a variant, and the CSS it compiles to.
