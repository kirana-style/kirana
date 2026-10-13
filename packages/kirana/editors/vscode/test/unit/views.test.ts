import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { Documents } from "../../src/documents.ts"
import { foldLines, MIN_LENGTH, plan } from "../../src/fold.ts"
import { colour, hintAt } from "../../src/hints.ts"
import { CARD_COMMANDS, ColouredHints } from "../../src/hints-view.ts"
import type { StyleRange } from "../../src/fold.ts"
import { FOLD_DEFAULTS, StyleFold } from "../../src/fold-view.ts"
import {
  conditionName,
  escape,
  page,
  render,
  sides,
  tracks,
} from "../../src/inspector/render.ts"
import type { Entry, Inspected } from "../../src/inspector/render.ts"
import { Inspector, schemeOf } from "../../src/inspector/view.ts"
import { commands, state, window, workspace } from "./vscode.ts"

const entry = (
  property: string,
  value: string,
  more: Partial<Entry> = {}
): Entry => ({
  property,
  value,
  conditions: [],
  target: "",
  group: "other",
  tokens: [],
  rank: 0,
  class: `k-${property}`,
  rule: "",
  source: null,
  pixels: null,
  ...more,
})

const source = {
  label: "card",
  when: null,
  uri: "file:///a.tsx",
  line: 3,
  character: 2,
  place: "a.tsx:4",
}

const GRID: Inspected = {
  uri: "file:///a.tsx",
  label: "sx={[card, on && wide]}",
  kind: "sx",
  entries: [
    entry("display", "grid", { group: "layout", source }),
    entry("grid-template-columns", "repeat(2, 1fr)", { group: "layout" }),
    entry("gap", "var(--k-space-4)", {
      group: "layout",
      tokens: [{ identity: "space.4", light: "1rem", dark: null }],
    }),
    entry("padding", "1rem", {
      group: "box",
      pixels: "16px",
    }),
    entry("padding", "2rem", {
      group: "box",
      source: { ...source, label: "wide", when: "on" },
    }),
    entry("margin-top", "0.5rem", { group: "box" }),
    entry("margin-right", "1rem", { group: "box" }),
    entry("margin-bottom", "0.5rem", { group: "box" }),
    entry("margin-left", "1rem", { group: "box" }),
    entry("width", "10rem", { group: "size" }),
    entry("border-radius", "0.5rem", { group: "border" }),
    entry("color", "light-dark(black, white)", { group: "colour" }),
    entry("background-color", "var(--k-wash)", {
      group: "colour",
      tokens: [{ identity: "color.wash", light: "#0003", dark: "#fff3" }],
    }),
    entry("border-color", "#f00", { group: "colour" }),
    entry("outline-color", "var(--x)", { group: "colour" }),
    entry("accent-color", "var(--ring)", {
      group: "colour",
      tokens: [{ identity: "color.ring", light: "#00f", dark: null }],
    }),
    entry("font-size", "0.875rem", { group: "type" }),
    entry("line-height", "1.5", { group: "type" }),
    entry("opacity", "0.5", {
      group: "effects",
      conditions: ["@media (width >= 48rem)", ":hover"],
      target: "::before",
    }),
  ],
  conditions: [":hover", "@media (width >= 48rem)"],
  switches: ["on"],
  effective: [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  summary: "grid",
}

describe("the inspector's content", () => {
  it("draws every part of a style", () => {
    const html = render(GRID, new Set(["on"]), "light")
    // Toggles for conditions, breakpoints by name, and switches; the active one is on.
    expect(html).toContain('data-toggle="@media (width &gt;= 48rem)"')
    expect(html).toContain("</span>md</button>")
    expect(html).toContain('<button class="chip on" data-toggle="on"')
    // The box model with each layer's sides, the grid's tracks, the radius.
    expect(html).toContain("margin 0.5rem 1rem")
    expect(html).toContain("padding 2rem")
    expect(html).toContain('<div class="cell">1fr</div>')
    expect(html).toContain("border-radius: min(0.5rem, 18px)")
    expect(html).toContain("10rem × auto")
    expect(html).toContain("grid · cols repeat(2, 1fr) · gap space.4")
    // Colours: a pair, a token's modes, a literal; a value that is not one has no swatch.
    expect(html).toContain("background: black")
    expect(html).toContain("background: #0003")
    expect(html).toContain("background: #f00")
    expect(html).not.toContain("background: var(--x)")
    expect(render(GRID, new Set(), "dark")).toContain("background: #00f")
    expect(render(GRID, new Set(), "dark")).toContain("background: white")
    // Type, then every declaration by group, with its state and source.
    expect(html).toContain("font-size: clamp(10px, 0.875rem, 40px)")
    expect(html).toContain("0.875rem / 1.5 400")
    expect(html).toContain('<tr class="holds"><td>opacity</td>')
    // A value whose conditions are off is shown, dimmed.
    expect(render({ ...GRID, effective: [0] }, new Set(), "light")).toContain(
      '<tr class="idle"><td>gap</td>'
    )
    expect(html).toContain("<small>16px</small>")
    expect(html).toContain('<span class="when">if on</span>')
    expect(html).toContain('<span class="when">::before</span>')
    expect(html).toContain('data-open="[&quot;file:///a.tsx&quot;,3,2]"')
    expect(html.indexOf("<h3>Layout</h3>")).toBeLessThan(
      html.indexOf("<h3>Box</h3>")
    )
  })

  it("draws a flex column, a plain box, and nothing for no site", () => {
    const flex: Inspected = {
      ...GRID,
      entries: [
        entry("display", "flex"),
        entry("flex-direction", "column"),
        entry("height", "2rem"),
      ],
      conditions: [],
      switches: [],
      effective: [0, 1, 2],
    }
    const html = render(flex, new Set(), "light")
    expect(html).toContain('flex-direction: column"><div class="cell">')
    expect(html).toContain("auto × 2rem")
    expect(html).not.toContain('class="toggles"')
    const plain = { ...flex, entries: [entry("color", "red")], effective: [0] }
    expect(render(plain, new Set(), "light")).toContain(
      '<div class="content">content</div>'
    )
    const row = { ...flex, entries: [entry("display", "flex")], effective: [0] }
    expect(render(row, new Set(), "light")).toContain("flex-direction: row")
    const grid = {
      ...flex,
      entries: [entry("display", "grid")],
      effective: [0],
    }
    expect(render(grid, new Set(), "light")).toContain('<div class="content">')
    expect(render(null, new Set(), "light")).toContain('class="empty"')
  })

  it("writes sides, tracks, conditions and text the way CSS does", () => {
    const set = (values: Record<string, string>) =>
      new Map(
        Object.entries(values).map(([property, value]) => [
          property,
          entry(property, value),
        ])
      )
    expect(sides(set({}), "padding")).toBeUndefined()
    expect(sides(set({ padding: "1px" }), "padding")).toBe("1px")
    expect(
      sides(set({ "padding-block": "1px", "padding-inline": "2px" }), "padding")
    ).toBe("1px 2px")
    expect(
      sides(set({ "padding-top": "1px", "padding-inline": "2px" }), "padding")
    ).toBe("1px 2px 0")
    expect(
      sides(
        set({
          "padding-block-start": "1px",
          "padding-inline-end": "2px",
          "padding-left": "3px",
        }),
        "padding"
      )
    ).toBe("1px 2px 0 3px")
    expect(tracks("repeat(3, 1fr)")).toEqual(["1fr", "1fr", "1fr"])
    expect(tracks(" 200px  minmax(0, 1fr) auto")).toEqual([
      "200px",
      "minmax(0, 1fr)",
      "auto",
    ])
    expect(tracks("")).toEqual([])
    expect(conditionName("@media (width >= 96rem)")).toBe("2xl")
    expect(conditionName(":focus")).toBe(":focus")
    expect(escape(`<a href="x">&</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
    )
  })

  it("is a page with a strict policy whose script forwards clicks", () => {
    const html = page("abc", "vscode-resource:")
    expect(html).toContain("script-src 'nonce-abc'")
    expect(html).toContain("default-src 'none'")
    expect(html).toContain('<script nonce="abc">')
    expect(html).toContain('vscode.postMessage({ type: "ready" })')
  })
})

const range = (
  line: number,
  start: number,
  end: number,
  multiline = false
): StyleRange => ({
  name: "card",
  multiline,
  range: {
    start: { line, character: start },
    end: { line: multiline ? line + 3 : line, character: end },
  },
  summary: "flex · gap 4px",
})

describe("Style Fold's plan", () => {
  it("folds long one-line objects off the cursor's lines", () => {
    const ranges = [
      range(1, 10, 10 + MIN_LENGTH),
      range(2, 10, 20),
      range(3, 10, 10 + MIN_LENGTH),
      range(4, 0, 2, true),
      { ...range(5, 0, MIN_LENGTH), summary: "" },
    ]
    expect(plan(ranges, new Set([3]))).toEqual([
      { line: 1, start: 10, end: 10 + MIN_LENGTH, label: "{ flex · gap 4px }" },
    ])
    expect(foldLines(ranges)).toEqual([4])
  })
})

describe("the views in the editor", () => {
  const client = {
    sendRequest: vi.fn(async (method: string): Promise<unknown> =>
      method === "kirana/styleRanges"
        ? [range(0, 0, MIN_LENGTH), range(2, 0, 1, true)]
        : GRID
    ),
  }
  const webview = () => {
    const view = {
      webview: {
        options: {},
        html: "",
        cspSource: "csp:",
        postMessage: vi.fn(async () => true),
        listener: undefined as undefined | ((message: unknown) => unknown),
        onDidReceiveMessage(listener: (message: unknown) => unknown) {
          view.webview.listener = listener
        },
      },
    }
    return view
  }
  const editor = (languageId = "typescriptreact") => ({
    document: { uri: { toString: () => "file:///a.tsx" }, languageId },
    selection: { active: { line: 1, character: 2 } },
    selections: [{ active: { line: 5 } }],
    setDecorations: vi.fn(),
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.editor = undefined
  })

  it("the inspector follows the cursor and answers its webview", async () => {
    const inspector = new Inspector(() => client as never, schemeOf(1))
    expect(schemeOf(3)).toBe("dark")
    // Nothing to show before the view opens, without an editor, or in another language.
    await inspector.refresh()
    const view = webview()
    inspector.resolveWebviewView(view as never)
    expect(view.webview.html).toContain("csp:")
    await inspector.follow()
    state.editor = editor("markdown")
    await inspector.follow()
    expect(client.sendRequest).not.toHaveBeenCalled()
    state.editor = editor()
    await view.webview.listener!({ type: "ready" })
    expect(client.sendRequest).toHaveBeenLastCalledWith("kirana/inspect", {
      textDocument: { uri: "file:///a.tsx" },
      position: { line: 1, character: 2 },
      active: [],
    })
    expect(view.webview.postMessage).toHaveBeenLastCalledWith({
      type: "render",
      html: expect.stringContaining("grid"),
    })
    // Toggling a condition on and off asks again; the scheme only redraws.
    await view.webview.listener!({ type: "toggle", name: ":hover" })
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      "kirana/inspect",
      expect.objectContaining({ active: [":hover"] })
    )
    await view.webview.listener!({ type: "toggle", name: ":hover" })
    expect(inspector.active.size).toBe(0)
    await view.webview.listener!({ type: "scheme", scheme: "dark" })
    expect(inspector.scheme).toBe("dark")
    await view.webview.listener!({
      type: "open",
      location: ["file:///b.tsx", 4, 1],
    })
    expect(window.showTextDocument).toHaveBeenCalled()
    // From the hover's link: a byte offset in a document, focused.
    await inspector.inspectAt("file:///a.tsx", 3)
    expect(commands.executeCommand).toHaveBeenCalledWith(
      "kirana.inspector.focus"
    )
    expect(workspace.openTextDocument).toHaveBeenCalled()
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      "kirana/inspect",
      expect.objectContaining({ position: { line: 0, character: 2 } })
    )
    // Without a client there is nothing to ask.
    const idle = new Inspector(() => undefined, "light")
    idle.resolveWebviewView(webview() as never)
    await idle.refresh()
  })

  it("the fold hides objects and folds the long ones", async () => {
    const fold = new StyleFold(() => client as never, FOLD_DEFAULTS)
    await fold.update(undefined)
    const open = editor()
    await fold.update(open as never)
    expect(open.setDecorations).toHaveBeenCalledWith(expect.anything(), [])
    await fold.toggle()
    state.editor = open
    await fold.update(open as never)
    // Folded: nothing dimmed, the object hidden, the icon and summary in its place.
    const last = (count: number) =>
      open.setDecorations.mock.calls
        .slice(-count)
        .map((call) => call[1]) as Array<Array<{ renderOptions: any }>>
    const [dimmed, hidden, labels] = last(3)
    expect(dimmed).toEqual([])
    expect(hidden).toHaveLength(1)
    expect(labels![0]!.renderOptions.after).toEqual({
      contentText: "{ flex · gap 4px }",
    })
    expect(labels![0]!.renderOptions.before.contentIconPath.value).toMatch(
      /^data:image\/svg\+xml;base64,/
    )
    // Without the icon, the summary alone.
    fold.options = { ...fold.options, icon: false }
    await fold.update(open as never)
    expect(last(1)[0]![0]!.renderOptions.before).toBeUndefined()
    // Dimmed: the object stays, at the new opacity, and nothing is hidden or written.
    fold.options = { ...fold.options, mode: "dim", opacity: 0.3 }
    expect(fold.options.opacity).toBe(0.3)
    await fold.update(open as never)
    const [dim, none, noLabels] = last(3)
    expect(dim).toHaveLength(1)
    expect(none).toEqual([])
    expect(noLabels).toEqual([])
    expect(window.createTextEditorDecorationType).toHaveBeenLastCalledWith({
      opacity: "0.3",
    })
    // The same opacity keeps its decoration type.
    const made = window.createTextEditorDecorationType.mock.calls.length
    fold.options = { ...fold.options, minLength: 0 }
    expect(window.createTextEditorDecorationType.mock.calls.length).toBe(made)
    // A document the server does not read has no ranges; nor does one without a client.
    await fold.update(editor("markdown") as never)
    await new StyleFold(() => undefined, {
      ...FOLD_DEFAULTS,
      enabled: true,
    }).update(open as never)
    // "Fold Styles" folds the multi-line ones; with none, or no editor, nothing happens.
    await fold.foldAll()
    expect(commands.executeCommand).toHaveBeenCalledWith("editor.fold", {
      selectionLines: [2],
      levels: 1,
    })
    commands.executeCommand.mockClear()
    client.sendRequest.mockResolvedValueOnce([])
    await fold.foldAll()
    state.editor = undefined
    await fold.foldAll()
    expect(commands.executeCommand).not.toHaveBeenCalled()
    fold.dispose()
  })
})

describe("coloured summaries", () => {
  const data = {
    uri: "file:///a.tsx",
    start: 0,
    end: 1,
    mark: "▦",
    parts: [
      { text: "grid", group: "layout" },
      { text: "p 1rem", group: "box" },
      { text: "+3", group: "more" },
    ],
  }

  it("colour each part with a hard stop at its edge", () => {
    const { text, css } = colour(data.parts)
    expect(text).toBe("grid · p 1rem · +3")
    expect(css).toContain(
      "linear-gradient(90deg, var(--vscode-charts-blue) 0ch 4ch, var(--vscode-editorInlayHint-foreground) 4ch 7ch, var(--vscode-charts-green) 7ch 13ch"
    )
    expect(css).toContain("-webkit-text-fill-color: transparent")
    // The colour the server sent wins; an unknown group is quiet; opacity dims it all.
    expect(
      colour([{ text: "a", group: "box", colour: "var(--x)" }]).css
    ).toContain("var(--x) 0ch 1ch")
    expect(colour([{ text: "a", group: "unknown" }]).css).toContain(
      "var(--vscode-editorInlayHint-foreground) 0ch 1ch"
    )
    expect(colour([{ text: "a", group: "box" }], 0.5).css).toMatch(
      /opacity: 0.5$/
    )
    const hints = [{ position: { line: 2, character: 10 } }]
    expect(hintAt(hints, 2, 10)).toBe(hints[0])
    expect(hintAt(hints, 2, 9)).toBeUndefined()
    expect(hintAt(hints, 3, 10)).toBeUndefined()
  })

  it("draw the summaries as decorations and answer a hover over them with the card", async () => {
    const client = {
      sendRequest: vi.fn(
        async (_method: string, hint: { data: { mark: string } }) =>
          hint.data.mark === "?"
            ? {}
            : {
                tooltip:
                  hint.data.mark === "s"
                    ? "plain"
                    : { value: "**Kirana** card" },
              }
      ),
    }
    let connected: typeof client | undefined = client
    const hints = new ColouredHints(() => connected as never, {
      colors: true,
      icon: false,
      opacity: 0.85,
    })
    const setDecorations = vi.fn()
    const open = {
      document: { uri: { toString: () => "file:///a.tsx" } },
      setDecorations,
    }
    state.editor = open
    const native = [
      {
        position: { line: 2, character: 30 },
        label: "▦ grid · p 1rem · +3",
        data,
      },
      { position: { line: 3, character: 4 }, label: "other" },
    ]
    const document = { uri: { toString: () => "file:///a.tsx" } }
    // VS Code keeps only the hints that are not summaries.
    expect(hints.take(document as never, native as never)).toEqual([native[1]])
    const [, decorations] = setDecorations.mock.calls.at(-1)! as [
      unknown,
      Array<{ renderOptions: any }>,
    ]
    expect(decorations).toHaveLength(1)
    expect(decorations[0]!.renderOptions.before).toMatchObject({
      contentText: "▦ ",
      margin: "0 0 0 1ch",
    })
    expect(decorations[0]!.renderOptions.after.contentText).toBe(
      "grid · p 1rem · +3"
    )
    expect(decorations[0]!.renderOptions.after.margin).toBeUndefined()
    // The hover over a summary is its card, trusted for the card's own links, with HTML.
    const hover = (await hints.provideHover(
      document as never,
      { line: 2, character: 31 } as never
    )) as any
    expect(hover.contents[0].value).toBe("**Kirana** card")
    expect(hover.contents[0].isTrusted).toEqual({
      enabledCommands: CARD_COMMANDS,
    })
    expect(hover.contents[0].supportHtml).toBe(true)
    // Not on a summary, nothing resolved, a plain tooltip, no client.
    expect(
      await hints.provideHover(
        document as never,
        { line: 2, character: 5 } as never
      )
    ).toBeUndefined()
    hints.take(
      document as never,
      [
        {
          position: { line: 1, character: 2 },
          label: "x",
          data: { ...data, mark: "" },
        },
        {
          position: { line: 4, character: 0 },
          label: "y",
          data: { ...data, mark: "?" },
        },
        {
          position: { line: 5, character: 0 },
          label: "z",
          data: { ...data, mark: "s" },
        },
      ] as never
    )
    const [, plain] = setDecorations.mock.calls.at(-1)! as [
      unknown,
      Array<{ renderOptions: any }>,
    ]
    expect(plain[0]!.renderOptions.before).toBeUndefined()
    expect(plain[0]!.renderOptions.after.margin).toBe("0 0 0 1ch")
    expect(
      await hints.provideHover(
        document as never,
        { line: 4, character: 0 } as never
      )
    ).toBeUndefined()
    expect(
      (
        (await hints.provideHover(
          document as never,
          { line: 5, character: 0 } as never
        )) as any
      ).contents[0].value
    ).toBe("plain")
    connected = undefined
    expect(
      await hints.provideHover(
        document as never,
        { line: 1, character: 2 } as never
      )
    ).toBeUndefined()
    expect(
      await hints.provideHover(
        { uri: { toString: () => "file:///other" } } as never,
        { line: 1, character: 2 } as never
      )
    ).toBeUndefined()
    // With the icon on, the brand's icon leads the summary, at the summary's opacity.
    hints.options = { ...hints.options, icon: true }
    hints.take(document as never, native as never)
    const [, withIcon] = setDecorations.mock.calls.at(-1)! as [
      unknown,
      Array<{ renderOptions: any }>,
    ]
    expect(withIcon[0]!.renderOptions.before.contentIconPath.value).toMatch(
      /^data:image\/svg\+xml;base64,/
    )
    expect(withIcon[0]!.renderOptions.before.textDecoration).toContain(
      "opacity: 0.85"
    )
    hints.options = { ...hints.options, icon: false }
    // Another document's editor is left alone; clearing undraws.
    state.editor = {
      ...open,
      document: { uri: { toString: () => "file:///b.tsx" } },
    }
    hints.take(document as never, [] as never)
    hints.clear()
    expect(setDecorations.mock.calls.at(-1)![1]).toEqual([])
    // Off, or with nothing: the hints pass through untouched.
    hints.options = { ...hints.options, colors: false }
    expect(hints.take(document as never, native as never)).toBe(native)
    expect(
      new ColouredHints(() => undefined, {
        colors: true,
        icon: true,
        opacity: 1,
      }).take(document as never, undefined)
    ).toBeUndefined()
    hints.dispose()
  })
})

describe("read-only result documents", () => {
  it("open in one reused tab named after their file", async () => {
    const documents = new Documents()
    const fired: unknown[] = []
    documents.onDidChange((uri) => fired.push(uri))
    await documents.show("file:///src/card.tsx", "css", ".a{}")
    expect(documents.uriFor("file:///src/card.tsx", "css").toString()).toBe(
      "kirana:/card.tsx.css"
    )
    expect(
      documents.provideTextDocumentContent(
        documents.uriFor("file:///src/card.tsx", "css")
      )
    ).toBe(".a{}")
    expect(fired).toHaveLength(1)
    expect(documents.uriFor(undefined, "markdown").toString()).toBe(
      "kirana:/kirana.md"
    )
    expect(documents.uriFor("file:///x", "plain").toString()).toBe(
      "kirana:/x.txt"
    )
    expect(
      documents.provideTextDocumentContent(
        documents.uriFor("file:///none", "css")
      )
    ).toBe("")
    documents.dispose()
  })
})
