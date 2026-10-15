import { parseMarkdown } from "@tanstack/markdown/parser"
import { describe, expect, it } from "vite-plus/test"

import {
  enrich,
  highlightInline,
  highlightSource,
  highlightTerminal,
  inlineLang,
  splitHints,
} from "../src/highlight.ts"
import { extensions } from "../src/markdown.ts"

/** The text of every token span of a kind, in order. */
const tokens = (html: string, kind: string) =>
  [...html.matchAll(new RegExp(`th-${kind}">([^<]*)<`, "g"))].map(
    (match) => match[1]
  )

describe("highlighting names the grammar leaves plain", () => {
  it("colours calls, members, keys, JSX tags and attributes, and leaves bindings alone", () => {
    const html = highlightSource(
      'const card = css({ display: "grid" })\nexport const Card = () => <p sx={[styles.card, ...rest]} />',
      "tsx"
    )
    expect(tokens(html, "function")).toEqual(["css"])
    expect(tokens(html, "property")).toEqual(["display", "card"])
    expect(tokens(html, "tag")).toEqual(["p"])
    expect(tokens(html, "attr")).toEqual(["sx"])
    // `card` after `const`, and `rest` after a spread, are names, not attributes or members.
    expect(html).toContain("</span> card = ")
    expect(html).toContain("...rest")
  })

  it("colours a command line's flags, and leaves other languages as the grammar wrote them", () => {
    expect(
      tokens(enrich("kirana-style init --dry-run -y", "bash"), "attr")
    ).toEqual(["--dry-run", "-y"])
    expect(enrich("a { color: red }", "css")).toBe("a { color: red }")
  })
})

describe("inline code", () => {
  it("guesses the language from the text", () => {
    expect(inlineLang("kirana-style init")).toBe("shell")
    expect(inlineLang("--dry-run")).toBe("shell")
    expect(inlineLang("package.json")).toBe("plaintext")
    expect(inlineLang("@kirana-style/preset-scales")).toBe("plaintext")
    expect(inlineLang("@layer kirana")).toBe("css")
    expect(inlineLang("var(--gap)")).toBe("css-value")
    expect(inlineLang("--kvRYYL")).toBe("css-value")
    expect(inlineLang("hover:bg-blue-600/50")).toBe("utility")
    expect(inlineLang("grid gap-4 p-4")).toBe("utility")
    expect(inlineLang("w-(--sidebar-width)")).toBe("utility")
    expect(inlineLang("styles.card")).toBe("tsx")
    expect(inlineLang("css({})")).toBe("tsx")
    expect(inlineLang("Card")).toBe("tsx")
  })

  it("colours each kind of span", () => {
    expect(highlightInline("--install")).toBe(
      '<span class="th-token th-attr">--install</span>'
    )
    expect(highlightInline("kirana.config.json")).toBe("kirana.config.json")
    expect(
      tokens(highlightInline("calc(<value> * -1.5rem)"), "function")
    ).toEqual(["calc"])
    expect(
      tokens(highlightInline("calc(<value> * -1.5rem)"), "comment")
    ).toEqual(["&lt;value&gt;"])
    expect(
      tokens(highlightInline("calc(<value> * -1.5rem)"), "number")
    ).toEqual(["-1.5rem"])
    expect(tokens(highlightInline("var(--gap)"), "variable")).toEqual(["--gap"])
    const utility = highlightInline(
      "data-[state=open]:p-4 bg-blue-600/50 w-(--x) p-[3px]"
    )
    expect(tokens(utility, "attr")).toEqual(["data-[state=open]:"])
    expect(tokens(utility, "number")).toEqual(["4", "600", "/50"])
    expect(tokens(utility, "variable")).toEqual(["(--x)"])
    expect(tokens(utility, "string")).toEqual(["[3px]"])
    expect(tokens(highlightInline("kirana-style lsp"), "command")).toEqual([
      "kirana-style",
    ])
  })
})

describe("terminal sessions", () => {
  it("puts a prompt before commands and colours output the way a terminal does", () => {
    const html = highlightTerminal(
      [
        "$ kirana-style check src",
        "error[KRN1401] relation-without-anchor: never applied (a.tsx)",
        "warning[KRN1703] sx-on-external-component: not read",
        "error: plain",
        "  help: apply relation.anchor",
        "✓ engine       native",
        "All good.",
        "✗ packages     missing",
        "! types        not set up",
        "--- next.config.ts",
        "+ import x",
        "- export y",
        "  …",
        "1 diagnostic(s), 1 error(s)",
        "plain <text>",
        "",
      ].join("\n")
    )
    const lines = html.split("\n")
    expect(lines).toHaveLength(15)
    expect(lines[0]).toMatch(
      /^<span class="th-token th-prompt">\$<\/span> <span class="th-token th-command">kirana/
    )
    expect(tokens(html, "deleted")).toEqual([
      "error[KRN1401]",
      "error",
      "✗",
      "- export y",
    ])
    expect(tokens(html, "type")).toEqual(["warning[KRN1703]", "!"])
    expect(tokens(html, "strong")).toEqual([
      " relation-without-anchor",
      " sx-on-external-component",
      "",
      "--- next.config.ts",
    ])
    expect(tokens(html, "inserted")).toEqual([
      "help:",
      "✓",
      "All good.",
      "+ import x",
    ])
    expect(tokens(html, "comment")).toEqual([
      "  …",
      "1 diagnostic(s), 1 error(s)",
    ])
    expect(lines.at(-1)).toBe("plain &lt;text&gt;")
  })

  it("treats every line of a shell block as a command, except comments and blank lines", () => {
    const html = highlightTerminal(
      "kirana-style init\n\n# a note\nkirana-style doctor\n",
      true
    ).split("\n")
    expect(html[0]).toContain("th-prompt")
    expect(html[1]).toBe("")
    expect(html[2]).not.toContain("th-prompt")
    expect(html[3]).toContain("th-prompt")
  })
})

describe("editor blocks", () => {
  it("takes the //: notes off the lines they end", () => {
    expect(splitHints("<a sx={x}> //: grid · p 1rem\n<b />\n")).toEqual({
      code: "<a sx={x}>\n<b />",
      hints: [{ line: 0, text: "grid · p 1rem" }],
    })
  })
})

describe("the markdown pipeline", () => {
  const parse = (source: string) => parseMarkdown(source, { extensions })

  it("highlights inline code in paragraphs, emphasis, links and tables, not in headings", () => {
    const document = parse(
      "# Title `css()`\n\nText `sx={a}`, **bold `p-4`** and [a `b`](/x).\n\n| A |\n| - |\n| `c()` |\n"
    )
    const json = JSON.stringify(document.children)
    expect(json.match(/md-inline-code/g)).toHaveLength(4)
    expect(JSON.stringify(document.children[0])).not.toContain("md-inline-code")
  })

  it("renders shell blocks and sessions as terminals, and `editor` blocks with hints", () => {
    const document = parse(
      [
        "```bash",
        "kirana-style init",
        "```",
        "",
        "```console",
        "$ kirana-style check src",
        "```",
        "",
        '```tsx editor file="a.tsx"',
        "<a sx={x} /> //: grid",
        "```",
        "",
        '```tsx title="b.tsx" {1}',
        "const a = 1",
        "```",
        "",
        "> quote",
        "",
        "- item `x()`",
      ].join("\n")
    )
    const [bash, session, editor, plain] = document.children as {
      properties: Record<string, string>
    }[]
    expect(bash!.properties.variant).toBe("terminal")
    expect(session!.properties.variant).toBe("terminal")
    expect(editor!.properties).toMatchObject({
      variant: "editor",
      hints: '[{"line":0,"text":"grid"}]',
      source: "<a sx={x} />",
      file: "a.tsx",
    })
    expect(plain!.properties.variant).toBeUndefined()
    expect(plain!.properties.title).toBe("b.tsx")
  })
})
