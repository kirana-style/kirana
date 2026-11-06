/**
 * Icons written as inline SVG at install (KRN-DX-033), where a framework has no maintained package
 * for the project's icon library: each icon read from the library's own published data at the
 * version this release pins, over jsDelivr, and drawn as the library's package would draw it (its
 * root `<svg>`'s attributes and its shapes). A file that gets one carries the library's notice.
 */
import { DEFAULT_TIMEOUT, RegistryError } from "./read.ts"
import type { Io } from "./read.ts"
import type { IconLibrary } from "./types.ts"

/** An icon to draw inline: its root `<svg>`'s attributes, in order, and its children as markup. */
export type InlineIcon = { attributes: [string, string][]; inner: string }

const CDN = "https://cdn.jsdelivr.net/npm/"

/** Each library's data, at the version this release draws it from. */
export const ICON_DATA: Record<IconLibrary, string> = {
  lucide: "lucide-static@1.69.0",
  tabler: "@tabler/icons@3.50.0",
  hugeicons: "@hugeicons/core-free-icons@4.4.0",
  phosphor: "@phosphor-icons/core@2.1.1",
  remixicon: "remixicon@4.9.1",
}

/** The notice an inlined copy keeps, per library: its name, home, licence and copyright. */
export const ICON_NOTICES: Record<IconLibrary, string> = {
  lucide:
    "Lucide, https://lucide.dev, ISC License, Copyright (c) 2026 Lucide Icons and Contributors",
  tabler:
    "Tabler Icons, https://tabler.io/icons, MIT License, Copyright (c) 2020-2026 Paweł Kuna",
  hugeicons:
    "Hugeicons, https://hugeicons.com, MIT License, Copyright (c) 2025 Hugeicons",
  phosphor:
    "Phosphor Icons, https://phosphoricons.com, MIT License, Copyright (c) 2023 Phosphor Icons",
  remixicon:
    "Remix Icon, https://remixicon.com, Remix Icon License v1.0 (https://github.com/Remix-Design/remixicon/blob/master/License), Copyright (c) RemixIcon.com",
}

/** `RotateClockwise2` → `rotate-clockwise-2`, as the libraries name their files. */
export const kebab = (name: string) =>
  name
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([0-9])([A-Za-z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()

/** Names Phosphor's packages keep for icons Phosphor 2 renamed. */
const PHOSPHOR_ALIASES: Record<string, string> = {
  Activity: "Pulse",
  FileSearch: "FileMagnifyingGlass",
}

/** The attributes in a tag's text (`name="value"`), in order. */
function attributesOf(text: string): [string, string][] {
  return [...text.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map(
    ([, name, value]) => [name!, value!]
  )
}

/** An SVG document as an inline icon: its root's attributes but `class`, and its children. */
export function parseSvg(svg: string): InlineIcon {
  const open = /<svg\b([^>]*)>/.exec(svg)
  if (!open) throw new RegistryError("an icon's data is not an <svg>")
  const close = svg.lastIndexOf("</svg>")
  return {
    attributes: attributesOf(open[1]!).filter(([name]) => name !== "class"),
    inner: svg
      .slice(open.index + open[0].length, close)
      .replace(/\s*\n\s*/g, "")
      .trim(),
  }
}

/**
 * A Hugeicons data module (`[["path", { d: "…", strokeWidth: "1.5", key: "0" }], …]`) as an inline
 * icon, drawn as its packages draw it with `strokeWidth={2}`.
 */
export function parseHugeicon(module: string): InlineIcon {
  const shapes = [...module.matchAll(/\[\s*"([a-z]+)",\s*\{([^}]*)\}\s*\]/g)]
  if (shapes.length === 0)
    throw new RegistryError("an icon's data holds no shapes")
  const inner = shapes
    .map(([, tag, body]) => {
      const attributes = [...body!.matchAll(/(\w+):\s*"([^"]*)"/g)]
        .filter(([, name]) => name !== "key")
        .map(([, name, value]) => {
          const attribute = kebab(name!)
          return `${attribute}="${attribute === "stroke-width" ? "2" : value}"`
        })
      return `<${tag} ${attributes.join(" ")} />`
    })
    .join("")
  return {
    attributes: [
      ["xmlns", "http://www.w3.org/2000/svg"],
      ["width", "24"],
      ["height", "24"],
      ["viewBox", "0 0 24 24"],
      ["fill", "none"],
    ],
    inner,
  }
}

/** Remix Icon's sprite's symbol for `name` (`RiCloseLine`), as an inline icon, or none. */
export function remixSymbol(
  sprite: string,
  name: string
): InlineIcon | undefined {
  const id = `ri-${kebab(name.replace(/^Ri/, ""))}`
  const symbol = new RegExp(
    `<symbol\\b([^>]*\\bid="${id}"[^>]*)>([\\s\\S]*?)</symbol>`
  ).exec(sprite)
  if (!symbol) return undefined
  const viewBox =
    attributesOf(symbol[1]!).find(
      ([attribute]) => attribute === "viewBox"
    )?.[1] ?? "0 0 24 24"
  return {
    attributes: [
      ["xmlns", "http://www.w3.org/2000/svg"],
      ["width", "24"],
      ["height", "24"],
      ["viewBox", viewBox],
      ["fill", "currentColor"],
    ],
    inner: symbol[2]!.trim(),
  }
}

/** Where a library's icon `name` is, as its package names it (`ChevronDownIcon`, `IconX`, …). */
export function dataUrl(
  library: Exclude<IconLibrary, "remixicon">,
  name: string
): string {
  const root = `${CDN}${ICON_DATA[library]}`
  switch (library) {
    case "lucide":
      return `${root}/icons/${kebab(name.replace(/Icon$/, ""))}.svg`
    case "tabler": {
      const bare = name.replace(/^Icon/, "")
      const filled = bare.endsWith("Filled")
      return `${root}/icons/${filled ? "filled" : "outline"}/${kebab(filled ? bare.slice(0, -"Filled".length) : bare)}.svg`
    }
    case "hugeicons":
      return `${root}/dist/esm/${name}.js`
    case "phosphor": {
      const bare = name.replace(/Icon$/, "")
      return `${root}/assets/regular/${kebab(PHOSPHOR_ALIASES[bare] ?? bare)}.svg`
    }
  }
}

/** A text over the network, or why it could not be read; `undefined` when it is not there (404). */
async function text(url: string, io: Io): Promise<string>
async function text(
  url: string,
  io: Io,
  missing: "optional"
): Promise<string | undefined>
async function text(url: string, io: Io, missing?: "optional") {
  let response: Response
  try {
    response = await (io.fetch ?? fetch)(url, {
      signal: AbortSignal.timeout(io.timeout ?? DEFAULT_TIMEOUT),
    })
  } catch (error) {
    throw new RegistryError(
      `${url}: could not be fetched: ${(error as Error).message}`
    )
  }
  if (response.status === 404 && missing === "optional") return undefined
  if (!response.ok)
    throw new RegistryError(`${url}: answered ${response.status}`)
  return response.text()
}

/**
 * Hugeicons' other names for its icons (`SearchIcon` for `Search01Icon`), from its package's index,
 * which re-exports each icon's module under every name.
 */
export function hugeiconAliases(index: string): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const [, names, module] of index.matchAll(
    /export \{([^}]*)\} from '\.\/([A-Za-z0-9]+)\.js'/g
  ))
    for (const [, name] of names!.matchAll(/default as (\w+)/g))
      aliases.set(name!, module!)
  return aliases
}

/** The icons `names` of `library`, each read from its data; one that is not there stops it. */
export async function fetchInlineIcons(
  library: IconLibrary,
  names: readonly string[],
  io: Io = {}
): Promise<Map<string, InlineIcon>> {
  const icons = new Map<string, InlineIcon>()
  if (names.length === 0) return icons
  if (library === "remixicon") {
    const sprite = await text(
      `${CDN}${ICON_DATA.remixicon}/fonts/remixicon.symbol.svg`,
      io
    )
    for (const name of names) {
      const icon = remixSymbol(sprite, name)
      if (!icon)
        throw new RegistryError(
          `Remix Icon ${ICON_DATA.remixicon} has no icon ${name}`
        )
      icons.set(name, icon)
    }
    return icons
  }
  // Hugeicons' index, read once and only for a name that is not a module of its own.
  let aliases: Promise<Map<string, string>> | undefined
  const hugeicon = async (name: string) => {
    const own = await text(dataUrl("hugeicons", name), io, "optional")
    if (own !== undefined) return own
    aliases ??= text(`${CDN}${ICON_DATA.hugeicons}/dist/esm/index.js`, io).then(
      hugeiconAliases
    )
    const module = (await aliases).get(name)
    if (module === undefined)
      throw new RegistryError(
        `Hugeicons ${ICON_DATA.hugeicons} has no icon ${name}`
      )
    return text(dataUrl("hugeicons", module), io)
  }
  await Promise.all(
    names.map(async (name) => {
      const data =
        library === "hugeicons"
          ? await hugeicon(name)
          : await text(dataUrl(library, name), io)
      const icon =
        library === "hugeicons" ? parseHugeicon(data) : parseSvg(data)
      // Phosphor's files leave the size to the page; its packages draw `1em`.
      if (library === "phosphor")
        icon.attributes.splice(1, 0, ["width", "1em"], ["height", "1em"])
      icons.set(name, icon)
    })
  )
  return icons
}
