/**
 * The Angular CLI builders (`@kirana-style/angular:application`, `@kirana-style/angular:dev-server`): Angular's
 * own, given Kirana's mirror (`mirror.ts`) as `fileReplacements` and its stylesheet in `styles`.
 *
 *   "build": { "builder": "@kirana-style/angular:application", "options": { … as before … } }
 *   "serve": { "builder": "@kirana-style/angular:dev-server", … }
 *
 * The dev server is Angular's, given a context whose build target's options carry the mirror.
 */
import path from "node:path"

import { createBuilder } from "@angular-devkit/architect"
import type {
  Builder,
  BuilderContext,
  BuilderOutput,
  Target,
} from "@angular-devkit/architect"
import { buildApplication, executeDevServerBuilder } from "@angular/build"
import type {
  ApplicationBuilderOptions,
  DevServerBuilderOptions,
} from "@angular/build"

import { STYLESHEET, createMirror, watchMirror } from "./mirror.ts"
import type { Mirror } from "./mirror.ts"

/** The project's source folder, from its configuration (`src` unless it says otherwise). */
async function sourceRootOf(context: BuilderContext): Promise<string> {
  const project = context.target?.project
  const metadata = project ? await context.getProjectMetadata(project) : {}
  const root = typeof metadata.root === "string" ? metadata.root : ""
  return typeof metadata.sourceRoot === "string"
    ? metadata.sourceRoot
    : path.join(root, "src")
}

/**
 * Application options with the mirror's replacements and the stylesheet added. The entry files
 * (`browser`, `server`) are not replaced: Angular type-checks only the files its tsconfig lists, and
 * an entry it reads from a replacement it would bundle unchecked. An entry holds no styles in an
 * Angular app; the components it imports are replaced.
 */
export function withMirror<
  Options extends {
    fileReplacements?: unknown[]
    styles?: unknown[]
    browser?: unknown
    server?: unknown
  },
>(options: Options, mirror: Mirror): Options {
  const entries = new Set(
    [options.browser, options.server].map((entry) =>
      path.normalize(String(entry))
    )
  )
  return {
    ...options,
    fileReplacements: [
      ...(options.fileReplacements ?? []),
      ...mirror.replacements.filter(
        (replacement) => !entries.has(path.normalize(replacement.replace))
      ),
    ],
    styles: [...(options.styles ?? []), STYLESHEET],
  }
}

/** Prints the mirror's warnings and errors through the builder's logger (infos stay quiet). */
function report(context: BuilderContext, mirror: Mirror) {
  for (const message of mirror.messages())
    if (message.startsWith("error")) context.logger.error(message)
    else if (message.startsWith("warning")) context.logger.warn(message)
}

export async function* application(
  options: ApplicationBuilderOptions,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const sourceRoot = await sourceRootOf(context)
  const mirror = await createMirror(context.workspaceRoot, sourceRoot, {
    minify: options.optimization !== false,
  })
  report(context, mirror)
  const watcher = options.watch
    ? watchMirror(context.workspaceRoot, sourceRoot, mirror, () =>
        report(context, mirror)
      )
    : undefined
  try {
    yield* buildApplication(withMirror(options, mirror), context)
  } finally {
    watcher?.close()
  }
}

export async function* devServer(
  options: DevServerBuilderOptions,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const sourceRoot = await sourceRootOf(context)
  const mirror = await createMirror(context.workspaceRoot, sourceRoot)
  report(context, mirror)
  const watcher = watchMirror(context.workspaceRoot, sourceRoot, mirror, () =>
    report(context, mirror)
  )
  // Angular reads the build target's options through the context; these carry the mirror.
  const getTargetOptions = context.getTargetOptions.bind(context)
  const wrapped = Object.assign(Object.create(context) as BuilderContext, {
    getTargetOptions: async (target: Target) =>
      withMirror(await getTargetOptions(target), mirror),
  })
  try {
    yield* executeDevServerBuilder(options, wrapped)
  } finally {
    watcher.close()
  }
}

// Typed as Architect's `Builder`: the inferred type names `@angular-devkit/core`'s `JsonObject`,
// which this package does not depend on, so a declaration file could not spell it.
export const applicationBuilder = createBuilder(
  application
) as unknown as Builder
export const devServerBuilder = createBuilder(devServer) as unknown as Builder
