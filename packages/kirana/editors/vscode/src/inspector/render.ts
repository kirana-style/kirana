/**
 * The Style Inspector's content (KRN-DX-015): what `kirana/inspect` returns, drawn as HTML — the
 * conditions and switches to toggle, the box model, the layout, the colours in both modes, the
 * type, and every declaration with where it came from. Nothing here imports `vscode`; the view
 * (`view.ts`) posts this into its webview, whose script only forwards clicks.
 */

import { ICON_URI } from "../brand.ts"

export type Source = {
  label: string
  when: string | null
  uri: string
  line: number
  character: number
  place: string
}

export type Entry = {
  property: string
  value: string
  conditions: string[]
  target: string
  group: string
  tokens: { identity: string; light: string | null; dark: string | null }[]
  rank: number
  class: string
  rule: string
  source: Source | null
  pixels: string | null
}

export type Inspected = {
  uri: string
  label: string
  kind: string
  entries: Entry[]
  conditions: string[]
  switches: string[]
  effective: number[]
  summary: string
}

export const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const GROUPS: Record<string, string> = {
  layout: "Layout",
  box: "Box",
  size: "Size",
  colour: "Colour",
  type: "Type",
  border: "Border",
  effects: "Effects",
  motion: "Motion",
  other: "Other",
}

/** Breakpoints by the name a reader knows them by. */
const BREAKPOINTS: Record<string, string> = {
  "@media (width >= 40rem)": "sm",
  "@media (width >= 48rem)": "md",
  "@media (width >= 64rem)": "lg",
  "@media (width >= 80rem)": "xl",
  "@media (width >= 96rem)": "2xl",
}

export const conditionName = (condition: string) =>
  BREAKPOINTS[condition] ?? condition

/** The entries that hold now, by property: the value each box and swatch shows. */
function holding(inspected: Inspected): Map<string, Entry> {
  const out = new Map<string, Entry>()
  for (const index of inspected.effective) {
    const entry = inspected.entries[index]!
    if (entry.target === "") out.set(entry.property, entry)
  }
  return out
}

/** A value as a box label shows it: a variable token by its short name. */
function shown(entry: Entry): string {
  const token = entry.tokens[0]
  if (token && entry.value.startsWith("var("))
    return token.identity.split(".").slice(-2).join(".")
  const pair = /^light-dark\((.*),\s*([^,]*)\)$/.exec(entry.value)
  return pair ? `${pair[1]}/${pair[2]}` : entry.value
}

/** One side of a box property: its own longhand, its logical or axis longhand, or the shorthand. */
function side(now: Map<string, Entry>, box: string, name: string) {
  const axis = name === "top" || name === "bottom" ? "block" : "inline"
  const logical = {
    top: "block-start",
    bottom: "block-end",
    left: "inline-start",
    right: "inline-end",
  }[name]
  for (const property of [
    `${box}-${name}`,
    `${box}-${logical}`,
    `${box}-${axis}`,
    box,
  ]) {
    const found = now.get(property)
    if (found) return shown(found)
  }
  return undefined
}

/** Four sides as the shorthand writes them, or undefined when none is set. */
export function sides(now: Map<string, Entry>, box: string) {
  const [top, right, bottom, left] = ["top", "right", "bottom", "left"].map(
    (name) => side(now, box, name)
  )
  if ([top, right, bottom, left].every((value) => value === undefined))
    return undefined
  const [t, r, b, l] = [top, right, bottom, left].map((value) => value ?? "0")
  if (t === r && r === b && b === l) return t
  if (t === b && r === l) return `${t} ${r}`
  if (r === l) return `${t} ${r} ${b}`
  return `${t} ${r} ${b} ${l}`
}

/** Grid column tracks: `repeat(3, 1fr)` → three `1fr`; plain lists split at the top level. */
export function tracks(template: string): string[] {
  const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(template.trim())
  if (repeat)
    return Array(Math.min(Number(repeat[1]), 12)).fill(repeat[2]!.trim())
  const out: string[] = []
  let depth = 0
  let current = ""
  for (const character of template.trim()) {
    if (character === "(") depth += 1
    if (character === ")") depth -= 1
    if (character === " " && depth === 0) {
      if (current) out.push(current)
      current = ""
      continue
    }
    current += character
  }
  if (current) out.push(current)
  return out.slice(0, 12)
}

function toggles(inspected: Inspected, active: ReadonlySet<string>): string {
  const chip = (name: string, label: string, kind: string) =>
    `<button class="chip ${active.has(name) ? "on" : ""}" data-toggle="${escape(name)}" title="${escape(name)}"><span class="kind">${kind}</span>${escape(label)}</button>`
  const chips = [
    ...inspected.conditions.map((condition) =>
      chip(
        condition,
        conditionName(condition),
        condition.startsWith("@") ? "at" : "is"
      )
    ),
    ...inspected.switches.map((name) => chip(name, name, "if")),
  ]
  if (chips.length === 0) return ""
  return `<section class="toggles" aria-label="Conditions">${chips.join("")}</section>`
}

function boxModel(now: Map<string, Entry>): string {
  const margin = sides(now, "margin")
  const border = sides(now, "border-width")
  const padding = sides(now, "padding")
  const width = now.get("width") ?? now.get("inline-size")
  const height = now.get("height") ?? now.get("block-size")
  const radius = now.get("border-radius")
  const display = now.get("display")?.value ?? ""
  const content =
    width || height
      ? `${width ? shown(width) : "auto"} × ${height ? shown(height) : "auto"}`
      : "content"
  let inner = `<div class="content">${escape(content)}</div>`
  if (display.includes("grid")) {
    const columns = tracks(now.get("grid-template-columns")?.value ?? "")
    if (columns.length > 0)
      inner = `<div class="size">${escape(content)}</div><div class="grid" style="grid-template-columns: repeat(${columns.length}, 1fr)">${columns
        .map((track) => `<div class="cell">${escape(track)}</div>`)
        .join("")}</div>`
  } else if (display.includes("flex")) {
    const direction = now.get("flex-direction")?.value ?? "row"
    inner = `<div class="size">${escape(content)}</div><div class="flex" style="flex-direction: ${direction.startsWith("column") ? "column" : "row"}">${'<div class="cell"></div>'.repeat(3)}</div>`
  }
  const rounded = radius
    ? ` style="border-radius: min(${escape(radius.value)}, 18px)"`
    : ""
  return `<section class="box" aria-label="Box model">
<div class="margin"><span class="tag">margin ${escape(margin ?? "0")}</span>
<div class="border"${rounded}><span class="tag">border ${escape(border ?? "0")}</span>
<div class="padding"${rounded}><span class="tag">padding ${escape(padding ?? "0")}</span>
${inner}
</div></div></div></section>`
}

function layout(now: Map<string, Entry>): string {
  const display = now.get("display")
  if (!display) return ""
  const parts = [display.value]
  for (const [property, label] of [
    ["grid-template-columns", "cols"],
    ["flex-direction", "direction"],
    ["gap", "gap"],
    ["justify-content", "justify"],
    ["align-items", "items"],
  ] as const) {
    const entry = now.get(property)
    if (entry) parts.push(`${label} ${shown(entry)}`)
  }
  return `<p class="layout">${escape(parts.join(" · "))}</p>`
}

/** A swatch's colours: a token's two modes, a `light-dark()` pair, or the value. */
function colours(entry: Entry): [string, string] | undefined {
  const token = entry.tokens[0]
  if (token?.light) return [token.light, token.dark ?? token.light]
  const pair = /^light-dark\((.*),\s*([^,]*)\)$/.exec(entry.value)
  if (pair) return [pair[1]!, pair[2]!]
  if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color\(|[a-z]+$)/.test(entry.value))
    return [entry.value, entry.value]
  return undefined
}

function swatches(now: Map<string, Entry>, scheme: "light" | "dark"): string {
  const found = [...now.values()]
    .filter((entry) => entry.group === "colour")
    .map((entry) => [entry, colours(entry)] as const)
    .filter((pair): pair is [Entry, [string, string]] => pair[1] !== undefined)
  if (found.length === 0) return ""
  const items = found
    .map(([entry, [light, dark]]) => {
      const colour = scheme === "light" ? light : dark
      return `<li><span class="swatch" style="background: ${escape(colour)}"></span><span>${escape(entry.property)}</span><code>${escape(shown(entry))}</code></li>`
    })
    .join("")
  return `<section class="colours" aria-label="Colours"><div class="scheme"><button class="chip ${scheme === "light" ? "on" : ""}" data-scheme="light">light</button><button class="chip ${scheme === "dark" ? "on" : ""}" data-scheme="dark">dark</button></div><ul>${items}</ul></section>`
}

function type(now: Map<string, Entry>): string {
  const size = now.get("font-size")
  if (!size) return ""
  const weight = now.get("font-weight")?.value ?? "400"
  const leading = now.get("line-height")
  const note = [shown(size), leading && `/ ${shown(leading)}`, weight]
    .filter(Boolean)
    .join(" ")
  return `<section class="type" aria-label="Type"><span class="sample" style="font-size: clamp(10px, ${escape(size.value)}, 40px); font-weight: ${escape(weight)}">Aa</span><code>${escape(note)}</code></section>`
}

function declarations(inspected: Inspected): string {
  const effective = new Set(inspected.effective)
  const groups = new Map<string, string[]>()
  inspected.entries.forEach((entry, index) => {
    const state = effective.has(index) ? "holds" : "idle"
    const conditions = [
      entry.source?.when ? `if ${entry.source.when}` : "",
      ...entry.conditions.map(conditionName),
      entry.target,
    ].filter(Boolean)
    const source = entry.source
      ? `<a href="#" data-open="${escape(JSON.stringify([entry.source.uri, entry.source.line, entry.source.character]))}" title="${escape(entry.source.place)}">${escape(entry.source.label)}</a>`
      : ""
    const row = `<tr class="${state}"><td>${escape(entry.property)}</td><td><code>${escape(entry.value)}</code>${entry.pixels ? ` <small>${escape(entry.pixels)}</small>` : ""}</td><td>${conditions.map((condition) => `<span class="when">${escape(condition)}</span>`).join(" ")}</td><td>${source}</td></tr>`
    const list = groups.get(entry.group) ?? []
    list.push(row)
    groups.set(entry.group, list)
  })
  return Object.keys(GROUPS)
    .filter((group) => groups.has(group))
    .map(
      (group) =>
        `<section class="group"><h3>${GROUPS[group]}</h3><table>${groups.get(group)!.join("")}</table></section>`
    )
    .join("")
}

/** The inspector's body for one site. */
export function render(
  inspected: Inspected | null,
  active: ReadonlySet<string>,
  scheme: "light" | "dark"
): string {
  if (!inspected)
    return `<p class="empty">Place the cursor on a <code>css()</code>, a <code>recipe()</code> or an element's <code>sx</code>.</p>`
  const now = holding(inspected)
  return [
    `<header><img class="brand" src="${ICON_URI}" alt="Kirana"><span class="kind">${escape(inspected.kind)}</span><code>${escape(inspected.label)}</code></header>`,
    toggles(inspected, active),
    boxModel(now),
    layout(now),
    swatches(now, scheme),
    type(now),
    declarations(inspected),
  ]
    .filter(Boolean)
    .join("\n")
}

/** The webview's page: theme-aware styles and a script that forwards clicks to the extension. */
export function page(nonce: string, cspSource: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font: var(--vscode-font-size) var(--vscode-font-family); padding: 0 12px 16px; }
  code, .tag, small, .when { font-family: var(--vscode-editor-font-family); }
  header .brand { width: 16px; height: 16px; flex: none; align-self: center; }
  header { display: flex; gap: 8px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid var(--vscode-panel-border); }
  header code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .8; }
  .kind { font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .toggles, .scheme { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .chip { display: inline-flex; gap: 4px; align-items: center; font: inherit; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--vscode-button-border, var(--vscode-panel-border)); color: var(--vscode-foreground); background: transparent; cursor: pointer; }
  .chip.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: transparent; }
  .chip .kind { background: transparent; color: inherit; opacity: .7; padding: 0; }
  .box { margin: 12px 0; font-size: 11px; }
  .box .tag { display: block; margin-bottom: 4px; opacity: .85; }
  .margin { padding: 6px; border: 1px dashed #f97316; background: #f9731620; border-radius: 4px; }
  .border { padding: 6px; border: 1px solid #ca8a04; background: #eab30824; }
  .padding { padding: 6px; border: 1px solid #16a34a; background: #22c55e24; }
  .content, .cell { padding: 8px; text-align: center; border: 1px solid #3b82f6; background: #3b82f62e; border-radius: 2px; min-height: 12px; }
  .grid { display: grid; gap: 4px; }
  .size { text-align: center; margin-bottom: 4px; font-family: var(--vscode-editor-font-family); }
  .flex { display: flex; gap: 4px; } .flex .cell { flex: 1; }
  .layout { margin: 6px 0; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  .colours ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
  .colours li { display: grid; grid-template-columns: 22px auto 1fr; gap: 8px; align-items: center; font-size: 12px; }
  .swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); }
  .colours code { text-align: end; opacity: .8; }
  .type { display: flex; align-items: baseline; gap: 10px; margin: 12px 0; }
  .group h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; margin: 14px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 3px 4px; border-top: 1px solid var(--vscode-panel-border); vertical-align: top; }
  td:first-child { opacity: .85; white-space: nowrap; }
  tr.idle { opacity: .45; }
  .when { font-size: 11px; padding: 0 4px; border-radius: 3px; background: var(--vscode-textCodeBlock-background); white-space: nowrap; }
  a { color: var(--vscode-textLink-foreground); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .empty { opacity: .7; padding: 16px 0; }
</style>
</head>
<body>
<main id="root"><p class="empty">Waiting for the Kirana language server…</p></main>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const root = document.getElementById("root");
  window.addEventListener("message", (event) => {
    if (event.data.type === "render") root.innerHTML = event.data.html;
  });
  root.addEventListener("click", (event) => {
    const target = event.target.closest("[data-toggle],[data-open],[data-scheme]");
    if (!target) return;
    event.preventDefault();
    if (target.dataset.toggle !== undefined) vscode.postMessage({ type: "toggle", name: target.dataset.toggle });
    else if (target.dataset.scheme !== undefined) vscode.postMessage({ type: "scheme", scheme: target.dataset.scheme });
    else vscode.postMessage({ type: "open", location: JSON.parse(target.dataset.open) });
  });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`
}
