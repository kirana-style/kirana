/**
 * The slice of the `vscode` API the extension uses, recorded so unit tests can drive the
 * extension without an editor. The end-to-end test (`test/e2e`) runs it in a real VS Code.
 */
import { vi } from "vite-plus/test"

type Listener = (...args: any[]) => unknown

export const state = {
  settings: {} as Record<string, unknown>,
  folders: [{ uri: { fsPath: "/project" } }] as
    | Array<{ uri: { fsPath: string } }>
    | undefined,
  editor: undefined as unknown,
  theme: { kind: 2 },
  configurationListener: undefined as
    | undefined
    | ((event: { affectsConfiguration: (section: string) => boolean }) => void),
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  /** Event listeners by event name (`onDidChangeTextEditorSelection`, …). */
  listeners: new Map<string, Listener>(),
  /** The webview view providers registered, by view id. */
  views: new Map<string, unknown>(),
}

export const status = { text: "", tooltip: "", command: "", show: vi.fn() }

export const StatusBarAlignment = { Right: 2 }
export const ViewColumn = { Beside: -2 }

export class Position {
  readonly line: number
  readonly character: number
  constructor(line: number, character: number) {
    this.line = line
    this.character = character
  }
}

export class Range {
  readonly start: Position
  readonly end: Position
  constructor(
    ...args: [Position, Position] | [number, number, number, number]
  ) {
    if (args.length === 2) {
      this.start = args[0]
      this.end = args[1]
    } else {
      this.start = new Position(args[0], args[1])
      this.end = new Position(args[2], args[3])
    }
  }
}

export class ThemeColor {
  readonly id: string
  constructor(id: string) {
    this.id = id
  }
}

export class MarkdownString {
  value: string
  isTrusted: unknown
  supportHtml = false
  constructor(value: string) {
    this.value = value
  }
}

export class Hover {
  contents: unknown[]
  constructor(contents: unknown) {
    this.contents = [contents]
  }
}

export const languages = {
  registerHoverProvider: vi.fn(() => ({ dispose() {} })),
}

export const Uri = {
  parse: (value: string) => ({
    value,
    path: value.replace(/^[a-z]+:(\/\/[^/]*)?/, ""),
    toString: () => value,
  }),
}

export class EventEmitter<T> {
  listeners: Array<(value: T) => void> = []
  event = (listener: (value: T) => void) => {
    this.listeners.push(listener)
    return { dispose() {} }
  }
  fire(value: T) {
    this.listeners.forEach((listener) => listener(value))
  }
  dispose() {}
}

/** Registers an event listener under its event's name, as `vscode` events are subscribed. */
const event = (name: string) =>
  vi.fn((listener: Listener) => {
    state.listeners.set(name, listener)
    return { dispose() {} }
  })

export const window = {
  createStatusBarItem: vi.fn(() => status),
  get activeTextEditor() {
    return state.editor
  },
  get activeColorTheme() {
    return state.theme
  },
  get visibleTextEditors() {
    return state.editor ? [state.editor] : []
  },
  showTextDocument: vi.fn(async () => undefined),
  registerWebviewViewProvider: vi.fn((id: string, provider: unknown) => {
    state.views.set(id, provider)
    return { dispose() {} }
  }),
  createTextEditorDecorationType: vi.fn((options: unknown) => ({
    options,
    dispose: vi.fn(),
  })),
  onDidChangeTextEditorSelection: event("selection"),
  onDidChangeActiveTextEditor: event("editor"),
  onDidChangeActiveColorTheme: event("theme"),
  onDidChangeVisibleTextEditors: event("visible"),
}

export const commands = {
  registerCommand: vi.fn(
    (name: string, run: (...args: unknown[]) => unknown) => {
      state.commands.set(name, run)
      return { dispose() {} }
    }
  ),
  executeCommand: vi.fn(async () => undefined),
}

export const workspace = {
  get workspaceFolders() {
    return state.folders
  },
  getConfiguration: vi.fn(() => ({
    get: (key: string, fallback: unknown) =>
      key in state.settings ? state.settings[key] : fallback,
  })),
  onDidChangeConfiguration: vi.fn(
    (listener: typeof state.configurationListener) => {
      state.configurationListener = listener
      return { dispose() {} }
    }
  ),
  onDidSaveTextDocument: event("save"),
  registerTextDocumentContentProvider: vi.fn(() => ({ dispose() {} })),
  createFileSystemWatcher: vi.fn((pattern: string) => ({ pattern })),
  openTextDocument: vi.fn(async (options: unknown) => ({
    options,
    getText: () => "é = 1",
    positionAt: (offset: number) => new Position(0, offset),
  })),
  applyEdit: vi.fn(async () => true),
}
