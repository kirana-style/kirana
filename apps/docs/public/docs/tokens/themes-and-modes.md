# Themes and modes
Source: https://kirana.style/docs/tokens/themes-and-modes

# Themes and modes

## Modes

`mode` gives you three handles that set `color-scheme`:

```tsx
import { mode } from "@kirana-style/core"

<html sx={mode.system} />   // color-scheme: light dark - follows the OS
<html sx={mode.light} />
<html sx={mode.dark} />
```

Put it on the **root element**, not the body: the root decides the page's canvas
and scrollbars, and an iframe whose root scheme differs from its frame gets an
opaque backdrop.

With every colour written as a [`light-dark()` pair](/docs/tokens/semantic-tokens),
that single declaration is the whole dark-mode implementation. `system` needs no
JavaScript at all.

A three-way switch is then ordinary state:

```tsx
const [scheme, setScheme] = useState<"system" | "light" | "dark">("system")

<html sx={mode[scheme]}>
```

## Themes

`defineTheme` overrides variable tokens for a subtree:

```tsx
import { defineTheme } from "@kirana-style/core"
import { theme } from "./tokens"

export const brand = defineTheme(theme, {
  primary: `light-dark(${color.violet[500]}, ${color.violet[400]})`,
})

<section sx={brand}>…</section>
```

Everything inside the section reads the new value; everything outside is
untouched. Themes nest, and a theme may override some tokens and leave the rest.

<!-- ::figure-themes -->

Only **variable** tokens can be overridden: overriding an inlined one is an error
(`token-not-variable`), because there is no variable to change. If a token needs a
theme, declare its group with `variable: true`.

### Per-mode overrides

A theme can set both halves of a token:

```tsx
export const brand = defineTheme(theme, {
  surface: { light: "white", dark: "oklch(0.24 0 0)" },
})
```

## Where the values live

- Token defaults go in the `kirana.tokens` layer, on `:root`.
- Theme overrides go in `kirana.themes`, as a class.

Both sit below your component styles, so a component that sets a colour directly
always wins over a theme that suggests one.

## Remembering the reader's choice

A switch that only sets state forgets the choice on a reload, and another open tab
keeps its own. Keeping it takes three things, whatever the framework:

1. **Store the choice in a cookie**, not in `localStorage`. The server can read a
   cookie, so it renders the page in the saved mode and nothing flashes.
2. **Render the root in it on the server**: read the cookie, and put the matching
   handle on `<html>`.
3. **Tell the other tabs**: write the cookie in the browser when the reader
   chooses, and post the new mode on a `BroadcastChannel` the other tabs listen to.

`system` needs none of this: it is `color-scheme: light dark`, which follows the
operating system without JavaScript. A reader who never chooses gets no cookie.

<!-- ::figure-theme-flow -->

### In TanStack Start

The code below is for TanStack Start with server rendering; it is what this site
runs. Other frameworks follow the same three steps (see the table after it).

The cookie, read on the server from the request and in the browser from
`document.cookie`, so a client-side navigation sends no request:

```ts file="src/lib/theme.ts"
import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

export type Scheme = "system" | "light" | "dark"
export const COOKIE = "theme"

export const isScheme = (value: unknown): value is Scheme =>
  value === "system" || value === "light" || value === "dark"

export const readScheme = createIsomorphicFn()
  .server((): Scheme => {
    const value = getCookie(COOKIE)
    return isScheme(value) ? value : "system"
  })
  .client((): Scheme => {
    const value = document.cookie.match(/(?:^|; )theme=(\w+)/)?.[1]
    return isScheme(value) ? value : "system"
  })
```

A provider that writes the cookie and keeps the tabs in step:

```tsx file="src/components/theme.tsx"
import { createContext, use, useEffect, useRef, useState } from "react"

import { COOKIE, isScheme } from "@/lib/theme"
import type { Scheme } from "@/lib/theme"

const ThemeContext = createContext<{
  scheme: Scheme
  setScheme: (scheme: Scheme) => void
} | null>(null)

export function ThemeProvider({
  initial,
  children,
}: {
  initial: Scheme
  children: React.ReactNode
}) {
  const [scheme, setState] = useState(initial)
  const channel = useRef<BroadcastChannel | null>(null)

  // Another tab chose: follow it.
  useEffect(() => {
    const tabs = new BroadcastChannel(COOKIE)
    tabs.onmessage = (event) => {
      if (isScheme(event.data)) setState(event.data)
    }
    channel.current = tabs
    return () => tabs.close()
  }, [])

  const setScheme = (next: Scheme) => {
    setState(next)
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    channel.current?.postMessage(next)
  }

  return <ThemeContext value={{ scheme, setScheme }}>{children}</ThemeContext>
}

export const useTheme = () => use(ThemeContext)!
```

The root route reads the cookie before the document renders, and `<html>` takes
the handle:

```tsx file="src/routes/__root.tsx"
import { mode } from "@kirana-style/core"

import { ThemeProvider, useTheme } from "@/components/theme"
import { readScheme } from "@/lib/theme"

export const Route = createRootRoute({
  beforeLoad: () => ({ scheme: readScheme() }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { scheme } = Route.useRouteContext()
  return (
    <ThemeProvider initial={scheme}>
      <Html>{children}</Html>
    </ThemeProvider>
  )
}

function Html({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme()
  return (
    <html lang="en" sx={mode[scheme]}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

The switch is then any control that calls `setScheme`:

```tsx file="src/components/theme-switch.tsx"
const { scheme, setScheme } = useTheme()

<select value={scheme} onChange={(event) => setScheme(event.target.value as Scheme)}>
  <option value="system">System</option>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select>
```

Two more details:

- **The back-forward cache.** A page the browser restores from its cache missed the
  messages sent while it was away. Read the cookie again on `pageshow` when
  `event.persisted` is true.
- **No shortcut on Ctrl or Cmd+D.** It is the browser's bookmark key.

### In other frameworks

The provider and the switch stay the same; what changes is where the server reads
the cookie and where the root element is rendered.

| Framework                  | Read the cookie on the server, then render the root with it |
| -------------------------- | ----------------------------------------------------------- |
| Next.js (App Router)       | `(await cookies()).get("theme")` in the root layout         |
| Nuxt                       | `useCookie("theme")` in `app.vue`                           |
| SvelteKit                  | `cookies.get("theme")` in the root `+layout.server.ts`      |
| Astro                      | `Astro.cookies.get("theme")` in the layout                  |
| Laravel, Symfony, Rails, Phoenix and AdonisJS | the request's cookie, in the layout template                |

A site with no server (a static build) cannot read a cookie before the page is
sent. Keep the choice in `localStorage` instead, and apply it with a small inline
script at the top of `<head>`, which runs before the first paint:

```html
<script>
  const scheme = localStorage.getItem("theme")
  if (scheme === "light" || scheme === "dark")
    document.documentElement.style.colorScheme = scheme
</script>
```

Every colour is a `light-dark()` pair, so setting `color-scheme` is enough to
switch them all.

## What not to do

- **Do not put the mode on `<body>`.** The canvas belongs to the root.
- **Do not write a `dark:` variant.** There is no dark variant; the pair is in the
  token.
- **Do not theme scales.** Re-theming `space[4]` makes a layout unpredictable;
  theme the semantic layer instead.
