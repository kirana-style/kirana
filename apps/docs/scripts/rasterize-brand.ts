/**
 * Renders the PNG and ICO files browsers and phones still ask for, from the
 * SVGs `generate-brand.ts` writes. Needs Google Chrome (`google-chrome` on the
 * PATH, or `CHROME=/path/to/chrome`); run it after changing the logo:
 *
 *   bun scripts/generate-brand.ts && bun scripts/rasterize-brand.ts
 */
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const chrome = process.env.CHROME ?? "google-chrome"
const work = await mkdtemp(join(tmpdir(), "kirana-brand-"))

/** A square PNG of an SVG, transparent outside the drawing. */
async function render(svgPath: string, size: number): Promise<Uint8Array> {
  const svg = await readFile(join(root, svgPath), "utf8")
  const page = join(work, "page.html")
  const out = join(work, `${size}.png`)
  await writeFile(
    page,
    `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}">`
  )
  const run = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    `--window-size=${size},${size}`,
    `--screenshot=${out}`,
    `file://${page}`,
  ])
  if (run.status !== 0) throw new Error(String(run.stderr))
  return new Uint8Array(await readFile(out))
}

/** An ICO holding PNG images, which every current browser reads. */
function ico(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const header = 6 + 16 * images.length
  const total =
    header + images.reduce((sum, image) => sum + image.png.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, images.length, true)
  let offset = header
  images.forEach((image, index) => {
    const entry = 6 + 16 * index
    view.setUint8(entry, image.size % 256)
    view.setUint8(entry + 1, image.size % 256)
    view.setUint16(entry + 4, 1, true) // colour planes
    view.setUint16(entry + 6, 32, true) // bits per pixel
    view.setUint32(entry + 8, image.png.length, true)
    view.setUint32(entry + 12, offset, true)
    out.set(image.png, offset)
    offset += image.png.length
  })
  return out
}

try {
  const icon = "public/favicon.svg"
  const icoSizes = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, png: await render(icon, size) }))
  )
  await writeFile(join(root, "public/favicon.ico"), ico(icoSizes))
  // Phones, app launchers and the Marketplace want a tile: the mark on ink.
  const tile = "public/brand/kirana-icon-ink.svg"
  await writeFile(
    join(root, "public/apple-touch-icon.png"),
    await render(tile, 180)
  )
  await writeFile(join(root, "public/icon-192.png"), await render(tile, 192))
  await writeFile(join(root, "public/icon-512.png"), await render(tile, 512))
  // The editor extension's icon (Marketplace and the Extensions view ask for 128 px).
  await writeFile(
    join(root, "../../packages/kirana/editors/brand/icon.png"),
    await render(tile, 128)
  )
  console.log(
    "brand: favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, editors/brand/icon.png written"
  )
} finally {
  await rm(work, { recursive: true, force: true })
}
