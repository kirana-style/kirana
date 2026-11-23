/**
 * Runtimes (KF-134): a major of a framework that only some templates and bases run on, as Solid 2
 * beside Solid 1. A registry names them by its own names: a template's `runtime` in its templates
 * index, and the runtime each base needs in its index's `requires`, per framework. A template or a
 * base that names none is on the framework's default. `ui init --template` refuses a template on
 * another runtime than the base it would get needs, and `ui add` and `ui init` a project on another,
 * each only where both are known: an index without `requires` installs as before.
 */
import { frameworkOf } from "./project.ts"
import type { Framework, Index, TemplateEntry } from "./types.ts"

/**
 * The default runtime of each framework whose runtimes Kirana tells apart in a project: Solid 1. A
 * template or a base that names no runtime is on it.
 */
export const DEFAULT_RUNTIMES: Partial<Record<Framework, string>> = {
  solid: "solid1",
}

/** A runtime as it is compared: its name, else the framework's default (`""` where it has no name). */
export const runtimeKey = (framework: Framework, runtime?: string): string =>
  runtime ?? DEFAULT_RUNTIMES[framework] ?? ""

/** A runtime as a message names it. */
export const runtimeLabel = (framework: Framework, key: string): string =>
  key || `${framework}'s default runtime`

/**
 * A project's runtime, or a template's, from the packages it lists: on Solid, Solid 2 where it lists
 * Solid 2's DOM runtime, `@solidjs/web` (KF-129), or a `solid-js` range from 2 on, and Solid 1 for a
 * range below. Undefined where they do not say: another framework, or a range without a number
 * (`catalog:`, `latest`).
 */
export function runtimeOf(
  listed: Readonly<Record<string, string>>,
  framework: Framework
): string | undefined {
  if (framework !== "solid") return undefined
  if ("@solidjs/web" in listed) return "solid2"
  const major = /\d+/.exec(listed["solid-js"] ?? "")?.[0]
  if (major === undefined) return undefined
  return Number(major) >= 2 ? "solid2" : "solid1"
}

/** The runtime the index says a base of the framework needs; undefined where it names none for it. */
export function neededRuntime(
  index: Index,
  framework: Framework,
  base: string
): string | undefined {
  const bases = index.requires?.[framework]
  return bases === undefined ? undefined : runtimeKey(framework, bases[base])
}

/**
 * A template's framework and runtime: its entry's, else what its app's packages say. An entry that
 * names its framework and no runtime, on packages that do not say, is on the framework's default.
 * Undefined when nothing says.
 */
export function templateRuntime(
  listed: Readonly<Record<string, string>>,
  entry: TemplateEntry | undefined
): { framework: Framework; runtime: string } | undefined {
  const framework = entry?.framework ?? frameworkOf({ listed })
  if (framework === undefined) return undefined
  const runtime =
    entry?.runtime ??
    runtimeOf(listed, framework) ??
    (entry?.framework === undefined ? undefined : runtimeKey(framework))
  return runtime === undefined ? undefined : { framework, runtime }
}

/**
 * The template of the list that fits: of the framework and on the runtime, sharing the most of its
 * `--` parts, each in its place, with the one asked (the same workspace and tooling), then the
 * longest start of its name (`vite-solid--turbo` for `vite-solid2--turbo`); the first of those.
 */
export function fittingTemplate(
  asked: string,
  entries: readonly TemplateEntry[],
  framework: Framework,
  runtime: string
): string | undefined {
  const parts = asked.split("--")
  const score = (name: string) => {
    let start = 0
    while (start < name.length && name[start] === asked[start]) start++
    const shared = name
      .split("--")
      .filter((part, at) => part === parts[at]).length
    return shared * 1000 + start
  }
  let best: { name: string; score: number } | undefined
  for (const entry of entries)
    if (
      entry.framework === framework &&
      runtimeKey(framework, entry.runtime) === runtime &&
      (best === undefined || score(entry.name) > best.score)
    )
      best = { name: entry.name, score: score(entry.name) }
  return best?.name
}

/**
 * Why the project cannot take the base, when its runtime is not the one the index says the base
 * needs: `@acme's solid/uisdk base needs solid2, and the project is on solid1`, with the bases of
 * `bases` on the project's runtime. Undefined when it fits, or the index names no runtime for the
 * framework.
 */
export function baseRefusal(
  index: Index,
  home: string,
  framework: Framework,
  base: string,
  runtime: string,
  bases: readonly string[]
): { message: string; fits: string[] } | undefined {
  const needed = neededRuntime(index, framework, base)
  if (needed === undefined || needed === runtime) return undefined
  return {
    message: `${home}'s ${framework}/${base} base needs ${runtimeLabel(framework, needed)}, and the project is on ${runtimeLabel(framework, runtime)}`,
    fits: [...new Set(bases)].filter(
      (other) => neededRuntime(index, framework, other) === runtime
    ),
  }
}
