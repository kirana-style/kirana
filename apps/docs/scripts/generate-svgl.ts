/**
 * Brand logos, kept in the repository: from SVGL (svgl.app) first, from LogoForge
 * (logoforge.terravidhal.me) for a brand SVGL has no logo for, and from the brand's own website
 * (`OFFICIAL`) for one neither has. A brand with none of them shows a monogram.
 *
 *   bun scripts/generate-svgl.ts           # fetch, save the files, write the map
 *   bun scripts/generate-svgl.ts --check   # offline: the map matches the manifest, every file exists
 *
 * Logos are downloaded once into `packages/docs-ui/src/brands/` and committed, so the site never
 * hotlinks either source: dev, build and CI work offline, and each logo is a fingerprinted asset
 * Vite serves with the site. `manifest.json` records what was fetched and from where; the generated
 * map (`src/generated/svgl-icons.gen.ts`) imports each file with `?url`.
 *
 * LogoForge's artwork comes from Simple Icons and gilbarbara/logos, both CC0; the logos remain
 * their owners' trademarks, as SVGL's do.
 *
 * A logo with light and dark variants keeps both: `BrandIcon` shows the one for the site's theme.
 */
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"

const app = new URL("..", import.meta.url).pathname
const brands = join(app, "../../packages/docs-ui/src/brands")
const manifestFile = join(brands, "manifest.json")
const target = join(app, "src/generated/svgl-icons.gen.ts")
const check = process.argv.includes("--check")

/** Slug (the key callers use, `SVGL.react`) → the SVGL title to fetch. */
const NEEDED: Record<string, string> = {
  npm: "NPM",
  pnpm: "Pnpm",
  yarn: "Yarn",
  bun: "Bun",
  deno: "Deno",
  nodejs: "Node.js",
  react: "React",
  nextjs: "Next.js",
  preact: "Preact",
  solidjs: "Solidjs",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  sveltekit: "Svelte", // SvelteKit uses the Svelte icon
  astro: "Astro",
  qwik: "Qwik",
  angular: "Angular",
  reactrouter: "React Router",
  gatsby: "Gatsby",
  ember: "Ember",
  laravel: "Laravel",
  tanstack: "TanStack",
  docusaurus: "Docusaurus",
  storybook: "Storybook",
  remix: "Remix",
  vite: "Vite",
  rolldown: "Rolldown",
  rspack: "Rspack",
  rsbuild: "Rsbuild",
  parcel: "Parcel",
  postcss: "PostCSS",
  esbuild: "Esbuild",
  jest: "Jest",
  vitest: "Vitest",
  javascript: "JavaScript",
  typescript: "TypeScript",
  tailwindcss: "Tailwind CSS",
  pandacss: "PandaCSS",
  eslint: "ESLint",
  oxc: "Oxc",
  biome: "Biomejs",
  vscode: "Visual Studio Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  antigravity: "Google Antigravity",
  zed: "Zed",
  neovim: "Neovim",
  webstorm: "JetBrains WebStorm",
  github: "GitHub",
  x: "X (formerly Twitter)",
  claude: "Claude AI",
  openai: "OpenAI",
}

/**
 * Slug → the LogoForge logo and its variants, for brands SVGL lacks. `dark` names the variant drawn
 * for dark backgrounds, where the light one would disappear.
 */
const LOGOFORGE: Record<
  string,
  { logo: string; light: string; dark?: string; url?: string }
> = {
  meteor: { logo: "meteor", light: "icon" },
  symfony: { logo: "symfony", light: "icon", dark: "icon-dark" },
  // The glyph; `rails` is the wide wordmark. LogoForge lists no website for this entry.
  rails: {
    logo: "ruby-on-rails",
    light: "icon",
    url: "https://rubyonrails.org/",
  },
  phoenix: { logo: "phoenix", light: "icon" },
  // LogoForge lists no website for this entry.
  vitepress: {
    logo: "vitepress",
    light: "icon",
    url: "https://vitepress.dev/",
  },
  adonisjs: { logo: "adonisjs", light: "icon" },
  webpack: { logo: "webpack", light: "icon" },
  stylex: { logo: "stylex", light: "icon" },
  helix: {
    logo: "helix",
    light: "icon",
    dark: "icon-dark",
    url: "https://helix-editor.com/",
  },
}

/**
 * A brand's own logo files, from its website, for a brand neither SVGL nor LogoForge has. Each file
 * is checked to hold no script before it is saved.
 */
const OFFICIAL: Record<
  string,
  { title: string; url: string; light: string; dark: string; category: string }
> = {
  vike: {
    title: "Vike",
    url: "https://vike.dev/",
    light: "https://vike.dev/assets/static/vike.DekpsbvE.svg",
    dark: "https://vike.dev/assets/static/vike-dark.BNfTJN3o.svg",
    category: "Framework",
  },
}

type Route = string | { light: string; dark: string }
type Entry = {
  title: string
  category: string | string[]
  url: string
  route: Route
  /** Where the files came from; SVGL when absent. */
  source?: "logoforge" | "official"
}

function fail(message: string): never {
  throw new Error(message)
}

const LOGOFORGE_SITE = "https://logoforge.terravidhal.me"

async function fetchLogoForge(
  slug: string,
  { logo, light, dark, url }: (typeof LOGOFORGE)[string]
): Promise<Entry> {
  const response = await fetch(`${LOGOFORGE_SITE}/api/logos/${logo}.json`)
  if (!response.ok) throw new Error(`logoforge: no logo "${logo}"`)
  const found = (await response.json()) as {
    name: string
    url: string | null
    categories: string[]
    svg: Record<string, string>
  }
  const file = async (variant: string) => {
    const svg = found.svg[variant]
    if (!svg) throw new Error(`logoforge: "${logo}" has no ${variant} variant`)
    return save(svg, `logoforge-${slug}-${variant}.svg`)
  }
  return {
    title: found.name,
    category: found.categories,
    url:
      url ??
      found.url ??
      fail(`logoforge: "${logo}" has no website; give one in LOGOFORGE`),
    route: dark
      ? { light: await file(light), dark: await file(dark) }
      : await file(light),
    source: "logoforge",
  }
}

async function fetchEntry(title: string): Promise<Entry> {
  const response = await fetch(
    `https://api.svgl.app?search=${encodeURIComponent(title)}`
  )
  const found = (
    (await response.json()) as Array<Entry & { title: string }>
  ).find((icon) => icon.title === title)
  if (!found) throw new Error(`svgl: no icon titled "${title}"`)
  return {
    title: found.title,
    category: found.category,
    url: found.url,
    route: found.route,
  }
}

/** Saves a remote SVG next to the others; returns its file name. */
async function save(url: string, as?: string): Promise<string> {
  const name = as ?? basename(new URL(url).pathname)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`logos: ${url} answered ${response.status}`)
  const svg = await response.text()
  // A logo is drawn, never run: refuse a file that could carry code into the site.
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(svg))
    throw new Error(`logos: ${url} holds a script or an event handler`)
  await writeFile(join(brands, name), svg)
  return name
}

let manifest: Record<string, Entry>
if (check) {
  manifest = JSON.parse(await readFile(manifestFile, "utf8"))
} else {
  await mkdir(brands, { recursive: true })
  manifest = {}
  for (const [slug, title] of Object.entries(NEEDED)) {
    const entry = await fetchEntry(title)
    entry.route =
      typeof entry.route === "string"
        ? await save(entry.route)
        : {
            light: await save(entry.route.light),
            dark: await save(entry.route.dark),
          }
    manifest[slug] = entry
    console.log(`svgl: ${slug} ← ${title}`)
  }
  for (const [slug, logo] of Object.entries(LOGOFORGE)) {
    if (slug in manifest)
      throw new Error(`${slug} is in SVGL already: drop it from LOGOFORGE`)
    manifest[slug] = await fetchLogoForge(slug, logo)
    console.log(`logoforge: ${slug} ← ${logo.logo}`)
  }
  for (const [slug, logo] of Object.entries(OFFICIAL)) {
    if (slug in manifest)
      throw new Error(`${slug} has a logo already: drop it from OFFICIAL`)
    manifest[slug] = {
      title: logo.title,
      category: logo.category,
      url: logo.url,
      route: {
        light: await save(logo.light, `official-${slug}-light.svg`),
        dark: await save(logo.dark, `official-${slug}-dark.svg`),
      },
      source: "official",
    }
    console.log(`official: ${slug} ← ${logo.url}`)
  }
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
}

const files = new Set<string>()
for (const entry of Object.values(manifest)) {
  for (const file of typeof entry.route === "string"
    ? [entry.route]
    : [entry.route.light, entry.route.dark])
    files.add(file)
}
const identifier = (file: string) =>
  `logo_${file.replace(/\.svg$/, "").replace(/[^A-Za-z0-9]/g, "_")}`
const route = (value: Route) =>
  typeof value === "string"
    ? identifier(value)
    : `{ light: ${identifier(value.light)}, dark: ${identifier(value.dark)} }`

const output = [
  "/**",
  " * AUTO-GENERATED by scripts/generate-svgl.ts from packages/docs-ui/src/brands/manifest.json.",
  " * Run `bun run generate:svgl` to refresh the logos from svgl.app and LogoForge.",
  " */",
  'import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"',
  ...[...files]
    .sort()
    .map(
      (file) =>
        `import ${identifier(file)} from "@workspace/docs-ui/brands/${file}?url"`
    ),
  "",
  "export const SVGL = {",
  ...Object.entries(manifest).map(
    ([slug, entry]) =>
      `  ${slug}: { title: ${JSON.stringify(entry.title)}, url: ${JSON.stringify(entry.url)}, route: ${route(entry.route)} },`
  ),
  "} satisfies Record<string, SvglIcon>",
  "",
].join("\n")

if (check) {
  const missing = [...files].filter((file) => !existsSync(join(brands, file)))
  const current = await readFile(target, "utf8").catch(() => "")
  if (missing.length > 0 || current !== output) {
    console.error(
      missing.length > 0
        ? `svgl: missing logo files: ${missing.join(", ")}`
        : "svgl: the generated map is out of date, run `bun run generate:svgl`"
    )
    process.exit(1)
  }
  console.log(`logos: ${Object.keys(manifest).length} logos up to date`)
} else {
  await writeFile(target, output)
  console.log(
    `logos: ${Object.keys(manifest).length} logos, ${files.size} files`
  )
}
