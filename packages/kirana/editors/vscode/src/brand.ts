/**
 * The editors' brand (`editors/brand/`), the same two files the language server compiles in: the
 * icon, generated from the logo (`brand.json`), and the colour of each group of properties
 * (`palette.json`). Nothing here imports `vscode`.
 */
import brand from "../../brand/brand.json" with { type: "json" }
import palette from "../../brand/palette.json" with { type: "json" }

/** The icon as an SVG file. */
export const ICON_SVG: string = brand.icon

/** The icon as a `data:` URI, for decorations and webviews. */
export const ICON_URI = `data:image/svg+xml;base64,${Buffer.from(brand.icon).toString("base64")}`

/** Each group's colour (`layout`, `box` …) as a CSS value. */
export const GROUP_COLOURS: Record<string, string> = palette.groups

/** Text that belongs to no group in a hint: the hint's own colour. */
export const HINT_QUIET = "var(--vscode-editorInlayHint-foreground)"
