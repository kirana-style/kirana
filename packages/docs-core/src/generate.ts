/**
 * The content engine: parses a docs tree once and writes everything derived
 * from it —
 *
 *   <generatedDir>/pages/**.json   the parsed document per page, loaded lazily
 *   <generatedDir>/content.gen.ts  the manifest: pages, nav, order, search records
 *   <generatedDir>/highlight.css   the code colours, light and dark
 *   <publicDir>/llms.txt, llms-full.txt, docs/*.md   the same docs for language models
 *
 * `check: true` rebuilds into memory and fails when a committed file is stale,
 * which is what CI runs.
 *
 * Markdown is not compiled by Kirana (its Vite plugin only transforms script
 * files), so a page that writes `sx=` would be silently unstyled: the lint below
 * fails the build instead.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { parseMarkdown } from "@tanstack/markdown/parser"
import type { MarkdownDocument } from "@tanstack/markdown"

import { parseFrontmatter } from "./frontmatter.ts"
import { highlightCss } from "./highlight-css.ts"
import { extensions } from "./markdown.ts"
import { PACKAGE_MANAGERS, installLines } from "./package-managers.ts"
import type {
  BlogMeta,
  NavItem,
  NavNode,
  PageHeading,
  PageMeta,
  SearchRecord,
} from "./types.ts"

export type DocsConfig = {
  /** The app's root: every path in the output is relative to it. */
  root: string
  /** Holds `docs/` (with `sections.json`) and optionally `blog/`. Default `<root>/content`. */
  contentDir?: string
  /** Where the manifest, page documents and highlight CSS go. Default `<root>/src/generated`. */
  generatedDir?: string
  /** Where `llms.txt` and the markdown twins go. Default `<root>/public`. */
  publicDir?: string
  /** The module the generated manifest imports its types from. */
  typesImport: string
  /** Named in the manifest's `@generated` line. */
  generatedBy: string
  /** The command that regenerates, named when `check` finds stale files. */
  regenerateCommand: string
  site: {
    /** Canonical origin, e.g. `https://kirana.style`. */
    url: string
    /** The `llms.txt` preamble: its `# title` line and the lines under it. */
    llms: readonly string[]
    /** The `# title` of `llms-full.txt`. */
    fullTitle: string
  }
  /** Verify instead of write. */
  check?: boolean
  /**
   * Plain markdown for the app's comment components, in the twins language
   * models read: `<!-- ::name … -->` becomes what the function returns. The
   * built-in `install` already has one.
   */
  plain?: Record<string, (attributes: Record<string, string>) => string>
  /**
   * Values prose may name as `{{fact:name}}` — a count, a list — so a page states what the source of
   * truth says instead of a copy of it. An unknown name fails the build.
   */
  facts?: Readonly<Record<string, string>>
}

export async function generate(config: DocsConfig): Promise<void> {
  const root = config.root
  const contentDir = config.contentDir ?? join(root, "content")
  const generatedDir = config.generatedDir ?? join(root, "src/generated")
  const publicDir = config.publicDir ?? join(root, "public")
  const check = config.check ?? false

  type Group = { slug: string; label: string }
  type Section = { slug: string; label: string; groups?: Group[] }
  type Built = {
    meta: PageMeta
    document: MarkdownDocument
    records: SearchRecord[]
    source: string
  }

  const files = new Map<string, string>()

  /** Every `.md` file under `content/docs`, sorted so output never depends on the file system. */
  async function markdownFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(entry.parentPath, entry.name))
      .sort()
  }

  function href(file: string): string {
    const path = relative(join(contentDir, "docs"), file).replace(/\.md$/, "")
    return path === "index" ? "/docs" : `/docs/${path.replace(/\/index$/, "")}`
  }

  function text(node: unknown): string {
    if (!node || typeof node !== "object") return ""
    const value = node as {
      type?: string
      value?: string
      children?: unknown[]
      items?: unknown[]
    }
    if (value.type === "component" && "properties" in (node as object)) {
      // Code blocks keep their source out of the prose text.
      return ""
    }
    if (typeof value.value === "string") return value.value
    const children = [...(value.children ?? []), ...(value.items ?? [])]
    return children.map(text).join(" ")
  }

  /** One search record per heading section, so a hit can link to the right anchor. */
  function records(meta: PageMeta, document: MarkdownDocument): SearchRecord[] {
    const out: SearchRecord[] = []
    let heading: PageHeading | undefined
    let buffer: string[] = []

    const flush = () => {
      const body = buffer.join(" ").replace(/\s+/g, " ").trim()
      if (!body && heading) return
      out.push({
        id: `${meta.href}${heading ? `#${heading.id}` : ""}`,
        href: `${meta.href}${heading ? `#${heading.id}` : ""}`,
        page: meta.title,
        section: meta.section,
        ...(heading ? { heading: heading.text } : {}),
        text: `${heading ? "" : `${meta.description} `}${body}`.slice(0, 1200),
      })
      buffer = []
    }

    for (const node of document.children) {
      if (node.type === "heading" && node.depth <= 3) {
        flush()
        heading = {
          id: node.id ?? "",
          text: text(node).trim(),
          level: node.depth,
        }
        continue
      }
      buffer.push(text(node))
    }
    flush()
    return out
  }

  type Post = { meta: BlogMeta; document: MarkdownDocument }

  /** Posts under `content/blog`, newest first. */
  async function buildPosts(): Promise<Post[]> {
    const dir = join(contentDir, "blog")
    const posts: Post[] = []

    for (const file of await markdownFiles(dir).catch(() => [])) {
      const where = relative(root, file)
      const source = withFacts(
        stripNotes(await readFile(file, "utf8")),
        config.facts ?? {},
        where
      )
      const document = parseMarkdown(source, { extensions })
      const front = parseFrontmatter(document.frontmatter ?? "", where)
      for (const key of ["title", "summary", "date", "author"] as const) {
        if (typeof front[key] !== "string") {
          throw new Error(`${where}: blog frontmatter needs a ${key}`)
        }
      }
      const words = source.split(/\s+/).length
      posts.push({
        meta: {
          href: `/blog/${relative(dir, file).replace(/\.md$/, "")}`,
          file: where,
          title: String(front.title),
          summary: String(front.summary),
          date: String(front.date),
          author: String(front.author),
          tags: Array.isArray(front.tags) ? front.tags : [],
          ...(typeof front.cover === "string"
            ? {
                cover: front.cover,
                coverAlt:
                  typeof front.coverAlt === "string" ? front.coverAlt : "",
              }
            : {}),
          readingMinutes: Math.max(1, Math.round(words / 220)),
          headings: (document.headings ?? [])
            .filter((heading) => heading.level === 2)
            .map((heading) => ({
              id: heading.id,
              text: heading.text,
              level: heading.level,
            })),
        },
        document,
      })
    }
    return posts.sort((a, b) => b.meta.date.localeCompare(a.meta.date))
  }

  async function build(): Promise<{ sections: Section[]; pages: Built[] }> {
    const sections = JSON.parse(
      await readFile(join(contentDir, "docs/sections.json"), "utf8")
    ) as Section[]

    const pages: Built[] = []
    for (const file of await markdownFiles(join(contentDir, "docs"))) {
      const where = relative(root, file)
      const source = withFacts(
        stripNotes(await readFile(file, "utf8")),
        config.facts ?? {},
        where
      )
      // Samples may show `sx=`; prose may not, because nothing would compile it.
      const prose = source
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]*`/g, "")
      if (/<[a-zA-Z][^>]*\ssx=/.test(prose)) {
        throw new Error(
          `${where}: markdown is not compiled by Kirana, so \`sx=\` would be ignored. ` +
            `Use a component from the markdown map instead.`
        )
      }
      const document = parseMarkdown(source, { extensions })
      const front = parseFrontmatter(document.frontmatter ?? "", where)
      for (const key of ["title", "description", "section"] as const) {
        if (typeof front[key] !== "string")
          throw new Error(`${where}: frontmatter needs a ${key}`)
      }
      const section = String(front.section)
      const known = sections.find((entry) => entry.slug === section)
      if (!known) {
        throw new Error(
          `${where}: unknown section ${JSON.stringify(section)}; add it to sections.json`
        )
      }
      const parent =
        front.parent === undefined ? undefined : String(front.parent)
      if (parent && !known.groups?.some((group) => group.slug === parent)) {
        throw new Error(
          `${where}: unknown parent ${JSON.stringify(parent)} for section ` +
            `${JSON.stringify(section)}; add it to that section's groups in sections.json`
        )
      }
      const meta: PageMeta = {
        href: href(file),
        file: relative(root, file),
        title: String(front.title),
        description: String(front.description),
        section,
        ...(parent ? { parent } : {}),
        order: typeof front.order === "number" ? front.order : 100,
        ...(front.status ? { status: front.status as PageMeta["status"] } : {}),
        ...(Array.isArray(front.keywords) ? { keywords: front.keywords } : {}),
        ...(typeof front.kind === "string" ? { kind: front.kind } : {}),
        headings: (document.headings ?? [])
          .filter((heading) => heading.level >= 2 && heading.level <= 3)
          .map((heading) => ({
            id: heading.id,
            text: heading.text,
            level: heading.level,
          })),
      }
      pages.push({ meta, document, records: records(meta, document), source })
    }

    // A sub-group sits where its first page sits, and its pages stay together, so
    // the pager walks the sidebar from top to bottom.
    const branchOrder = new Map<string, number>()
    for (const page of pages) {
      const key = `${page.meta.section}/${page.meta.parent}`
      if (!page.meta.parent) continue
      branchOrder.set(
        key,
        Math.min(branchOrder.get(key) ?? Infinity, page.meta.order)
      )
    }
    const rank = (meta: PageMeta) =>
      branchOrder.get(`${meta.section}/${meta.parent}`) ?? meta.order

    pages.sort((a, b) => {
      const bySection =
        sections.findIndex((s) => s.slug === a.meta.section) -
        sections.findIndex((s) => s.slug === b.meta.section)
      return (
        bySection ||
        rank(a.meta) - rank(b.meta) ||
        a.meta.order - b.meta.order ||
        a.meta.href.localeCompare(b.meta.href)
      )
    })
    return { sections, pages }
  }

  function manifest(
    sections: Section[],
    pages: Built[],
    posts: Post[]
  ): string {
    const item = (page: Built) => ({
      title: page.meta.title,
      href: page.meta.href,
      description: page.meta.description,
      ...(page.meta.keywords ? { keywords: page.meta.keywords } : {}),
      ...(page.meta.kind ? { kind: page.meta.kind } : {}),
    })

    // `pages` is already in reading order, so a branch is emitted the first time
    // one of its pages is seen and the rest are appended to it.
    const nav = sections
      .map((section) => {
        const nodes: NavNode[] = []
        const branches = new Map<string, { label: string; items: NavItem[] }>()
        for (const page of pages.filter(
          (p) => p.meta.section === section.slug
        )) {
          const parent = page.meta.parent
          if (!parent) {
            nodes.push(item(page))
            continue
          }
          let branch = branches.get(parent)
          if (!branch) {
            const label = section.groups?.find((g) => g.slug === parent)?.label
            branch = { label: label ?? parent, items: [] }
            branches.set(parent, branch)
            nodes.push(branch)
          }
          branch.items.push(item(page))
        }
        return { slug: section.slug, label: section.label, items: nodes }
      })
      .filter((group) => group.items.length > 0)

    const json = (value: unknown) => JSON.stringify(value, null, 2)
    return `// @generated by ${config.generatedBy}. Do not edit.
import type { BlogMeta, NavGroup, PageMeta, SearchRecord } from "${config.typesImport}"

export const PAGES: readonly PageMeta[] = ${json(pages.map((page) => page.meta))}

export const NAV: readonly NavGroup[] = ${json(nav)}

/** Reading order, for the previous/next pager. */
export const ORDER: readonly string[] = ${json(pages.map((page) => page.meta.href))}

export const SEARCH: readonly SearchRecord[] = ${json(pages.flatMap((page) => page.records))}

export const POSTS: readonly BlogMeta[] = ${json(posts.map((post) => post.meta))}
`
  }

  function pageFile(path: string): string {
    const slug = path === "/docs" ? "index" : path.replace(/^\/docs\//, "")
    return join(generatedDir, "pages", `${slug}.json`)
  }

  async function emit(path: string, content: string): Promise<boolean> {
    files.set(path, content)
    const current = await readFile(path, "utf8").catch(() => undefined)
    if (current === content) return false
    if (!check) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content)
    }
    return true
  }

  const { sections, pages } = await build()
  const posts = await buildPosts()
  const stale: string[] = []

  for (const page of pages) {
    // The manifest already carries the frontmatter; the document does not repeat it.
    const { frontmatter: _frontmatter, ...document } = page.document
    if (await emit(pageFile(page.meta.href), `${JSON.stringify(document)}\n`)) {
      stale.push(relative(root, pageFile(page.meta.href)))
    }
  }
  for (const post of posts) {
    const { frontmatter: _front, ...document } = post.document
    const path = join(
      generatedDir,
      "pages",
      `${post.meta.href.replace(/^\//, "")}.json`
    )
    if (await emit(path, `${JSON.stringify(document)}\n`)) {
      stale.push(relative(root, path))
    }
  }
  if (
    await emit(
      join(generatedDir, "content.gen.ts"),
      manifest(sections, pages, posts)
    )
  ) {
    stale.push(relative(root, join(generatedDir, "content.gen.ts")))
  }
  if (await emit(join(generatedDir, "highlight.css"), highlightCss())) {
    stale.push(relative(root, join(generatedDir, "highlight.css")))
  }

  // The documentation, for language models: an index, the whole text, and one
  // markdown file per page, all from the same parse as the site itself.
  const SITE = config.site.url
  const body = (page: Built) =>
    plainComponents(
      plainInstall(page.source.replace(/^---\n[\s\S]*?\n---\n/, "").trim()),
      config.plain ?? {}
    )
  /** The markdown twin of a page, as `public/docs` serves it. */
  const markdownUrl = (page: Built) =>
    `${SITE}${page.meta.href === "/docs" ? "/docs/index" : page.meta.href}.md"`.slice(
      0,
      -1
    )

  const index = [
    ...config.site.llms,
    ...sections.flatMap((section) => {
      const items = pages.filter((page) => page.meta.section === section.slug)
      if (items.length === 0) return []
      return [
        `## ${section.label}`,
        "",
        ...items.map(
          (page) =>
            `- [${page.meta.title}](${markdownUrl(page)}): ${page.meta.description}`
        ),
        "",
      ]
    }),
  ].join("\n")

  const full = [
    `# ${config.site.fullTitle}`,
    "",
    `Every page, in reading order. Generated from the same source as ${SITE}/docs.`,
    "",
    ...pages.map((page) =>
      [
        "---",
        "",
        `# ${page.meta.title}`,
        `Source: ${SITE}${page.meta.href}`,
        page.meta.status ? `Status: ${page.meta.status}` : "",
        "",
        body(page),
        "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ].join("\n")

  if (await emit(join(publicDir, "llms.txt"), `${index}\n`))
    stale.push(relative(root, join(publicDir, "llms.txt")))
  if (await emit(join(publicDir, "llms-full.txt"), `${full}\n`))
    stale.push(relative(root, join(publicDir, "llms-full.txt")))
  for (const page of pages) {
    const slug =
      page.meta.href === "/docs"
        ? "index"
        : page.meta.href.replace(/^\/docs\//, "")
    const header = [
      `# ${page.meta.title}`,
      `Source: ${SITE}${page.meta.href}`,
      "",
    ].join("\n")
    if (
      await emit(
        join(publicDir, "docs", `${slug}.md`),
        `${header}\n${body(page)}\n`
      )
    ) {
      stale.push(relative(root, join(publicDir, "docs", `${slug}.md`)))
    }
  }

  // A page that was deleted must not leave its document behind.
  const written = new Set(files.keys())
  const existing = await readdir(join(generatedDir, "pages"), {
    withFileTypes: true,
    recursive: true,
  }).catch(() => [])
  for (const entry of existing) {
    const path = join(entry.parentPath, entry.name)
    if (entry.isFile() && !written.has(path)) {
      stale.push(`${relative(root, path)} (removed)`)
      if (!check) await rm(path)
    }
  }

  if (check && stale.length > 0) {
    console.error(
      `Generated content is stale. Run \`${config.regenerateCommand}\`:\n  ${stale.join("\n  ")}`
    )
    process.exitCode = 1
    return
  }
  console.log(
    check
      ? `content: ${pages.length} pages, ${posts.length} posts up to date`
      : `content: ${pages.length} pages, ${posts.length} posts, ${stale.length} written`
  )
}

/**
 * Drops HTML comments on a line of their own that are not components — notes
 * for tools, such as `<!-- prettier-ignore -->`, which the parser would
 * otherwise render as text. `<!-- ::name … -->` components are kept.
 */
/** Fills each `{{fact:name}}` from `facts`; a name it does not know is an error, not a blank. */
export function withFacts(
  markdown: string,
  facts: Readonly<Record<string, string>>,
  where: string
): string {
  return markdown.replace(/\{\{fact:([\w-]+)\}\}/g, (_, name: string) => {
    const value = facts[name]
    if (value === undefined)
      throw new Error(`${where}: no fact named {{fact:${name}}}`)
    return value
  })
}

export function stripNotes(markdown: string): string {
  return markdown.replace(/^[ \t]*<!--(?!\s*::)[^\n]*?-->[ \t]*\n/gm, "")
}

/**
 * Replaces each `<!-- ::name attr="…" -->` that has a plain version with it;
 * components without one are left as they are.
 */
export function plainComponents(
  markdown: string,
  plain: Record<string, (attributes: Record<string, string>) => string>
): string {
  return markdown.replace(
    /<!--\s*::([\w-]+)\b([^>]*?)-->/g,
    (match, name: string, rest: string) => {
      const render = plain[name]
      if (!render) return match
      const attributes = Object.fromEntries(
        [...rest.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!])
      )
      return render(attributes)
    }
  )
}

/**
 * A language model reads the markdown twin, not the rendered tabs: the
 * built-in `install` component becomes the npm commands it stands for.
 */
export function plainInstall(markdown: string): string {
  return markdown.replace(
    /<!--\s*::install\b([^>]*?)-->/g,
    (_match, attributes: string) => {
      const value = (name: string) =>
        new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1] ?? ""
      const request = {
        packages: value("packages"),
        dev: value("dev"),
        run: value("run"),
        exec: value("exec"),
      }
      // An install is npm's command; a command to run differs by package manager, so the twin
      // writes each one.
      const lines =
        request.run || request.exec
          ? PACKAGE_MANAGERS.flatMap((manager) => [
              `# ${manager}`,
              ...installLines(manager, request),
            ])
          : installLines("npm", request)
      return ["```bash", ...lines, "```"].join("\n")
    }
  )
}
