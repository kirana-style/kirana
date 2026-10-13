/**
 * How every page is parsed: the docs preset, plus one extension of our own that
 * highlights code blocks at build time.
 *
 * Highlighting happens here, in the generator, and never in the browser: the
 * extension replaces each code node with a `md-code` component node carrying the
 * finished markup and the original source, which `CodeBlock` renders. No grammar
 * reaches the client bundle, and the server and the client render the same tree.
 */
import type {
  BlockNode,
  InlineNode,
  MarkdownExtension,
} from "@tanstack/markdown"
import { docsMarkdownExtensions } from "@tanstack/markdown/extensions/docs"

import {
  highlightInline,
  highlightSource,
  highlightTerminal,
  splitHints,
} from "./highlight.ts"

/** Languages shown as a terminal: every line a command (`bash`), or a session (`console`). */
const COMMANDS = new Set(["sh", "shell", "bash", "zsh"])
const SESSION = new Set(["console", "terminal"])

/**
 * Inline code becomes a `md-inline-code` node with its markup highlighted in the
 * language its text looks like, so `sx={[a, sx]}` in a sentence reads as code.
 */
function inline(node: InlineNode): InlineNode {
  switch (node.type) {
    case "inlineCode":
      return {
        type: "inlineComponent",
        name: "inline-code",
        tagName: "md-inline-code",
        attributes: {},
        children: [],
        properties: { html: highlightInline(node.value), source: node.value },
      }
    case "strong":
    case "emphasis":
    case "strike":
    case "link":
      return { ...node, children: node.children.map(inline) }
    default:
      return node
  }
}

/** A code block's markup and the variant it renders as. */
function codeProperties(
  node: Extract<BlockNode, { type: "code" }>,
  lang: string
): Record<string, string> {
  if (SESSION.has(lang) || COMMANDS.has(lang))
    return {
      html: highlightTerminal(node.value, COMMANDS.has(lang)),
      variant: "terminal",
    }
  if (node.meta && /(^|\s)editor(\s|$)/.test(node.meta)) {
    const { code, hints } = splitHints(node.value)
    return {
      html: highlightSource(code, lang),
      variant: "editor",
      hints: JSON.stringify(hints),
      source: code,
    }
  }
  return {
    html: highlightSource(node.value, lang, {
      ...(node.meta ? { meta: node.meta } : {}),
      ...(node.highlightLines ? { highlightLines: node.highlightLines } : {}),
    }),
  }
}

/** Replaces every code block, at any depth, with a `md-code` node the React map renders. */
const highlightCode: MarkdownExtension = {
  name: "kirana-highlight",
  transformDocument(document) {
    return { ...document, children: document.children.map(block) }
  },
}

function block(node: BlockNode): BlockNode {
  switch (node.type) {
    case "code": {
      const lang = node.lang ?? "plaintext"
      return {
        type: "component",
        name: "code",
        tagName: "md-code",
        attributes: {},
        children: [],
        properties: {
          source: node.value,
          lang,
          ...codeProperties(node, lang),
          ...(node.file ? { file: node.file } : {}),
          ...(node.title ? { title: node.title } : {}),
        },
      }
    }
    // Headings keep plain code: their text is their anchor and their entry in the table of contents.
    case "paragraph":
      return { ...node, children: node.children.map(inline) }
    case "table":
      return {
        ...node,
        header: node.header.map((cell) => ({
          ...cell,
          children: cell.children.map(inline),
        })),
        rows: node.rows.map((row) =>
          row.map((cell) => ({ ...cell, children: cell.children.map(inline) }))
        ),
      }
    // A callout becomes a component node too, so the React map can render it as
    // an Alert instead of the renderer's own `div.markdown-alert`.
    case "callout":
      return {
        type: "component",
        name: "callout",
        tagName: "md-callout",
        attributes: {},
        children: node.children.map(block),
        properties: { kind: node.kind.toLowerCase(), title: node.title },
      }
    case "blockquote":
    case "component":
      return { ...node, children: node.children.map(block) }
    case "list":
      return {
        ...node,
        items: node.items.map((item) => ({
          ...item,
          children: item.children.map(block),
        })),
      }
    case "footnotes":
      return {
        ...node,
        items: node.items.map((item) => ({
          ...item,
          children: item.children.map(block),
        })),
      }
    default:
      return node
  }
}

/** One array, used for parsing and for rendering, as the preset requires. */
export const extensions: MarkdownExtension[] = [
  ...docsMarkdownExtensions(),
  highlightCode,
]
