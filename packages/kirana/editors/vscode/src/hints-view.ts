/**
 * Coloured summaries in the editor (`hints.ts` colours them). VS Code draws inlay hints in one
 * colour, so the client takes the server's hints and draws each as a decoration at the end of its
 * line instead, led by the brand's icon. A hover over that text reaches hover providers at the
 * line's end, where this one answers with the element's card, resolved by the server only then
 * (`inlayHint/resolve`).
 */
import * as vscode from "vscode"
import type { LanguageClient } from "vscode-languageclient/node"

import { GROUP_COLOURS, ICON_URI } from "./brand.ts"
import { colour, hintAt } from "./hints.ts"
import type { HintData } from "./hints.ts"

type Hint = {
  position: { line: number; character: number }
  label: string
  data: HintData
}

/** How summaries are drawn (`kirana.inlayHints.*`). */
export type HintOptions = {
  /** Coloured by group; off, VS Code's own one-colour hints. */
  colors: boolean
  /** The brand's icon before each summary, as Tailwind Fold shows its own. */
  icon: boolean
  /** From 0.1 to 1: how strongly the summary reads against the code. */
  opacity: number
}

/** The commands a card's links may run, as the hover's own allow. */
export const CARD_COMMANDS = ["kirana.inspect", "kirana.showCompiledCss"]

export class ColouredHints implements vscode.HoverProvider {
  private readonly decoration = vscode.window.createTextEditorDecorationType({})
  private readonly byDocument = new Map<string, Hint[]>()
  private readonly client: () => LanguageClient | undefined
  options: HintOptions

  constructor(client: () => LanguageClient | undefined, options: HintOptions) {
    this.client = client
    this.options = options
  }

  /**
   * The language client's inlay hint middleware: the server's summaries become coloured
   * decorations, and VS Code draws none of them itself. Off, the hints pass through untouched.
   */
  take(
    document: vscode.TextDocument,
    hints: vscode.InlayHint[] | null | undefined
  ): vscode.InlayHint[] | null | undefined {
    if (!this.options.colors || !hints) return hints
    const found: Hint[] = []
    const rest: vscode.InlayHint[] = []
    for (const hint of hints) {
      const data = (hint as { data?: HintData }).data
      if (!data?.parts) {
        rest.push(hint)
        continue
      }
      const { line, character } = hint.position
      found.push({
        position: { line, character },
        label: String(hint.label),
        data,
      })
    }
    this.byDocument.set(document.uri.toString(), found)
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === document.uri.toString())
        this.draw(editor)
    }
    return rest
  }

  /** Draws a document's summaries in an editor showing it. */
  draw(editor: vscode.TextEditor): void {
    const hints = this.byDocument.get(editor.document.uri.toString()) ?? []
    const { opacity, icon } = this.options
    editor.setDecorations(
      this.decoration,
      hints.map((hint) => {
        const { text, css } = colour(hint.data.parts, opacity)
        const at = new vscode.Position(
          hint.position.line,
          hint.position.character
        )
        const mark = hint.data.mark
        // The brand's icon leads the summary; without it, the layout mark (`▦`) does.
        const before = icon
          ? {
              contentIconPath: vscode.Uri.parse(ICON_URI),
              width: "0.9em",
              height: "0.9em",
              margin: "0 0.5ch 0 1ch",
              textDecoration: `none; vertical-align: -0.1em; opacity: ${opacity}`,
            }
          : mark
            ? {
                contentText: `${mark} `,
                color: GROUP_COLOURS.layout,
                margin: "0 0 0 1ch",
                textDecoration: `none; opacity: ${opacity}`,
              }
            : undefined
        return {
          range: new vscode.Range(at, at),
          renderOptions: {
            before,
            after: {
              contentText: text,
              margin: before ? undefined : "0 0 0 1ch",
              textDecoration: css,
            },
          },
        }
      })
    )
  }

  /** Draws every visible editor again (after an editor opens, or the client restarts). */
  drawVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) this.draw(editor)
  }

  clear(): void {
    this.byDocument.clear()
    this.drawVisible()
  }

  /** A hover over a summary (at or past its line's end): the element's card. */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const hints = this.byDocument.get(document.uri.toString()) ?? []
    const hint = hintAt(hints, position.line, position.character)
    const client = this.client()
    if (!hint || !client) return undefined
    const resolved = (await client.sendRequest("inlayHint/resolve", hint)) as {
      tooltip?: string | { value: string }
    }
    const tooltip = resolved.tooltip
    const value = typeof tooltip === "string" ? tooltip : tooltip?.value
    if (!value) return undefined
    const markdown = new vscode.MarkdownString(value)
    markdown.isTrusted = { enabledCommands: CARD_COMMANDS }
    markdown.supportHtml = true
    return new vscode.Hover(markdown)
  }

  dispose(): void {
    this.decoration.dispose()
  }
}
