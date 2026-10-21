import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  compile,
  kiranaLoader,
  resetSession,
  session,
  stylesheet,
} from "../src/index.ts"

const created: string[] = []
afterAll(() =>
  created.forEach((directory) =>
    rmSync(directory, { recursive: true, force: true })
  )
)
afterEach(() => {
  resetSession()
  vi.restoreAllMocks()
})

/** A project next to the tests, whose session the module opens. */
function project(): string {
  const root = mkdtempSync(path.join(import.meta.dirname, ".app-"))
  created.push(root)
  writeFileSync(path.join(root, "package.json"), '{"name":"app"}')
  // The JSX runtime the compiled modules import, installed as Remix installs it.
  const runtime = path.join(root, "node_modules/remix")
  mkdirSync(path.join(runtime, "component"), { recursive: true })
  writeFileSync(
    path.join(runtime, "package.json"),
    '{"name":"remix","type":"module","exports":{"./component/jsx-runtime":"./component/jsx-runtime.js"}}'
  )
  writeFileSync(
    path.join(runtime, "component/jsx-runtime.js"),
    "export function jsx() {}\n"
  )
  session({ root })
  return root
}

/** What node-tsx hands on for a component: compiled JSX, with Kirana's import still in it. */
const COMPILED = [
  'import { css } from "@kirana-style/core"',
  'import { jsx as _jsx } from "remix/component/jsx-runtime"',
  'const probe = css({ display: "grid" })',
  'export const Probe = () => _jsx("p", { sx: probe, children: "x" })',
  "",
].join("\n")

describe("Remix 3", () => {
  it("opens one session per process, until it is reset", () => {
    const root = project()
    expect(session()).toBe(session())
    const first = session()
    resetSession()
    expect(session({ root })).not.toBe(first)
  })

  it("compiles a module's compiled JSX, and leaves what has no style alone", () => {
    const root = project()
    const url = pathToFileURL(path.join(root, "app/probe.tsx")).href
    expect(compile(url, COMPILED)).toContain('className: "k5O_')
    expect(compile(url, "export const x = 1\n")).toBeUndefined()
    // Past the prefilter (`sx:`), with nothing for the compiler to change.
    expect(compile(url, "export const note = { sx: 1 }\n")).toBeUndefined()
    expect(compile("node:fs", COMPILED)).toBeUndefined()
    const installed = pathToFileURL(
      path.join(root, "node_modules/kit/index.js")
    ).href
    expect(compile(installed, COMPILED)).toBeUndefined()
  })

  it("prints a warning and fails the load on an error", () => {
    const root = project()
    const url = pathToFileURL(path.join(root, "app/probe.tsx")).href
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    compile(
      url,
      'import { css } from "@kirana-style/core"\nimport { x } from "./missing"\nexport const a = css({ width: x })\n'
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unresolved-import")
    )
    expect(() =>
      compile(url, 'import { css } from "@kirana-style/core"\nconst = \n')
    ).toThrow(/parse-error/)
  })

  it("loads through the next loader, as Node's hooks and the asset server call it", () => {
    const root = project()
    const url = pathToFileURL(path.join(root, "app/probe.tsx")).href
    const loaded = (source: string | Uint8Array | null) =>
      kiranaLoader(url, { format: "module" }, (_, context) => ({
        ...context,
        source,
      }))
    expect(loaded(COMPILED).source).toContain('className: "k5O_')
    expect(loaded(COMPILED).format).toBe("module")
    expect(loaded(new TextEncoder().encode(COMPILED)).source).toContain(
      'className: "k5O_'
    )
    expect(loaded(null).source).toBeNull()
    expect(loaded("export const x = 1\n").source).toBe("export const x = 1\n")
  })

  it("serves the session's stylesheet as middleware, and passes every other request on", async () => {
    const root = project()
    compile(pathToFileURL(path.join(root, "app/probe.tsx")).href, COMPILED)
    const at = (pathname: string, method = "GET") => ({
      request: new Request(`http://localhost${pathname}`, { method }),
      url: new URL(`http://localhost${pathname}`),
    })
    const next = () => new Response("next")
    const middleware = stylesheet({ minify: false })
    const response = (await middleware(at("/kirana.css"), next)) as Response
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8")
    expect(await response.text()).toContain("display: grid")
    expect(await (await middleware(at("/other"), next)).text()).toBe("next")
    expect(
      await (await middleware(at("/kirana.css", "POST"), next)).text()
    ).toBe("next")
    const minified = stylesheet({ path: "/k.css", minify: true })
    expect(await (await minified(at("/k.css"), next)).text()).toContain(
      "display:grid"
    )
    vi.stubEnv("NODE_ENV", "production")
    expect(
      await (await stylesheet()(at("/kirana.css"), next)).text()
    ).toContain("display:grid")
    vi.unstubAllEnvs()
  })

  it("registers its hook with Node", async () => {
    const registerHooks = vi.fn()
    vi.doMock("node:module", () => ({ registerHooks }))
    await import("../src/node.ts")
    expect(registerHooks).toHaveBeenCalledWith({ load: kiranaLoader })
    vi.doUnmock("node:module")
  })
})
