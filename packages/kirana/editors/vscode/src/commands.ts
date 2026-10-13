/**
 * The server's commands as an editor runs them: from a code lens or code action they come with
 * their arguments; from the command palette they take them from the active editor. Their results
 * open a document or apply an edit. Nothing here imports `vscode`.
 */

export const SHOW_CSS = "kirana.showCompiledCss"
export const EXPLAIN = "kirana.explainPrecedence"
export const CONVERT = "kirana.convertTailwind"
export const SHOW_USES = "kirana.showUses"

/** Where the cursor is: the document, its text, the cursor's string offset and line, and the word under it. */
export type Cursor = {
  uri: string
  text: string
  offset: number
  line: number
  word: string
}

/** The engine counts UTF-8 bytes; an editor counts UTF-16 units. */
export const byteOffset = (text: string, offset: number) =>
  Buffer.byteLength(text.slice(0, offset))

/** The editor's UTF-16 offset of the engine's UTF-8 byte offset. */
export const utf16Offset = (text: string, offset: number) =>
  Buffer.from(text).subarray(0, offset).toString().length

/** `paddingTop` → `padding-top`. */
const kebab = (word: string) =>
  word.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

/** The arguments to send, or undefined when the command needs a cursor and there is none. */
export function argumentsFor(
  command: string,
  args: unknown[],
  cursor: Cursor | undefined
): unknown[] | undefined {
  if (args.length > 0) return args
  if (!cursor) return undefined
  if (command === SHOW_CSS) return [cursor.uri]
  if (command === EXPLAIN)
    return [cursor.uri, cursor.line + 1, kebab(cursor.word)]
  return [cursor.uri, byteOffset(cursor.text, cursor.offset)]
}

export type Outcome =
  | { kind: "document"; language: string; content: string }
  | { kind: "edit"; edit: unknown }
  | { kind: "locations"; locations: unknown[] }
  | { kind: "none" }

/** What to do with a command's result. */
export function outcomeOf(command: string, result: unknown): Outcome {
  if (result === null || result === undefined) return { kind: "none" }
  if (command === CONVERT) return { kind: "edit", edit: result }
  if (command === SHOW_USES)
    return (result as unknown[]).length === 0
      ? { kind: "none" }
      : { kind: "locations", locations: result as unknown[] }
  const { content, language = "markdown" } = result as {
    content: string
    language?: string
  }
  return { kind: "document", language, content }
}
