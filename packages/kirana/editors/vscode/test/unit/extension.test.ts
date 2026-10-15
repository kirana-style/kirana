import type * as fs from "node:fs"
import path from "node:path"

import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import {
  CONVERT,
  EXPLAIN,
  SHOW_CSS,
  SHOW_USES,
  argumentsFor,
  byteOffset,
  outcomeOf,
  utf16Offset,
} from "../../src/commands.ts"
import {
  LANGUAGES,
  initializationOptions,
  locateServer,
} from "../../src/server.ts"
import {
  commands,
  languages,
  state,
  status,
  window,
  workspace,
} from "./vscode.ts"

const clients: Array<{
  args: unknown[]
  notifications: Map<string, () => void>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  sendRequest: ReturnType<typeof vi.fn>
  sendNotification: ReturnType<typeof vi.fn>
}> = []

/** Clients started and not yet stopped, and the most ever alive at once. */
const alive = { now: 0, peak: 0 }
const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

vi.mock("vscode-languageclient/node", () => ({
  LanguageClient: class {
    args: unknown[]
    notifications = new Map<string, () => void>()
    running = false
    // Starting and stopping take time, as a real server's do; stopping twice stops once.
    start = vi.fn(async () => {
      await tick()
      this.running = true
      alive.now += 1
      alive.peak = Math.max(alive.peak, alive.now)
    })
    stop = vi.fn(async () => {
      await tick()
      if (this.running) alive.now -= 1
      this.running = false
    })
    protocol2CodeConverter = {
      asWorkspaceEdit: vi.fn(async (edit: unknown) => ({ converted: edit })),
      asLocation: vi.fn((location: unknown) => ({
        uri: "u",
        range: { start: "s" },
        location,
      })),
    }
    // The server's own requests: the stylesheet's size, style ranges, an inspection.
    sendRequest = vi.fn(async (method: string) =>
      method === "kirana/stats"
        ? { bytes: 2048, rules: 1234 }
        : method === "kirana/styleRanges"
          ? []
          : null
    )
    sendNotification = vi.fn(async () => undefined)
    constructor(...args: unknown[]) {
      this.args = args
      clients.push(this as never)
    }
    onNotification(method: string, handler: () => void) {
      this.notifications.set(method, handler)
    }
  },
}))

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof fs>()),
  existsSync: (file: string) =>
    file === path.join("/project", "node_modules", ".bin", "kirana"),
}))

describe("locating the server", () => {
  const exists = (file: string) =>
    file === path.join("/repo", "node_modules", ".bin", "kirana")
  it("finds the project's binary, walking up to a hoisted install", () => {
    expect(locateServer("/repo/apps/web", "", "linux", exists)).toEqual({
      command: path.join("/repo", "node_modules", ".bin", "kirana"),
      args: ["lsp"],
    })
    expect(locateServer("/elsewhere", "", "linux", exists)).toBeUndefined()
    expect(locateServer(undefined, "", "linux", exists)).toBeUndefined()
    expect(
      locateServer("/repo", "", "win32", (file) => file.endsWith("kirana.cmd"))
        ?.command
    ).toMatch(/kirana\.cmd$/)
  })

  it("prefers kirana-style, and finds the 0.1.0 name kirana after it", () => {
    const both = (file: string) =>
      file === path.join("/repo", "node_modules", ".bin", "kirana-style") ||
      file === path.join("/repo", "node_modules", ".bin", "kirana")
    expect(locateServer("/repo", "", "linux", both)?.command).toBe(
      path.join("/repo", "node_modules", ".bin", "kirana-style")
    )
    expect(
      locateServer("/repo", "", "win32", (file) =>
        file.endsWith("kirana-style.cmd")
      )?.command
    ).toMatch(/kirana-style\.cmd$/)
  })

  it("prefers the setting, running scripts with Node", () => {
    expect(locateServer("/repo", "bin/kirana.ts", "linux", exists)).toEqual({
      command: "node",
      args: [path.resolve("/repo", "bin/kirana.ts"), "lsp"],
    })
    expect(locateServer(undefined, "/usr/bin/kirana", "linux", exists)).toEqual(
      { command: "/usr/bin/kirana", args: ["lsp"] }
    )
  })

  it("passes the settings a client may turn off", () => {
    expect(
      initializationOptions(
        (key, fallback) =>
          (key === "codeLens.enabled" ? false : fallback) as never,
        "dark"
      )
    ).toEqual({
      summary: true,
      codeLens: false,
      images: true,
      commandLinks: true,
      html: true,
      summaryLength: 100,
      theme: "dark",
      rootFontSize: 16,
    })
    expect(LANGUAGES).toEqual(
      expect.arrayContaining([
        "vue",
        "svelte",
        "astro",
        "html",
        "blade",
        "erb",
        "twig",
        "phoenix-heex",
        "edge",
      ])
    )
  })
})

describe("commands", () => {
  const cursor = {
    uri: "file:///a.tsx",
    text: "é = css({ paddingTop: 1 })",
    offset: 2,
    line: 4,
    word: "paddingTop",
  }
  it("take their arguments from the cursor when the palette runs them", () => {
    expect(argumentsFor(SHOW_CSS, ["given"], cursor)).toEqual(["given"])
    expect(argumentsFor(SHOW_CSS, [], undefined)).toBeUndefined()
    expect(argumentsFor(SHOW_CSS, [], cursor)).toEqual(["file:///a.tsx"])
    expect(argumentsFor(EXPLAIN, [], cursor)).toEqual([
      "file:///a.tsx",
      5,
      "padding-top",
    ])
    // Two UTF-16 units, three UTF-8 bytes.
    expect(argumentsFor(CONVERT, [], cursor)).toEqual(["file:///a.tsx", 3])
    expect(byteOffset("ab", 1)).toBe(1)
    expect(utf16Offset("é = css", 3)).toBe(2)
  })

  it("open documents or apply edits", () => {
    expect(outcomeOf(SHOW_CSS, null)).toEqual({ kind: "none" })
    expect(outcomeOf(CONVERT, { changes: {} })).toEqual({
      kind: "edit",
      edit: { changes: {} },
    })
    expect(outcomeOf(SHOW_CSS, { language: "css", content: "a{}" })).toEqual({
      kind: "document",
      language: "css",
      content: "a{}",
    })
    expect(outcomeOf(SHOW_USES, [])).toEqual({ kind: "none" })
    expect(outcomeOf(SHOW_USES, [{ uri: "a" }])).toEqual({
      kind: "locations",
      locations: [{ uri: "a" }],
    })
    expect(outcomeOf(EXPLAIN, { content: "# x" })).toEqual({
      kind: "document",
      language: "markdown",
      content: "# x",
    })
  })
})

describe("the extension", () => {
  beforeEach(() => {
    clients.length = 0
    state.settings = {}
    state.folders = [{ uri: { fsPath: "/project" } }]
    state.editor = undefined
    vi.clearAllMocks()
  })

  it("starts the project's server and restarts it when asked", async () => {
    const extension = await import("../../src/extension.ts")
    const context = { subscriptions: [] as unknown[] }
    await extension.activate(context as never)
    expect(clients).toHaveLength(1)
    const [id, name, server, options] = clients[0]!.args as [
      string,
      string,
      { command: string; options: { cwd: string } },
      Record<string, any>,
    ]
    expect([id, name, server.command, server.options.cwd]).toEqual([
      "kirana",
      "Kirana",
      path.join("/project", "node_modules", ".bin", "kirana"),
      "/project",
    ])
    expect(options.documentSelector).toHaveLength(14)
    expect(options.initializationOptions).toMatchObject({
      summary: true,
      codeLens: true,
      images: true,
      theme: "dark",
    })
    // Only the hover's own links may run commands.
    expect(options.markdown.supportHtml).toBe(true)
    expect(options.markdown.isTrusted.enabledCommands).toEqual([
      "kirana.inspect",
      "kirana.showCompiledCss",
    ])
    expect(status.text).toBe("$(symbol-color) Kirana · 1,234 rules · 2.0 KB")
    // A configuration change restarts; an unrelated one does not.
    state.configurationListener!({
      affectsConfiguration: (section) => section === "editor",
    })
    expect(clients).toHaveLength(1)
    state.configurationListener!({
      affectsConfiguration: (section) => section === "kirana",
    })
    await vi.waitFor(() => expect(clients).toHaveLength(2))
    // So do the server's restart notification and the restart command.
    clients[1]!.notifications.get("kirana/restart")!()
    await vi.waitFor(() => expect(clients).toHaveLength(3))
    await state.commands.get("kirana.restartServer")!()
    expect(clients).toHaveLength(4)
    expect(clients[2]!.stop).toHaveBeenCalled()
    await extension.deactivate()
    expect(clients[3]!.stop).toHaveBeenCalled()
    await extension.deactivate()
  })

  it("shows command results and fills palette arguments from the editor", async () => {
    const extension = await import("../../src/extension.ts")
    await extension.activate({ subscriptions: [] } as never)
    const middleware = (
      clients[0]!.args[3] as {
        middleware: {
          executeCommand: (
            command: string,
            args: unknown[],
            next: (command: string, args: unknown[]) => Promise<unknown>
          ) => Promise<unknown>
        }
      }
    ).middleware
    const next = vi.fn(async (command: string) =>
      command === CONVERT
        ? { changes: {} }
        : command === EXPLAIN
          ? null
          : { language: "css", content: ".a{}" }
    )
    // Without an editor, a palette command has nothing to act on.
    expect(await middleware.executeCommand(SHOW_CSS, [], next)).toBeUndefined()
    expect(next).not.toHaveBeenCalled()
    state.editor = {
      document: {
        uri: { toString: () => "file:///project/a.tsx" },
        getText: (range?: unknown) => (range ? "color" : "css({ color: 1 })"),
        offsetAt: () => 7,
        getWordRangeAtPosition: () => ({}),
      },
      selection: { active: { line: 0 } },
      setDecorations: vi.fn(),
    }
    await middleware.executeCommand(SHOW_CSS, [], next)
    expect(next).toHaveBeenLastCalledWith(SHOW_CSS, ["file:///project/a.tsx"])
    // A read-only `kirana:` document named after the file: no "save changes?" on close.
    expect(workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ value: "kirana:/a.tsx.css" })
    )
    expect(window.showTextDocument).toHaveBeenCalledWith(expect.anything(), {
      viewColumn: -2,
      preserveFocus: true,
      preview: true,
    })
    await middleware.executeCommand(CONVERT, [], next)
    expect(workspace.applyEdit).toHaveBeenCalledWith({
      converted: { changes: {} },
    })
    await middleware.executeCommand(EXPLAIN, ["given", 1, "color"], next)
    expect(workspace.openTextDocument).toHaveBeenCalledTimes(1)
    // "Used by" opens VS Code's references view on the server's locations.
    const uses = vi.fn(async () => [{ uri: "file:///b.tsx" }])
    await middleware.executeCommand(SHOW_USES, ["file:///a.tsx", 3], uses)
    expect(commands.executeCommand).toHaveBeenCalledWith(
      "editor.action.showReferences",
      "u",
      "s",
      [{ uri: "u", range: { start: "s" }, location: { uri: "file:///b.tsx" } }]
    )
    await extension.deactivate()
  })

  it("never runs two clients at once, however restarts overlap", async () => {
    const extension = await import("../../src/extension.ts")
    await extension.activate({ subscriptions: [] } as never)
    alive.peak = alive.now
    // A settings change, the server's restart and the command, all at once.
    state.configurationListener!({ affectsConfiguration: () => true })
    clients.at(-1)!.notifications.get("kirana/restart")!()
    await state.commands.get("kirana.restartServer")!()
    expect(alive.peak).toBe(1)
    expect(alive.now).toBe(1)
    await extension.deactivate()
    expect(alive.now).toBe(0)
  })

  it("explains itself when there is no server to start", async () => {
    state.folders = undefined
    const extension = await import("../../src/extension.ts")
    await extension.activate({ subscriptions: [] } as never)
    expect(clients).toHaveLength(0)
    expect(status.text).toBe("$(warning) Kirana")
    expect(status.tooltip).toMatch(/install @kirana-style\/compiler/)
  })
})

describe("the views", () => {
  beforeEach(() => {
    clients.length = 0
    state.settings = {}
    state.folders = [{ uri: { fsPath: "/project" } }]
    state.editor = undefined
    state.listeners.clear()
    vi.clearAllMocks()
  })

  it("follows the cursor, the theme, saves and the views' own settings", async () => {
    const extension = await import("../../src/extension.ts")
    await extension.activate({ subscriptions: [] } as never)
    vi.useFakeTimers()
    const client = clients.at(-1)!
    // Hints from the server go through the colouring middleware; visible editors are redrawn.
    const options = client.args[3] as {
      middleware: {
        provideInlayHints: (...args: unknown[]) => Promise<unknown>
      }
    }
    const inlay = await options.middleware.provideInlayHints(
      { uri: { toString: () => "file:///project/a.tsx" } },
      {},
      {},
      async () => [{ position: { line: 0, character: 1 }, label: "x" }]
    )
    expect(inlay).toEqual([{ position: { line: 0, character: 1 }, label: "x" }])
    state.listeners.get("visible")!()
    // The hover over a summary asks the running client.
    const [, provider] = languages.registerHoverProvider.mock.calls.at(
      -1
    )! as unknown as [
      unknown,
      { provideHover: (...args: unknown[]) => Promise<unknown> },
    ]
    expect(
      await provider.provideHover(
        { uri: { toString: () => "file:///none" } },
        { line: 0, character: 0 }
      )
    ).toBeUndefined()
    // The theme reaches the server and the inspector.
    state.listeners.get("theme")!({ kind: 1 })
    expect(client.sendNotification).toHaveBeenCalledWith("kirana/theme", {
      theme: "light",
    })
    // Moving the cursor follows it once things settle; so does switching editors.
    state.editor = {
      document: {
        uri: { toString: () => "file:///project/a.tsx" },
        languageId: "typescriptreact",
      },
      selection: { active: { line: 2, character: 4 } },
      selections: [{ active: { line: 2 } }],
      setDecorations: vi.fn(),
    }
    state.listeners.get("selection")!()
    state.listeners.get("editor")!()
    await vi.runAllTimersAsync()
    expect(window.registerWebviewViewProvider).toHaveBeenCalled()
    // With the follow setting off, only the fold updates.
    state.settings = { "inspector.followCursor": false }
    state.listeners.get("selection")!()
    await vi.runAllTimersAsync()
    // A save refreshes the stylesheet's size.
    client.sendRequest.mockClear()
    state.listeners.get("save")!()
    await vi.runAllTimersAsync()
    expect(client.sendRequest).toHaveBeenCalledWith("kirana/stats", {})
    // The fold's setting redraws it and the inspector's restarts nothing.
    state.settings = { "fold.enabled": true }
    state.configurationListener!({
      affectsConfiguration: (section) =>
        section.startsWith("kirana.fold") || section === "kirana",
    })
    state.configurationListener!({
      affectsConfiguration: (section) =>
        section.startsWith("kirana.inspector") || section === "kirana",
    })
    expect(clients).toHaveLength(1)
    // The commands: the inspector at the cursor or at an offset, and the two folds.
    await state.commands.get("kirana.inspect")!()
    expect(commands.executeCommand).toHaveBeenCalledWith(
      "kirana.inspector.focus"
    )
    await state.commands.get("kirana.inspect")!("file:///project/a.tsx", 3)
    await state.commands.get("kirana.inspect")!("file:///project/a.tsx")
    await state.commands.get("kirana.toggleStyleFold")!()
    await state.commands.get("kirana.foldStyles")!()
    vi.useRealTimers()
    await extension.deactivate()
  })

  it("leaves the status alone while no server runs", async () => {
    state.folders = undefined
    const extension = await import("../../src/extension.ts")
    await extension.activate({ subscriptions: [] } as never)
    vi.useFakeTimers()
    state.listeners.get("save")!()
    state.listeners.get("theme")!({ kind: 2 })
    await vi.runAllTimersAsync()
    expect(status.text).toBe("$(warning) Kirana")
    vi.useRealTimers()
  })
})
