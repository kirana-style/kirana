/**
 * The logo each framework and bundler page is shown with: in the docs sidebar,
 * the guide grids, and the homepage's framework picker. Logos are from SVGL
 * (svgl.app), then LogoForge for a brand SVGL lacks, then the brand's own website
 * (`scripts/generate-svgl.ts`); a brand with none shows a monogram, never another company's logo.
 */
import { css } from "@kirana-style/core"

import type { SvglIcon } from "@workspace/docs-ui/brand-icon.tsx"
import { BrandIcon } from "@workspace/docs-ui/brand-icon.tsx"
import type { Sx } from "@workspace/ui/lib/sx"
import { theme } from "@workspace/ui/theme/semantic"
import { fontFamily, fontWeight } from "@workspace/ui/tokens/typography"

import { SVGL } from "@/generated/svgl-icons.gen"

/** A brand neither logo source has: its initials, in the site's own colours. */
export type Mark = { readonly title: string; readonly monogram: string }

export type Logo = SvglIcon | Mark

export const PAGE_LOGOS: Readonly<Record<string, Logo>> = {
  "/docs/frameworks/react": SVGL.react,
  "/docs/frameworks/nextjs": SVGL.nextjs,
  "/docs/frameworks/tanstack-start": SVGL.tanstack,
  "/docs/frameworks/react-router": SVGL.reactrouter,
  "/docs/frameworks/gatsby": SVGL.gatsby,
  "/docs/frameworks/waku": { title: "Waku", monogram: "W" },
  "/docs/frameworks/vike": SVGL.vike,
  "/docs/frameworks/docusaurus": SVGL.docusaurus,
  "/docs/frameworks/preact": SVGL.preact,
  "/docs/frameworks/solid": SVGL.solidjs,
  "/docs/frameworks/solid-start": SVGL.solidjs,
  "/docs/frameworks/vue": SVGL.vue,
  "/docs/frameworks/nuxt": SVGL.nuxt,
  "/docs/frameworks/vitepress": SVGL.vitepress,
  "/docs/frameworks/svelte": SVGL.svelte,
  "/docs/frameworks/sveltekit": SVGL.sveltekit,
  "/docs/frameworks/astro": SVGL.astro,
  "/docs/frameworks/qwik": SVGL.qwik,
  "/docs/frameworks/angular": SVGL.angular,
  "/docs/frameworks/ember": SVGL.ember,
  "/docs/frameworks/meteor": SVGL.meteor,
  "/docs/frameworks/vanilla": SVGL.javascript,
  "/docs/frameworks/laravel": SVGL.laravel,
  "/docs/frameworks/symfony": SVGL.symfony,
  "/docs/frameworks/rails": SVGL.rails,
  "/docs/frameworks/phoenix": SVGL.phoenix,
  "/docs/frameworks/adonisjs": SVGL.adonisjs,
  "/docs/integrations/vite": SVGL.vite,
  "/docs/integrations/rolldown": SVGL.rolldown,
  "/docs/integrations/webpack": SVGL.webpack,
  "/docs/integrations/rspack": SVGL.rspack,
  "/docs/integrations/parcel": SVGL.parcel,
  "/docs/integrations/bun": SVGL.bun,
  "/docs/integrations/esbuild": SVGL.esbuild,
  "/docs/integrations/postcss": SVGL.postcss,
  "/docs/integrations/jest": SVGL.jest,
  "/docs/integrations/storybook": SVGL.storybook,
}

const styles = {
  monogram: css({
    display: "inline-grid",
    placeItems: "center",
    flexShrink: 0,
    borderRadius: "22%",
    backgroundColor: theme.foreground,
    color: theme.background,
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  }),
}

/** A logo, or the monogram that stands in for one. */
export function LogoIcon({
  logo,
  size = "1rem",
  label,
  sx,
}: {
  logo: Logo
  size?: string
  label?: string
  sx?: Sx
}) {
  if (!("monogram" in logo))
    return <BrandIcon icon={logo} size={size} label={label} sx={sx} />
  return (
    <span
      sx={[styles.monogram, sx]}
      style={{
        width: size,
        height: size,
        fontSize: `calc(${size} * ${logo.monogram.length > 1 ? 0.46 : 0.6})`,
      }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {logo.monogram}
    </span>
  )
}

/** For the docs config: the logo of a page, if it has one. */
export function pageIcon(href: string, size = "0.875rem") {
  const logo = PAGE_LOGOS[href]
  return logo ? <LogoIcon logo={logo} size={size} /> : null
}
