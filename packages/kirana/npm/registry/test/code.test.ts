import { describe, expect, it } from "vite-plus/test"

import { hashOf } from "../src/check.ts"
import { againstInstalled, codeHash, codeOf, sameCode } from "../src/code.ts"

/** Each pair is one file as installed and as a formatter leaves it: the same code. */
const same = (file: string, pairs: [string, string][]) => {
  for (const [installed, formatted] of pairs) {
    expect(codeOf(file, installed), installed).toBeDefined()
    expect(codeOf(file, formatted), formatted).toBe(codeOf(file, installed))
  }
}
/** Each pair is two texts of a file whose code differs. */
const differ = (file: string, pairs: [string, string][]) => {
  for (const [one, other] of pairs)
    expect(sameCode(file, one, other), `${one} | ${other}`).toBe(false)
}
/** Texts a kind cannot read: they have no form, and compare byte for byte. */
const unreadable = (file: string, texts: string[]) => {
  for (const text of texts) expect(codeOf(file, text), text).toBeUndefined()
}

describe("KF-136 a file's code with its formatting set aside", () => {
  it("reads TypeScript's quotes, semicolons, commas, numbers and comments as formatting", () => {
    same("a.ts", [
      [
        'const a = { b: "x", c: [1, 2] }\nf(a, b)\n',
        "// a comment\nconst a = {\n    b: 'x', /* and another */\n    c: [1, 2,],\n};\nf(\n    a,\n    b,\n);",
      ],
      [
        '"it\'s \\u0041\\x41\\u{41} \\q\\n\\\n" + "a\\\r\nb"',
        "'it\\'s AAA q\\n' + 'ab'",
      ],
      [
        "x = [1.50, .5, 0XFF, 1_000, 0xFFn]",
        "x = [1.5, 0.5, 255, 1000, 0xffn] // c",
      ],
      ["/a/.test(b)", "/a/.test(b);\n"],
      [
        "x = a / b / c; y = /ab+c/gi.test(s)",
        "x = a/b/c\ny = /ab+c/gi.test(s)",
      ],
      [
        "!/a[/]b/.test(c)\nx = a[0] / 2 + i++ / 2 + a! / 2 + (b) / 2",
        "!/a[/]b/.test(c);\nx = a[0]/2 + i++/2 + a!/2 + (b)/2;",
      ],
      [
        "const t = `a${ b }c${`d${e}`}`\r\nconst u = `x\r\ny`",
        "const t = `a${b}c${`d${e}`}`\nconst u = `x\ny`",
      ],
      [
        "let m: Map<string, Array<number>>",
        "let m: Map<\n  string,\n  Array<number>\n>",
      ],
      [
        "const k = { 'a': 1, 'b-c': 2, d: 3 }",
        "const k = { a: 1, 'b-c': 2, \"d\": 3 }",
      ],
      [
        'type P = { "a"?: string; b: number }',
        "type P = {\n  a?: string\n  b: number\n}",
      ],
      [
        'type A = "a" | "b"\nconst c = x as A | B',
        'type A =\n  | "a"\n  | "b"\nconst c = x as\n  | A\n  | B',
      ],
      [
        "switch (a) { case 'b': x = c ? 'd' : 'e' }",
        'switch (a) {\n  case "b":\n    x = c ? "d" : "e"\n}',
      ],
    ])
    differ("a.ts", [
      ["const a = 1", "const a = 2"],
      ["a + b", "a - b"],
      ['x = c ? "d" : e', "x = c ? d : e"],
      ["case 'b': x", "case b: x"],
      ["a + +b", "a ++b"],
      ["`a${b}`", "`a${c}`"],
    ])
  })

  it("reads the parentheses formatters add or drop, and keeps the ones that change code", () => {
    same("a.ts", [
      [
        "function f() { return (\n  a && b\n) }",
        "function f() {\n  return a && b\n}",
      ],
      [
        "const f = (x) => x\nconst g = async (y) => y",
        "const f = x => x\nconst g = async y => y",
      ],
      [
        "const f = (part) => (part.type === 'text' ? part : undefined)\nconst g = 1",
        "const f = (part) =>\n  part.type === 'text' ? part : undefined\nconst g = 1",
      ],
      ["x = a ? (b ? c : d) : (e)", "x = a ? b ? c : d : e"],
      [
        "const p = (getContext(K) ?? null)\n$effect(f)",
        "const p = getContext(K) ?? null\n$effect(f)",
      ],
      ["f({ ...(props() as P) })", "f({ ...props() as P })"],
      ["f((\n  value,\n) => value)", "f(value => value)"],
      [
        "@D() class A { x = (1)\n@E() y = 2 }",
        "@D() class A { x = 1\n@E() y = 2 }",
      ],
      ["export default () => (x)", "export default () => x"],
    ])
    differ("a.ts", [
      ["x = (a + b) * c", "x = a + b * c"],
      ["const f = () => ({})", "const f = () => {}"],
      ["f = (a) as T", "f = a as T"],
      ["return (a).b", "return a.b"],
      [")", "("],
    ])
  })

  it("sorts imports and the names in each, as import sorting does", () => {
    same("a.ts", [
      [
        'import { b, a } from "x"\nimport c from "y"\nimport "side"\nimport type { T } from "z"\nimport x = require("w")',
        'import "side"\nimport type { T } from "z"\nimport c from "y"\nimport {\n  a,\n  b,\n} from "x"\nimport x = require("w")',
      ],
      [
        'const m = import("x")\nconst u = import.meta.url\nfunction f() { import("y") }',
        "const m = import('x'); const u = import.meta.url\nfunction f() {\n  import('y')\n}",
      ],
    ])
    differ("a.ts", [['import { a } from "x"', 'import { b } from "x"']])
  })

  it("reads a child of comments one way only, so a long run of them cannot stall it", () => {
    same("a.tsx", [
      [
        "const a = <div>{/* a */ /** b ** c */}</div>",
        "const a = (\n  <div>\n    {/* a */\n    /** b ** c */}\n  </div>\n)",
      ],
    ])
    // A lazy comment body inside the repeated group backtracked exponentially on this.
    codeOf("a.tsx", `const a = <div>{/*${"*//*".repeat(5000)}x</div>`)
  })

  it("reads JSX text as React does, and the parentheses around JSX", () => {
    same("a.tsx", [
      [
        "const a = <div className='a' id={\"b\"}>Hello <b>x</b> world</div>",
        'const a = (\n  <div className="a" id="b">\n    Hello{" "}\n    <b>x</b>{" "}\n    world\n  </div>\n)',
      ],
      [
        "function F() { return <><A.B {...props} icon=<I /> /><C>{a ? <D /> : null}</C>{/* c */}{'t'}\n\t</> }",
        'function F() {\n  return (\n    <>\n      <A.B\n        {...props}\n        icon=<I />\n      />\n      <C>{a ? <D /> : null}</C>\n      {/* c */}\n      {"t"}\n    </>\n  )\n}',
      ],
      [
        'x = cond && (\n  <A b={() => <B />} c="1\r\n2" />\n)',
        'x = cond && <A b={() => <B />} c="1\n2" />',
      ],
      [
        "const f = <T,>(x: T) => x\nconst g = <T extends U>(x: T) => x",
        "const f = <T,>(x: T) => x;\nconst g = <T extends U>(x: T) => x;",
      ],
      [
        "x = <List<{ a: () => void }> items={i} />",
        "x = (\n  <List<{ a: () => void; }>\n    items={i}\n  />\n)",
      ],
      ["x = <p>\n  one\n  \n  two  \n</p>", "x = <p>one two</p>"],
    ])
    differ("a.tsx", [
      ["x = <p>a b</p>", "x = <p>ab</p>"],
      ["x = <A b />", "x = <A c />"],
    ])
    unreadable("a.tsx", [
      "x = <div>text",
      "x = <div a=1 />",
      'x = <div "a" />',
      'x = <div a="b />',
      "x = <div></div",
      "x = <div>< 3</div>",
      "x = <List<T",
      "x = <div a=<3 />",
    ])
  })

  it("has no form for a file its kind cannot read, or a kind it does not know", () => {
    unreadable("a.ts", [
      "/* open",
      '"open',
      "`open",
      "`open ${a",
      "x = /open",
      "`a\\",
    ])
    expect(codeOf("README.md", "# x")).toBeUndefined()
    expect(codeOf("Makefile", "x")).toBeUndefined()
    expect(codeHash("README.md", "# x")).toBeUndefined()
    expect(codeHash("a.ts", "x")).toBe(hashOf("x"))
    expect(sameCode("README.md", "x", "x")).toBe(true)
    expect(sameCode("README.md", "x", "x\n")).toBe(false)
    expect(sameCode("a.ts", "/* open", "/* open\n")).toBe(false)
  })

  it("reads JSON, CSS, SCSS and Less", () => {
    same("tsconfig.json", [
      [
        '{"a": [1, 2], "b": {"c": true}}',
        '{\n  // c\n  "a": [1, 2,],\n  "b": { "c": true },\n}\n',
      ],
    ])
    same("a.css", [
      [
        "a>b,c{color:RED;margin:0.50px .5em;background:url( a.png )}[type=text]{content:'it\\'s'}",
        'a > b,\nc {\n  /* c */\n  color: RED;\n  margin: 0.5px 0.5em;\n  background: url(a.png);\n}\n\n[type="text"] {\n  content: "it\'s";\n}\n',
      ],
      [
        ".a{width:calc(1px + 2px);grid-area:1/2;color:#FFF!important;;}",
        ".a {\n  width: calc(1px+2px);\n  grid-area: 1 / 2;\n  color: #FFF !important;\n}",
      ],
      [
        '@import url("a.css");.b{width:10%}',
        "@import url('a.css');\n.b {\n  width: 10%;\n}",
      ],
    ])
    differ("a.css", [
      [".a .b{}", ".a.b{}"],
      [".a{color:red}", ".a{color:blue}"],
      [".a{color:red}", ".a{color:red}// c"],
    ])
    unreadable("a.css", [
      "/* open",
      '.a{content:"open}',
      ".a{background:url(open}",
    ])
    same("a.scss", [[".a { // c\n  color: red; }// end", ".a{color:red}"]])
    same("a.less", [[".a { color: red }", ".a {\n  color: red;\n}\n"]])
  })

  it("reads Vue's markup, its directives, script and style", () => {
    same("A.vue", [
      [
        '<script setup lang="ts" generic="T extends string">\nimport { b, a } from "x"\nconst n = ref(0)\n</script>\n<template>\n  <div :class="{ a: true }" @click="n++" class=\'x\' style="color:red">{{n}} items &lt; 3</div>\n  <br/>\n  <!-- c -->\n</template>\n<style lang="scss">\n.a{color:red} // c\n</style>\n',
        '<script setup lang="ts" generic="\n  T extends string\n">\nimport { a, b } from \'x\'\nconst n = ref(0);\n</script>\n\n<template>\n  <div\n    :class="{ a: true }"\n    @click="n++"\n    class="x"\n    style="color: red"\n  >\n    {{ n }} items &lt; 3\n  </div>\n  <br />\n</template>\n\n<style lang="scss">\n.a {\n  color: red;\n}\n</style>\n',
      ],
      [
        "<template><p v-if=\"a == 'b'\" a=c>x</p></template>",
        '<template>\n  <p v-if="a == &quot;b&quot;" a="c">x</p>\n</template>'.replace(
          "&quot;b&quot;",
          "'b'"
        ),
      ],
      [
        '<script lang="tsx">const a = <A />\n</script>',
        '<script lang="tsx">\nconst a = <A />;\n</script>',
      ],
    ])
    differ("A.vue", [
      [
        "<template><p>{{ a }}</p></template>",
        "<template><p>{{ b }}</p></template>",
      ],
    ])
    unreadable("A.vue", [
      "<template><!-- open</template>",
      "<template><p></p</template>",
      '<template><p "a"></p></template>',
      "<template><p a=></p></template>",
      "<script>const a = 1",
      "<template>{{ open</template>",
    ])
  })

  it("reads Svelte's blocks and expressions, and Astro's frontmatter", () => {
    same("A.svelte", [
      [
        '<script lang="ts">\n  let { data, ...rest } = $props()\n</script>\n\n{#if data}<Comp data={data} {...rest} class="a {b} c" on:click={() => f()} x=y />{:else}<p>{"none"}</p>{/if}\n<p class="{b}">{@html c}</p><style>.a{color:red}</style>',
        '<script lang="ts">\n  let { data, ...rest } = $props();\n</script>\n\n{#if data}\n  <Comp\n    {data}\n    {...rest}\n    class="a {b} c"\n    on:click={() => f()}\n    x="y"\n  />\n{:else}\n  <p>{\'none\'}</p>\n{/if}\n<p class="{b}">{@html c}</p>\n\n<style>\n  .a {\n    color: red;\n  }\n</style>\n',
      ],
    ])
    differ("A.svelte", [["<Comp a={b} />", "<Comp {a} />"]])
    same("A.astro", [
      [
        '---\nimport A from "./A.astro"\nconst xs = [1]\n---\n<ul>{xs.map((x) => <li>{x}</li>)}</ul>',
        "---\nimport A from './A.astro';\nconst xs = [1];\n---\n\n<ul>\n  {xs.map(x => (\n    <li>{x}</li>\n  ))}\n</ul>\n",
      ],
      ["<p>no frontmatter</p>", "<p>\n  no frontmatter\n</p>"],
    ])
  })

  it("reads Angular's templates: control flow, bindings and an inline template", () => {
    same("a.html", [
      [
        '<!DOCTYPE html>\n@if (a === "b") {<p [x]="a ? \'b\' : c" (click)="go()" *ngIf="y">{{ a | async }}</p>} @else if (c) {<input/>} @else {<span>z</span>}\n@for (i of xs; track i.id) {<li>{{i}}</li>}<p>me@home</p>',
        '<!DOCTYPE html>\n@if (a === \'b\') {\n  <p [x]="a ? \'b\' : c" (click)="go()" *ngIf="y">{{ a | async }}</p>\n} @else if (c) {\n  <input />\n} @else {\n  <span>z</span>\n}\n@for (i of xs; track i.id) {\n  <li>{{ i }}</li>\n}\n<p>me@home</p>\n',
      ],
    ])
    same("a.ts", [
      [
        '@Component({ template: `<p [a]="b">{{c}}</p>` })\nclass A {}',
        '@Component({\n  template: `\n    <p [a]="b">{{ c }}</p>\n  `,\n})\nclass A {}',
      ],
      [
        '@Component({ template: `<p class="${CLASS}">{{c}}</p>` })\nclass A {}',
        '@Component({\n  template: `\n    <p class="${CLASS}">\n      {{ c }}\n    </p>\n  `,\n})\nclass A {}',
      ],
    ])
    differ("a.ts", [
      ["x = { template: `<p>a</p>` }", "x = { template: `<p>b</p>` }"],
      ["x = { t: `<p>a</p>` }", "x = { t: `<p>\n  a\n</p>` }"],
    ])
  })

  it("tells how a project's file stands against what was installed", () => {
    const installed = 'export const a = "x"\n'
    const formatted = "export const a = 'x';\n"
    const was = {
      written: hashOf(installed),
      code: codeHash("a.ts", installed),
    }
    expect(againstInstalled("a.ts", installed, was)).toBe("same")
    expect(againstInstalled("a.ts", formatted, was)).toBe("reformatted")
    expect(againstInstalled("a.ts", "export const a = 1\n", was)).toBe(
      "changed"
    )
    // A lockfile without `code`: the text installing writes now, when it is what was written.
    const old = { written: hashOf(installed) }
    expect(againstInstalled("a.ts", formatted, old)).toBe("changed")
    expect(againstInstalled("a.ts", formatted, old, installed)).toBe(
      "reformatted"
    )
    expect(
      againstInstalled("a.ts", formatted, old, 'export const a = "y"\n')
    ).toBe("changed")
    expect(
      againstInstalled("a.md", "# b\n", { written: hashOf("# a\n") }, "# a\n")
    ).toBe("changed")
  })
})
