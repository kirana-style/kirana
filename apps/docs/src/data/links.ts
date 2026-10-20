/**
 * Where Kirana lives: its repository and the npm page of the package every project installs. The
 * header and footer of every page read these, so they sit apart from `facts.ts` (which re-exports
 * them) and its catalogues of diagnostics, packages and benchmark runs.
 */

/** The repository on GitHub, as `owner/name`, and its page. */
export const REPOSITORY = "kirana-style/kirana"
export const GITHUB = `https://github.com/${REPOSITORY}`
/** The package every Kirana project installs: its npm page and downloads stand for the project's. */
export const CORE_PACKAGE = "@kirana-style/core"
export const NPM = `https://www.npmjs.com/package/${CORE_PACKAGE}`
