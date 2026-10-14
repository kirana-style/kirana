/**
 * A product's logo from SVGL (svgl.app), as an `<img>` of a file kept in `brands/` — never
 * hotlinked: `apps/docs/scripts/generate-svgl.ts` downloads the files once, and Vite serves them
 * fingerprinted with the site.
 *
 * `<img>` rather than inline `<svg>`: SVGL logos are multi-colour artwork, often with gradients
 * whose ids would collide when one logo is inlined twice on a page, and an image is cached once
 * for every use.
 *
 * A logo with light and dark variants renders both, and the site's colour scheme decides which
 * shows: `schemeMarker` on `<html>` carries the theme switch's mode, and `"system"` (also before
 * hydration) follows the OS. `prefers-color-scheme` alone would show the OS's variant on a site
 * the visitor switched to the other scheme — a dark logo on a dark page.
 */
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"

import logoBun from "./brands/bun.svg?url"
import logoNpm from "./brands/npm.svg?url"
import logoPnpmDark from "./brands/pnpm_dark.svg?url"
import logoPnpmLight from "./brands/pnpm.svg?url"
import logoYarn from "./brands/yarn.svg?url"
import { schemeMarker } from "./scheme.ts"

export type ThemeOptions = { light: string; dark: string }

/** A logo: its product, the product's site, and the file (or a file per scheme). */
export type SvglIcon = {
  title: string
  url: string
  route: string | ThemeOptions
}

const dark = '[data-mode="dark"]'
const system = '[data-mode="system"]'
const prefersDark = "@media (prefers-color-scheme: dark)"

const styles = {
  root: css({ display: "inline-block", flexShrink: 0, objectFit: "contain" }),
  // The light variant, hidden where the site is dark.
  light: css({
    display: {
      base: "inline-block",
      [schemeMarker.within(dark)]: "none",
      [schemeMarker.within(system)]: { [prefersDark]: "none" },
    },
  }),
  darkVariant: css({
    display: {
      base: "none",
      [schemeMarker.within(dark)]: "inline-block",
      [schemeMarker.within(system)]: { [prefersDark]: "inline-block" },
    },
  }),
}

export function BrandIcon({
  icon,
  size = "1rem",
  label,
  scheme,
  sx,
}: {
  icon: SvglIcon
  size?: string
  /** Name it for assistive tech; without one the logo is decorative. */
  label?: string
  /** The variant for a surface whose scheme is fixed (a dark editor bar), whatever the page's. */
  scheme?: "light" | "dark"
  sx?: Sx
}) {
  const image = (src: string, variant: Sx) => (
    <img
      src={src}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      sx={[styles.root, variant, sx]}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
    />
  )
  if (typeof icon.route === "string") return image(icon.route, null)
  if (scheme) return image(icon.route[scheme], null)
  return (
    <>
      {image(icon.route.light, styles.light)}
      {image(icon.route.dark, styles.darkVariant)}
    </>
  )
}

/** The package managers the install tabs offer, with their logos. */
export const PACKAGE_MANAGER_ICONS: Record<string, SvglIcon> = {
  npm: { title: "npm", url: "https://www.npmjs.com/", route: logoNpm },
  pnpm: {
    title: "pnpm",
    url: "https://pnpm.io/",
    route: { light: logoPnpmLight, dark: logoPnpmDark },
  },
  yarn: { title: "Yarn", url: "https://yarnpkg.com/", route: logoYarn },
  bun: { title: "Bun", url: "https://bun.sh", route: logoBun },
}
