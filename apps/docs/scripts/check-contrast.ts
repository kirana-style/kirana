/**
 * Fails when a colour pair the site sets text in falls below WCAG AA.
 *
 * The tokens are Kirana `defineTokens` groups, which only exist once compiled, so this reads their
 * source: every `light-dark(oklch(…), oklch(…))` pair in the theme (`packages/ui`) and in the scene
 * hues (`packages/docs-ui/src/accent.ts`). Each pair is measured in both schemes:
 *
 *   text        foreground and muted text on the background, a card and a muted surface   4.5 : 1
 *   hues        every scene hue as text on the same three surfaces                         4.5 : 1
 *   on a hue    the background colour drawn on a hue (a keycap's glyph, `accent.on`)       4.5 : 1
 *   primary     the primary button's label                                                 4.5 : 1
 *   code panes  the text, muted text and line numbers of the site's code panes (`EDITOR` in
 *               `editor-window.tsx`) and of its VS Code window (`CHROME`), on their
 *               backgrounds and bars, in the one scheme they have                       4.5 : 1
 *
 * The VS Code window's line numbers are VS Code's own (GitHub Dark), and are not checked.
 *
 *   bun scripts/check-contrast.ts          (add --table to print every pair)
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const repository = join(new URL("..", import.meta.url).pathname, "../..")
const table = process.argv.includes("--table")

type Oklch = [number, number, number]
type Pair = { light: Oklch; dark: Oklch }

/** `name: "light-dark(oklch(a b c), oklch(d e f))"`, quoted or backticked, at any indent. */
const PAIR =
  /(\w+):\s*["`]light-dark\(oklch\(([\d.]+) ([\d.]+) ([\d.]+)\),\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)\)["`]/g

async function pairs(file: string): Promise<Map<string, Pair>> {
  const source = await readFile(join(repository, file), "utf8")
  const found = new Map<string, Pair>()
  for (const m of source.matchAll(PAIR)) {
    const n = m.slice(2).map(Number)
    found.set(m[1]!, {
      light: [n[0]!, n[1]!, n[2]!],
      dark: [n[3]!, n[4]!, n[5]!],
    })
  }
  return found
}

/** OKLCH to linear sRGB (Björn Ottosson's matrices), clamped to the gamut. */
function linear([l, c, h]: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

/** `#rrggbb` to linear sRGB. */
function linearHex(hex: string): [number, number, number] {
  return [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
}

type Colour = Oklch | string

function luminance(colour: Colour): number {
  const [r, g, b] =
    typeof colour === "string" ? linearHex(colour) : linear(colour)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Colour, b: Colour): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

const theme = await pairs("packages/ui/src/theme/semantic.ts")
const hues = await pairs("packages/docs-ui/src/accent.ts")

const need = (name: string, from: Map<string, Pair>) => {
  const pair = from.get(name)
  if (!pair) throw new Error(`No light-dark pair named ${name}`)
  return pair
}

const SURFACES = ["background", "card", "muted"] as const
const checks: { what: string; fg: Pair; bg: Pair; min: number }[] = []

for (const text of ["foreground", "mutedForeground"])
  for (const surface of SURFACES)
    checks.push({
      what: `${text} on ${surface}`,
      fg: need(text, theme),
      bg: need(surface, theme),
      min: 4.5,
    })
checks.push({
  what: "primaryForeground on primary",
  fg: need("primaryForeground", theme),
  bg: need("primary", theme),
  min: 4.5,
})
for (const [name, hue] of hues) {
  // The sun is a fill, never text.
  if (name === "sun") continue
  for (const surface of SURFACES)
    checks.push({
      what: `${name} on ${surface}`,
      fg: hue,
      bg: need(surface, theme),
      min: 4.5,
    })
  // `accent.on` is the background colour (accent.ts).
  checks.push({
    what: `on, drawn on ${name}`,
    fg: need("background", theme),
    bg: hue,
    min: 4.5,
  })
}

/** One palette object's colours in `editor-window.tsx`: `name: "oklch(l c h)"` or `"#rrggbb"`. */
async function palette(name: string): Promise<Map<string, Colour>> {
  const source = await readFile(
    join(repository, "apps/docs/src/components/site/editor-window.tsx"),
    "utf8"
  )
  const body = new RegExp(`const ${name} = \\{([^}]*)\\}`).exec(source)?.[1]
  if (!body) throw new Error(`No palette ${name} in editor-window.tsx`)
  const found = new Map<string, Colour>()
  for (const m of body.matchAll(
    /(\w+): "(?:oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)|(#[0-9a-f]{6}))"/g
  ))
    found.set(m[1]!, m[5] ?? [Number(m[2]), Number(m[3]), Number(m[4])])
  return found
}

const panes: { what: string; fg: Colour; bg: Colour }[] = []
for (const [name, texts, surfaces] of [
  ["EDITOR", ["text", "muted", "gutter"], ["background", "bar"]],
  ["CHROME", ["text", "muted"], ["background", "bar"]],
] as const) {
  const colours = await palette(name)
  const get = (key: string) => {
    const colour = colours.get(key)
    if (!colour) throw new Error(`No ${key} in ${name}`)
    return colour
  }
  for (const text of texts)
    for (const surface of surfaces)
      panes.push({
        what: `${name}.${text} on ${surface}`,
        fg: get(text),
        bg: get(surface),
      })
}

let failed = 0
for (const pane of panes) {
  const ratio = contrast(pane.fg, pane.bg)
  const ok = ratio >= 4.5
  if (!ok) failed++
  if (table || !ok)
    console.log(
      `${ok ? "  " : "✗ "}dark  ${pane.what.padEnd(34)} ${ratio.toFixed(2)}`
    )
}
for (const check of checks)
  for (const scheme of ["light", "dark"] as const) {
    const ratio = contrast(check.fg[scheme], check.bg[scheme])
    const ok = ratio >= check.min
    if (!ok) failed++
    if (table || !ok)
      console.log(
        `${ok ? "  " : "✗ "}${scheme.padEnd(5)} ${check.what.padEnd(34)} ${ratio.toFixed(2)}`
      )
  }

if (failed) {
  console.error(`\n${failed} pair(s) below WCAG AA.`)
  process.exit(1)
}
console.log(
  `Contrast: ${checks.length * 2 + panes.length} pairs at or above WCAG AA.`
)
