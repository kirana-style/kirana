/**
 * The VS Code client (KRN-DX-001): starts the project's `kirana-style lsp` and wires the editor to it.
 * Everything the server can answer it answers; this file only finds the server, passes settings
 * and the theme, restarts it when the configuration changes, shows command results, and hosts the
 * views the server's answers feed: the Style Inspector, Style Fold and the status bar's stylesheet
 * size.
 */
import { existsSync } from "node:fs"

import * as vscode from "vscode"
import { LanguageClient } from "vscode-languageclient/node"
import type { LanguageClientOptions } from "vscode-languageclient/node"

import { argumentsFor, outcomeOf } from "./commands.ts"
import { Documents, SCHEME } from "./documents.ts"
import { CARD_COMMANDS, ColouredHints } from "./hints-view.ts"
import type { HintOptions } from "./hints-view.ts"
import { FOLD_DEFAULTS, StyleFold } from "./fold-view.ts"
import type { FoldOptions } from "./fold-view.ts"
import { Inspector, VIEW, schemeOf } from "./inspector/view.ts"
import { LANGUAGES, initializationOptions, locateServer } from "./server.ts"

let client: LanguageClient | undefined
let status: vscode.StatusBarItem
let inspector: Inspector
let fold: StyleFold
let hints: ColouredHints
let documents: Documents

/** Settings the views read; changing them needs no server restart. */
const VIEW_SETTINGS = ["kirana.fold", "kirana.inspector"]

/** How Style Fold draws, from `kirana.fold.*`. */
function foldOptions(settings: vscode.WorkspaceConfiguration): FoldOptions {
  return {
    enabled: settings.get("fold.enabled", FOLD_DEFAULTS.enabled),
    mode: settings.get("fold.mode", FOLD_DEFAULTS.mode),
    opacity: Math.min(
      1,
      Math.max(0.1, settings.get("fold.opacity", FOLD_DEFAULTS.opacity))
    ),
    minLength: Math.max(
      0,
      settings.get("fold.minLength", FOLD_DEFAULTS.minLength)
    ),
    icon: settings.get("fold.icon", FOLD_DEFAULTS.icon),
  }
}

/** How summaries are drawn, from `kirana.inlayHints.*`. */
function hintOptions(settings: vscode.WorkspaceConfiguration): HintOptions {
  return {
    colors: settings.get("inlayHints.colors", true),
    icon: settings.get("inlayHints.icon", true),
    opacity: Math.min(
      1,
      Math.max(0.1, settings.get("inlayHints.opacity", 0.85))
    ),
  }
}

/** Runs `run` once `delay` ms after the last call. */
function debounced(run: () => unknown, delay: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return () => {
    clearTimeout(timer)
    timer = setTimeout(run, delay)
  }
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  status.command = "kirana.restartServer"
  const settings = vscode.workspace.getConfiguration("kirana")
  inspector = new Inspector(
    () => client,
    schemeOf(vscode.window.activeColorTheme.kind)
  )
  fold = new StyleFold(() => client, foldOptions(settings))
  hints = new ColouredHints(() => client, hintOptions(settings))
  documents = new Documents()
  const follow = debounced(() => {
    if (
      vscode.workspace
        .getConfiguration("kirana")
        .get("inspector.followCursor", true)
    )
      void inspector.follow()
    void fold.update(vscode.window.activeTextEditor)
  }, 150)
  const stats = debounced(() => void showStats(), 500)
  context.subscriptions.push(
    status,
    fold,
    vscode.commands.registerCommand("kirana.restartServer", restart),
    vscode.window.registerWebviewViewProvider(VIEW, inspector),
    vscode.commands.registerCommand(
      "kirana.inspect",
      (uri?: string, offset?: number) =>
        uri === undefined
          ? vscode.commands
              .executeCommand(`${VIEW}.focus`)
              .then(() => inspector.follow())
          : inspector.inspectAt(uri, offset ?? 0)
    ),
    vscode.commands.registerCommand("kirana.toggleStyleFold", () =>
      fold.toggle()
    ),
    vscode.commands.registerCommand("kirana.foldStyles", () => fold.foldAll()),
    vscode.window.onDidChangeTextEditorSelection(follow),
    vscode.window.onDidChangeActiveTextEditor(follow),
    hints,
    documents,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, documents),
    vscode.languages.registerHoverProvider(
      LANGUAGES.map((language) => ({ scheme: "file", language })),
      hints
    ),
    vscode.window.onDidChangeVisibleTextEditors(() => hints.drawVisible()),
    vscode.workspace.onDidSaveTextDocument(stats),
    vscode.window.onDidChangeActiveColorTheme((theme) => {
      inspector.scheme = schemeOf(theme.kind)
      void inspector.draw()
      void client?.sendNotification("kirana/theme", { theme: inspector.scheme })
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kirana.fold")) {
        fold.options = foldOptions(vscode.workspace.getConfiguration("kirana"))
        void fold.update(vscode.window.activeTextEditor)
      }
      const view = VIEW_SETTINGS.some((section) =>
        event.affectsConfiguration(section)
      )
      if (event.affectsConfiguration("kirana") && !view) void restart()
    })
  )
  await serially(start)
}

/** The status bar: the server, and the size of the stylesheet it compiles. */
async function showStats(): Promise<void> {
  if (!client) return
  const { bytes, rules } = (await client.sendRequest("kirana/stats", {})) as {
    bytes: number
    rules: number
  }
  status.text = `$(symbol-color) Kirana · ${rules.toLocaleString("en")} rules · ${(bytes / 1024).toFixed(1)} KB`
}

export function deactivate(): Promise<void> {
  return serially(stop)
}

function restart(): Promise<void> {
  return serially(async () => {
    await stop()
    await start()
  })
}

/**
 * Every start, stop and restart, one after another. A settings change, the server's
 * `kirana/restart` and the restart command can all arrive while a client is still starting;
 * run concurrently, two of them stop the same client and each start one, and the second
 * client's commands collide with the first's ("command 'kirana.showCompiledCss' already
 * exists").
 */
let queue: Promise<void> = Promise.resolve()
function serially(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task, task)
  return queue
}

async function stop(): Promise<void> {
  const running = client
  client = undefined
  hints?.clear()
  await running?.stop()
}

async function start(): Promise<void> {
  hints.options = hintOptions(vscode.workspace.getConfiguration("kirana"))
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  const config = vscode.workspace.getConfiguration("kirana")
  const server = locateServer(
    folder,
    config.get("server.path", ""),
    process.platform,
    existsSync
  )
  if (!server) {
    status.text = "$(warning) Kirana"
    status.tooltip =
      "No kirana binary: install @kirana-style/compiler in this project, or set kirana.server.path."
    status.show()
    return
  }
  const options: LanguageClientOptions = {
    documentSelector: LANGUAGES.map((language) => ({
      scheme: "file",
      language,
    })),
    initializationOptions: initializationOptions(
      (key, fallback) => config.get(key, fallback),
      schemeOf(vscode.window.activeColorTheme.kind)
    ),
    // The hover's "Open inspector" and "Show compiled CSS" links, and nothing else, may run.
    markdown: {
      isTrusted: { enabledCommands: CARD_COMMANDS },
      // The card's side-by-side table and coloured property names: VS Code keeps only its safe
      // subset (tables, `<br>`, `<span style="color:…">`).
      supportHtml: true,
    },
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/{*.ts,*.tsx,*.js,*.jsx,*.mts,*.mjs,*.vue,*.svelte,*.astro,kirana.config.*,package.json}"
      ),
    },
    middleware: {
      // The summaries are drawn coloured by the extension, not as VS Code's one-colour hints.
      provideInlayHints: async (document, range, token, next) =>
        hints.take(document, await next(document, range, token)),
      executeCommand: async (command, args, next) => {
        const editor = vscode.window.activeTextEditor
        const cursor = editor && {
          uri: editor.document.uri.toString(),
          text: editor.document.getText(),
          offset: editor.document.offsetAt(editor.selection.active),
          line: editor.selection.active.line,
          word: editor.document.getText(
            editor.document.getWordRangeAtPosition(editor.selection.active)
          ),
        }
        const sent = argumentsFor(command, args, cursor)
        if (!sent) return undefined
        const outcome = outcomeOf(command, await next(command, sent))
        if (outcome.kind === "document") {
          await documents.show(
            sent[0] as string | undefined,
            outcome.language,
            outcome.content
          )
        } else if (outcome.kind === "locations") {
          const converter = client!.protocol2CodeConverter
          const locations = outcome.locations.map((location) =>
            converter.asLocation(location as never)
          )
          await vscode.commands.executeCommand(
            "editor.action.showReferences",
            locations[0]!.uri,
            locations[0]!.range.start,
            locations
          )
        } else if (outcome.kind === "edit") {
          // The server's edit is never empty (a null result is "none" above).
          await vscode.workspace.applyEdit(
            (await client!.protocol2CodeConverter.asWorkspaceEdit(
              outcome.edit as never
            ))!
          )
        }
        return undefined
      },
    },
  }
  client = new LanguageClient(
    "kirana",
    "Kirana",
    {
      command: server.command,
      args: server.args,
      options: { cwd: folder, shell: process.platform === "win32" },
    },
    options
  )
  // `kirana.config.*` is evaluated in JavaScript when the server starts, so a change restarts it.
  client.onNotification("kirana/restart", () => void restart())
  await client.start()
  status.text = "$(symbol-color) Kirana"
  status.tooltip = `Kirana language server: ${server.command}`
  status.show()
  await showStats()
  void inspector.follow()
  void fold.update(vscode.window.activeTextEditor)
}
