/**
 * The Angular CLI app in `angular.json` (KF-131). Its builder bundles a stylesheet a script imports
 * as code, without a loader for the fonts it names, and type-checks no side-effect import of a
 * project's `.css`; it takes global stylesheets in the build options' `styles`, which load their
 * fonts as files. So on the Angular CLI the design system's and the fonts' stylesheets are listed
 * there, after Kirana's, instead of imported from the entry.
 */
import { addImport, readJsonc } from "@kirana-style/compiler"

/** The configuration that lists them. */
export const ANGULAR_JSON = "angular.json"

/**
 * Kirana's stylesheet as `@kirana-style/angular`'s builders write it, listed first so that every
 * stylesheet after it follows its layer order; the builders add it only where `styles` lacks it.
 */
export const ANGULAR_STYLESHEET = ".kirana/kirana.css"

/** Angular's application builders, Kirana's among them (D-068). Analog's builds with Vite. */
const APPLICATION =
  /^@(?:kirana-style\/angular|angular\/build|angular-devkit\/build-angular):application$/

type Target = {
  builder?: string
  options?: { browser?: string; styles?: (string | { input: string })[] }
}

/** The app: the path to its build options in `angular.json`, its entry script, what `styles` lists. */
export type AngularApp = {
  readonly keys: readonly string[]
  readonly entry: string | undefined
  readonly styles: readonly string[]
}

/** The workspace's one project whose build target runs an application builder, if it has exactly one. */
export function angularApp(
  read: (file: string) => string | undefined
): AngularApp | undefined {
  const text = read(ANGULAR_JSON)
  if (text === undefined) return undefined
  const { projects = {} } = readJsonc(text) as {
    projects?: Record<
      string,
      { architect?: Record<string, Target>; targets?: Record<string, Target> }
    >
  }
  const apps = Object.entries(projects).flatMap(([name, project]) => {
    const kind = project.architect ? "architect" : "targets"
    const build = project[kind]?.build
    return build?.options && APPLICATION.test(String(build.builder))
      ? [{ keys: ["projects", name, kind, "build", "options"], ...build }]
      : []
  })
  if (apps.length !== 1) return undefined
  const { keys, options } = apps[0]!
  return {
    keys,
    entry: options!.browser,
    styles: (options!.styles ?? []).map((entry) =>
      typeof entry === "string" ? entry : entry.input
    ),
  }
}

/**
 * What `styles` lists for a font's stylesheet: the stylesheet its import names, or a package's
 * `index.css`, where Fontsource's packages keep theirs, since `styles` takes stylesheets only.
 */
export const fontStyle = (specifier: string) =>
  /\.(?:css|scss|sass|less)$/.test(specifier)
    ? specifier
    : `${specifier}/index.css`

/**
 * `angular.json` with `entries` listed in the app's `styles`, after what it lists and Kirana's
 * stylesheet, each once; `undefined` when it lists them all. The rest of the file keeps its layout.
 */
export function withStyles(
  text: string,
  app: AngularApp,
  entries: readonly string[]
): { text: string; added: string[] } | undefined {
  const added = [...new Set([ANGULAR_STYLESHEET, ...entries])].filter(
    (entry) => !app.styles.includes(entry)
  )
  if (added.length === 0) return undefined
  const styles = spanOf(text, [...app.keys, "styles"])
  if (styles !== undefined) {
    const line = text.slice(text.lastIndexOf("\n", styles.start) + 1)
    const listed = readJsonc(text.slice(styles.start, styles.end)) as unknown[]
    const array = render(
      [...listed, ...added],
      /^[ \t]*/.exec(line)![0],
      text.slice(styles.start, styles.end).includes("\n")
    )
    return {
      text: `${text.slice(0, styles.start)}${array}${text.slice(styles.end)}`,
      added,
    }
  }
  // The first option: after the brace, spaced as the option that follows it.
  const options = spanOf(text, app.keys)!
  const open = options.start + 1
  const space = /^\s*/.exec(text.slice(open))![0]
  const indent = space.slice(space.lastIndexOf("\n") + 1)
  const last = text[open + space.length] === "}"
  const array = render(added, indent, space.includes("\n"))
  return {
    text: `${text.slice(0, open)}${space}"styles": ${array}${last ? "" : `,${space}`}${text.slice(open + space.length)}`,
    added,
  }
}

/** A JSON array of `entries`, one to a line under `indent`, or on one line. */
function render(
  entries: readonly unknown[],
  indent: string,
  multiline: boolean
): string {
  const items = entries.map((entry) => JSON.stringify(entry))
  return multiline
    ? `[\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}]`
    : `[${items.join(", ")}]`
}

/**
 * Where the value at `keys` starts and ends in a JSON text that parses, comments and trailing
 * commas allowed: `undefined` where there is none.
 */
function spanOf(
  text: string,
  keys: readonly string[]
): { start: number; end: number } | undefined {
  const blank = /(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/y
  const string = /"(?:[^"\\]|\\.)*"/y
  const literal = /[^\s,\]}]+/y
  const wanted = keys.join("\0")
  let at = 0
  let found: { start: number; end: number } | undefined
  const skip = (pattern: RegExp) => {
    pattern.lastIndex = at
    pattern.exec(text)
    at = pattern.lastIndex
  }
  const value = (path: readonly string[]): void => {
    skip(blank)
    const start = at
    const open = text[at]
    if (open === "{" || open === "[") {
      at++
      for (let index = 0; ; index++) {
        skip(blank)
        if (text[at] === "}" || text[at] === "]") break
        let key = String(index)
        if (open === "{") {
          const name = at
          skip(string)
          key = JSON.parse(text.slice(name, at)) as string
          skip(blank)
          // The colon.
          at++
        }
        value([...path, key])
        skip(blank)
        if (text[at] === ",") at++
      }
      at++
    } else skip(open === '"' ? string : literal)
    if (path.join("\0") === wanted) found = { start, end: at }
  }
  value([])
  return found
}

/**
 * The entry importing `./document`, which sets `<html>`'s classes, before the modules it imports by
 * name, so that the app's modules find them when they load (KF-135): after the side-effect imports
 * that open it, its polyfills (`zone.js`, which patches the globals before any other code takes
 * them, and `@angular/localize/init`) and stylesheets, as the stylesheet opens a Vite entry. An
 * entry that imports no module by name takes it after its last import, in the module's style.
 */
export function withDocumentImport(text: string): string {
  const added = addImport(text, `import "./document"`)
  const named = [
    ...text.matchAll(/^import\b[^;]*?["'][^"'\n]+["'];?[ \t]*$/gm),
  ].find((found) => !/^import\s*["']/.test(found[0]))
  if (named === undefined) return added
  const line = /^import\s*(["'])\.\/document\1;?/m.exec(added)![0]
  return `${text.slice(0, named.index)}${line}\n${text.slice(named.index)}`
}

/** The line reporting `withStyles`' edit. */
export const stylesLine = (added: readonly string[]) =>
  `${ANGULAR_JSON}: styles list ${added.join(", ")}`
