/**
 * Style Fold in the editor (`fold.ts` decides what folds), with Tailwind Fold's choices
 * (`kirana.fold.*`): `fold` hides each long one-line style object and writes its summary in its
 * place, after the brand's icon; `dim` keeps the text and lowers its opacity instead.
 */
import * as vscode from "vscode"
import type { LanguageClient } from "vscode-languageclient/node"

import { ICON_URI } from "./brand.ts"
import { MIN_LENGTH, foldLines, plan } from "./fold.ts"
import type { StyleRange } from "./fold.ts"
import { LANGUAGES } from "./server.ts"

/** How Style Fold draws (`kirana.fold.*`). */
export type FoldOptions = {
  enabled: boolean
  /** `fold` replaces an object with its summary; `dim` keeps it, at `opacity`. */
  mode: "fold" | "dim"
  /** From 0.1 to 1: how strongly a dimmed object reads. */
  opacity: number
  /** Objects shorter than this many characters stay as written. */
  minLength: number
  /** The brand's icon before a folded summary. */
  icon: boolean
}

export const FOLD_DEFAULTS: FoldOptions = {
  enabled: false,
  mode: "fold",
  opacity: 0.4,
  minLength: MIN_LENGTH,
  icon: true,
}

export class StyleFold {
  private readonly hidden = vscode.window.createTextEditorDecorationType({
    // VS Code has no API to hide text: CSS carried in `textDecoration` is how Inline Fold and
    // Tailwind Fold do it.
    textDecoration: "none; display: none;",
  })
  // The summary in an object's place: the icon before it, the text after, one decoration, so the
  // two never swap.
  private readonly label = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      fontStyle: "italic",
    },
  })
  private dim: vscode.TextEditorDecorationType
  private readonly client: () => LanguageClient | undefined
  private current: FoldOptions

  constructor(client: () => LanguageClient | undefined, options: FoldOptions) {
    this.client = client
    this.current = options
    this.dim = StyleFold.dimming(options.opacity)
  }

  get options(): FoldOptions {
    return this.current
  }

  /** New options; the next `update` draws with them. */
  set options(options: FoldOptions) {
    // A decoration type's style is fixed when it is made: a new opacity needs a new type.
    if (options.opacity !== this.current.opacity) {
      this.dim.dispose()
      this.dim = StyleFold.dimming(options.opacity)
    }
    this.current = options
  }

  private static dimming(opacity: number): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      opacity: String(opacity),
    })
  }

  private async ranges(document: vscode.TextDocument): Promise<StyleRange[]> {
    const client = this.client()
    if (!client || !LANGUAGES.includes(document.languageId)) return []
    return (await client.sendRequest("kirana/styleRanges", {
      textDocument: { uri: document.uri.toString() },
    })) as StyleRange[]
  }

  /** Redraws an editor: objects off the cursor's lines folded or dimmed, or none when off. */
  async update(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor) return
    const { enabled, mode, minLength, icon } = this.current
    const found = enabled
      ? plan(
          await this.ranges(editor.document),
          new Set(editor.selections.map((selection) => selection.active.line)),
          minLength
        )
      : []
    const ranges = found.map(
      (item) => new vscode.Range(item.line, item.start, item.line, item.end)
    )
    const folding = mode === "fold"
    editor.setDecorations(this.dim, folding ? [] : ranges)
    editor.setDecorations(this.hidden, folding ? ranges : [])
    editor.setDecorations(
      this.label,
      (folding ? found : []).map((item) => ({
        range: new vscode.Range(item.line, item.start, item.line, item.start),
        renderOptions: {
          before: icon
            ? {
                contentIconPath: vscode.Uri.parse(ICON_URI),
                width: "0.9em",
                height: "0.9em",
                margin: "0 0.4ch 0 0",
                textDecoration: "none; vertical-align: -0.1em",
              }
            : undefined,
          after: { contentText: item.label },
        },
      }))
    )
  }

  async toggle(): Promise<void> {
    this.options = { ...this.current, enabled: !this.current.enabled }
    await this.update(vscode.window.activeTextEditor)
  }

  /** "Kirana: Fold Styles": the editor folds every multi-line style object. */
  async foldAll(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) return
    const lines = foldLines(await this.ranges(editor.document))
    if (lines.length > 0)
      await vscode.commands.executeCommand("editor.fold", {
        selectionLines: lines,
        levels: 1,
      })
  }

  dispose(): void {
    this.hidden.dispose()
    this.label.dispose()
    this.dim.dispose()
  }
}
