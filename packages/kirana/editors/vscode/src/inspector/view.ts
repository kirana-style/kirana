/**
 * The Style Inspector view (KRN-DX-015): a webview in the Explorer that follows the cursor and
 * shows the resolved style of the `css()`, `recipe()` or element under it, with conditions and
 * switches to toggle. Toggling asks the server again (`kirana/inspect` with `active`), so which
 * value holds is always the compiler's answer.
 */
import { randomBytes } from "node:crypto"

import * as vscode from "vscode"
import type { LanguageClient } from "vscode-languageclient/node"

import { utf16Offset } from "../commands.ts"
import { LANGUAGES } from "../server.ts"
import { page, render } from "./render.ts"
import type { Inspected } from "./render.ts"

export const VIEW = "kirana.inspector"

export type Scheme = "light" | "dark"

type Message =
  | { type: "ready" }
  | { type: "toggle"; name: string }
  | { type: "scheme"; scheme: Scheme }
  | { type: "open"; location: [string, number, number] }

/** The colour scheme of a VS Code theme kind: dark and high-contrast dark draw dark. */
export const schemeOf = (kind: number): Scheme =>
  kind === 2 || kind === 3 ? "dark" : "light"

export class Inspector implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined
  private target: { uri: string; line: number; character: number } | undefined
  private inspected: Inspected | null = null
  readonly active = new Set<string>()

  private readonly client: () => LanguageClient | undefined
  scheme: Scheme

  constructor(client: () => LanguageClient | undefined, scheme: Scheme) {
    this.client = client
    this.scheme = scheme
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    view.webview.options = { enableScripts: true }
    view.webview.html = page(
      randomBytes(16).toString("base64"),
      view.webview.cspSource
    )
    view.webview.onDidReceiveMessage((message: Message) =>
      this.receive(message)
    )
  }

  async receive(message: Message): Promise<void> {
    if (message.type === "ready") return this.follow()
    if (message.type === "toggle") {
      if (!this.active.delete(message.name)) this.active.add(message.name)
      return this.refresh()
    }
    if (message.type === "scheme") {
      this.scheme = message.scheme
      return this.draw()
    }
    const [uri, line, character] = message.location
    const position = new vscode.Position(line, character)
    await vscode.window.showTextDocument(vscode.Uri.parse(uri), {
      selection: new vscode.Range(position, position),
    })
  }

  /** Inspects what the cursor is on in the active editor, if it is a file the server reads. */
  async follow(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor || !LANGUAGES.includes(editor.document.languageId)) return
    const { line, character } = editor.selection.active
    this.target = { uri: editor.document.uri.toString(), line, character }
    await this.refresh()
  }

  /** Inspects the site at a byte offset of a document (the hover's "Open inspector"). */
  async inspectAt(uri: string, offset: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(uri)
    )
    const position = document.positionAt(
      utf16Offset(document.getText(), offset)
    )
    this.target = { uri, line: position.line, character: position.character }
    await vscode.commands.executeCommand(`${VIEW}.focus`)
    await this.refresh()
  }

  async refresh(): Promise<void> {
    const client = this.client()
    if (!client || !this.target || !this.view) return
    const { uri, line, character } = this.target
    this.inspected = (await client.sendRequest("kirana/inspect", {
      textDocument: { uri },
      position: { line, character },
      active: [...this.active],
    })) as Inspected | null
    await this.draw()
  }

  async draw(): Promise<void> {
    await this.view?.webview.postMessage({
      type: "render",
      html: render(this.inspected, this.active, this.scheme),
    })
  }
}
