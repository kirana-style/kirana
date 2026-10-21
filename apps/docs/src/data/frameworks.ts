/**
 * Every install guide, as the "Choose a framework" page and the installation page list
 * them: a framework, a server framework whose templates read a class map, or a
 * bundler. `runsOn` is what the overview's table states; `description` is the
 * tile's line. The logos live in `PAGE_LOGOS` (a React module; this file is read
 * at build time too, for the markdown twins).
 */
export type GuideGroup = "frameworks" | "server" | "bundlers"

export type Guide = {
  readonly title: string
  readonly href: string
  readonly group: GuideGroup
  readonly description: string
  readonly runsOn: string
}

export const GUIDE_GROUPS: Readonly<Record<GuideGroup, string>> = {
  frameworks: "Frameworks",
  server: "Server frameworks",
  bundlers: "Bundlers",
}

export const FRAMEWORK_GUIDES: readonly Guide[] = [
  {
    title: "React",
    href: "/docs/frameworks/react",
    group: "frameworks",
    description: "The library for web and native user interfaces, on Vite.",
    runsOn: "Vite",
  },
  {
    title: "Next.js",
    href: "/docs/frameworks/nextjs",
    group: "frameworks",
    description: "The React framework, with server components, on Turbopack.",
    runsOn: "Turbopack, webpack",
  },
  {
    title: "React Router",
    href: "/docs/frameworks/react-router",
    group: "frameworks",
    description:
      "A standards-focused router and framework you can deploy anywhere.",
    runsOn: "Vite",
  },
  {
    title: "TanStack Start",
    href: "/docs/frameworks/tanstack-start",
    group: "frameworks",
    description:
      "Full-stack React powered by TanStack Router. This site runs on it.",
    runsOn: "Vite",
  },
  {
    title: "Gatsby",
    href: "/docs/frameworks/gatsby",
    group: "frameworks",
    description: "Static sites with React and GraphQL, built by webpack.",
    runsOn: "webpack",
  },
  {
    title: "Remix",
    href: "/docs/frameworks/remix",
    group: "frameworks",
    description:
      "Remix 3: web standards, server-rendered components and client entries.",
    runsOn: "node-tsx and the asset server",
  },
  {
    title: "Waku",
    href: "/docs/frameworks/waku",
    group: "frameworks",
    description:
      "The minimal React framework, built on React Server Components.",
    runsOn: "Vite",
  },
  {
    title: "Vike",
    href: "/docs/frameworks/vike",
    group: "frameworks",
    description:
      "The framework you assemble: your renderer, your server, on Vite.",
    runsOn: "Vite",
  },
  {
    title: "Docusaurus",
    href: "/docs/frameworks/docusaurus",
    group: "frameworks",
    description: "Documentation websites with React, built by webpack.",
    runsOn: "webpack",
  },
  {
    title: "Preact",
    href: "/docs/frameworks/preact",
    group: "frameworks",
    description: "A fast 3 kB alternative to React with the same API.",
    runsOn: "Vite",
  },
  {
    title: "Solid",
    href: "/docs/frameworks/solid",
    group: "frameworks",
    description: "Simple, performant reactivity for user interfaces.",
    runsOn: "Vite",
  },
  {
    title: "SolidStart",
    href: "/docs/frameworks/solid-start",
    group: "frameworks",
    description:
      "Solid's full-stack framework: routes, server rendering and server functions.",
    runsOn: "Vite",
  },
  {
    title: "Vue",
    href: "/docs/frameworks/vue",
    group: "frameworks",
    description:
      "The progressive framework, with :sx in single-file components.",
    runsOn: "Vite",
  },
  {
    title: "Nuxt",
    href: "/docs/frameworks/nuxt",
    group: "frameworks",
    description: "The intuitive Vue framework for universal applications.",
    runsOn: "Nuxt (Vite)",
  },
  {
    title: "VitePress",
    href: "/docs/frameworks/vitepress",
    group: "frameworks",
    description: "The Vite and Vue static site generator for documentation.",
    runsOn: "Vite",
  },
  {
    title: "Svelte",
    href: "/docs/frameworks/svelte",
    group: "frameworks",
    description: "Cybernetically enhanced web apps, with sx on elements.",
    runsOn: "Vite",
  },
  {
    title: "SvelteKit",
    href: "/docs/frameworks/sveltekit",
    group: "frameworks",
    description: "The fastest way to build apps of all sizes with Svelte.",
    runsOn: "Vite",
  },
  {
    title: "Astro",
    href: "/docs/frameworks/astro",
    group: "frameworks",
    description:
      "The web framework for content-driven sites, sx in .astro files.",
    runsOn: "Astro (Vite)",
  },
  {
    title: "Qwik",
    href: "/docs/frameworks/qwik",
    group: "frameworks",
    description:
      "Instantly interactive apps, rendered on the server and resumed.",
    runsOn: "Qwik Router (Vite)",
  },
  {
    title: "Angular",
    href: "/docs/frameworks/angular",
    group: "frameworks",
    description:
      "The platform for web apps, with an [sx] directive in templates.",
    runsOn: "Angular CLI, Analog (Vite)",
  },
  {
    title: "Ember.js",
    href: "/docs/frameworks/ember",
    group: "frameworks",
    description: "A framework for ambitious web apps, on Embroider and Vite.",
    runsOn: "Embroider (Vite)",
  },
  {
    title: "Meteor",
    href: "/docs/frameworks/meteor",
    group: "frameworks",
    description: "The full-stack JavaScript platform for web and mobile apps.",
    runsOn: "Meteor (Rspack)",
  },
  {
    title: "No framework",
    href: "/docs/frameworks/vanilla",
    group: "frameworks",
    description:
      "Plain TypeScript and web components: handles are class strings.",
    runsOn: "Vite",
  },
  {
    title: "Laravel",
    href: "/docs/frameworks/laravel",
    group: "server",
    description: "The PHP framework for web artisans: @kirana in Blade.",
    runsOn: "Kirana CLI, Vite",
  },
  {
    title: "Symfony",
    href: "/docs/frameworks/symfony",
    group: "server",
    description: "The PHP framework for websites and apps: kirana() in Twig.",
    runsOn: "Kirana CLI, AssetMapper",
  },
  {
    title: "Ruby on Rails",
    href: "/docs/frameworks/rails",
    group: "server",
    description: "The full-stack Ruby framework: a kirana helper in ERB views.",
    runsOn: "Kirana CLI, Propshaft",
  },
  {
    title: "Phoenix",
    href: "/docs/frameworks/phoenix",
    group: "server",
    description: "Rich, interactive Elixir apps: kirana/1 in HEEx templates.",
    runsOn: "Kirana CLI",
  },
  {
    title: "AdonisJS",
    href: "/docs/frameworks/adonisjs",
    group: "server",
    description: "The fully featured Node.js framework: kirana() in Edge.",
    runsOn: "Kirana CLI, Vite",
  },
  {
    title: "Vite",
    href: "/docs/integrations/vite",
    group: "bundlers",
    description:
      "The build tool most frameworks run on, with hot style updates.",
    runsOn: "Vite 8",
  },
  {
    title: "Rolldown",
    href: "/docs/integrations/rolldown",
    group: "bundlers",
    description: "The Rust bundler under Vite, on its own.",
    runsOn: "Rolldown",
  },
  {
    title: "webpack",
    href: "/docs/integrations/webpack",
    group: "bundlers",
    description: "A pre loader for sx and a plugin that writes the stylesheet.",
    runsOn: "webpack 5",
  },
  {
    title: "Rspack and Rsbuild",
    href: "/docs/integrations/rspack",
    group: "bundlers",
    description: "The fast Rust-based web bundler, and its build tool.",
    runsOn: "Rspack, Rsbuild",
  },
  {
    title: "Parcel",
    href: "/docs/integrations/parcel",
    group: "bundlers",
    description: "The zero-configuration build tool for the web.",
    runsOn: "Parcel 2",
  },
  {
    title: "Bun",
    href: "/docs/integrations/bun",
    group: "bundlers",
    description: "Bun's bundler and its dev server, from one plugin.",
    runsOn: "Bun",
  },
  {
    title: "esbuild",
    href: "/docs/integrations/esbuild",
    group: "bundlers",
    description: "An extremely fast bundler, in watch and serve modes too.",
    runsOn: "esbuild",
  },
  {
    title: "PostCSS",
    href: "/docs/integrations/postcss",
    group: "bundlers",
    description: "The project's stylesheet wherever @kirana; stands.",
    runsOn: "PostCSS 8",
  },
  {
    title: "Jest",
    href: "/docs/integrations/jest",
    group: "bundlers",
    description: "A transformer, so tests see the class names you ship.",
    runsOn: "Jest",
  },
  {
    title: "Storybook",
    href: "/docs/integrations/storybook",
    group: "bundlers",
    description:
      "Stories built with your project's Vite config, styled as the app is.",
    runsOn: "Vite",
  },
]

/** One group's guides as markdown, for the page's twin that language models read. */
export function guidesMarkdown(group?: GuideGroup) {
  return FRAMEWORK_GUIDES.filter((guide) => !group || guide.group === group)
    .map((guide) => `- [${guide.title}](${guide.href}): ${guide.description}`)
    .join("\n")
}

/** Every guide as markdown, grouped (the installation page's `::frameworks`). */
export function frameworksMarkdown() {
  return (Object.keys(GUIDE_GROUPS) as GuideGroup[])
    .map((group) => `${GUIDE_GROUPS[group]}:\n\n${guidesMarkdown(group)}`)
    .join("\n\n")
}
