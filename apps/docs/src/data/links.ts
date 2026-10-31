/**
 * Where Kirana lives: its sites, its repository and the npm page of the package every project
 * installs. The header and footer of every page read these, so they sit apart from `facts.ts`
 * (which re-exports them) and its catalogues of diagnostics, packages and benchmark runs.
 */

/**
 * Kirana's three sites. Each answers at its Cloudflare Worker's address until its custom domain is
 * added (the `routes` its `wrangler.jsonc` keeps commented out), and `live` says which one a link
 * should use. Set a site's `live` in the change that adds its domain, and every link on this site
 * follows. No other file writes a site's address: `scripts/check-consistency.ts` refuses a
 * `workers.dev` or `play.`/`ui.kirana.style` address anywhere else, and a docs site whose
 * `wrangler.jsonc` routes its domain while `docs.live` is false.
 */
export const SITES = {
  /** This site: the docs, the product pages and the blog. */
  docs: {
    live: false,
    domain: "https://kirana.style",
    worker: "https://site.kirana-style.workers.dev",
  },
  /** Kirana Play: a project compiled in the browser by a released engine (`kirana-play`). */
  playground: {
    live: false,
    domain: "https://play.kirana.style",
    worker: "https://play.kirana-style.workers.dev",
  },
  /** Kirana UI: its components, their docs and the registry `kirana-style ui add` reads (`kirana-ui`). */
  ui: {
    live: false,
    domain: "https://ui.kirana.style",
    worker: "https://ui.kirana-style.workers.dev",
  },
} as const

type Site = { live: boolean; domain: string; worker: string }

/** The address a link to a site uses today. */
const addressOf = (site: Site) => (site.live ? site.domain : site.worker)

/** This site's own address, for what needs it absolute: `llms.txt`, a post's canonical link. */
export const SITE_URL = addressOf(SITES.docs)
/** Kirana Play. */
export const PLAYGROUND = addressOf(SITES.playground)
/** Kirana UI's site, and the pages on it this site links to. */
export const UI_SITE = addressOf(SITES.ui)
export const UI_PAGES = {
  components: `${UI_SITE}/docs`,
  blocks: `${UI_SITE}/blocks`,
  charts: `${UI_SITE}/charts`,
  create: `${UI_SITE}/create`,
} as const

/** The repository on GitHub, as `owner/name`, and its page. */
export const REPOSITORY = "kirana-style/kirana"
export const GITHUB = `https://github.com/${REPOSITORY}`
/** The package every Kirana project installs: its npm page and downloads stand for the project's. */
export const CORE_PACKAGE = "@kirana-style/core"
export const NPM = `https://www.npmjs.com/package/${CORE_PACKAGE}`
