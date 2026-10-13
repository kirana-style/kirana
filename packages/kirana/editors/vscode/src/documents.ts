/**
 * Read-only documents for what the server reports (compiled CSS, precedence): a `kirana:` URI per
 * source file and kind, so a result opens in one reused tab, named after its file, that VS Code
 * never asks to save.
 */
import path from "node:path"

import * as vscode from "vscode"

export const SCHEME = "kirana"

/** The extension a result's URI ends in, so VS Code highlights it. */
const EXTENSIONS: Record<string, string> = { css: "css", markdown: "md" }

export class Documents implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>()
  private readonly changed = new vscode.EventEmitter<vscode.Uri>()
  readonly onDidChange = this.changed.event

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? ""
  }

  /** The URI a result about `source` opens at: `kirana:/compile-card.tsx.css`. */
  uriFor(source: string | undefined, language: string): vscode.Uri {
    const name = source
      ? path.basename(vscode.Uri.parse(source).path)
      : "kirana"
    return vscode.Uri.parse(
      `${SCHEME}:/${name}.${EXTENSIONS[language] ?? "txt"}`
    )
  }

  /** Shows a result beside the editor, in its tab if one is open. */
  async show(
    source: string | undefined,
    language: string,
    content: string
  ): Promise<void> {
    const uri = this.uriFor(source, language)
    this.contents.set(uri.toString(), content)
    this.changed.fire(uri)
    const document = await vscode.workspace.openTextDocument(uri)
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
      preview: true,
    })
  }

  dispose(): void {
    this.changed.dispose()
  }
}
