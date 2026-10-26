import path from "node:path"

import { RuleTester } from "eslint"
import { afterAll, describe, it } from "vite-plus/test"

import plugin, { reset, rules } from "../src/index.ts"

RuleTester.describe = describe
RuleTester.it = it

const project = path.join(import.meta.dirname, "fixtures/project")
const file = path.join(project, "case.jsx")
const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
})
const at = <T extends object = object>(code: string, extra?: T) =>
  ({ code, filename: file, ...extra }) as { code: string; filename: string } & T

afterAll(reset)

const CSS =
  'import { css, recipe, props as styleProps } from "@kirana-style/core"\n'

tester.run("diagnostics", rules.diagnostics as never, {
  valid: [
    at(CSS + 'export const a = css({ color: "red" })'),
    // Info diagnostics (a bridged value) are below the default minimum, and names can be ignored.
    at(CSS + "export const a = (w) => css({ width: w })"),
    at(CSS + "export const a = css({ width: 5 })", {
      options: [{ ignore: ["unitless-length"] }],
    }),
    at(
      CSS +
        'export const a = css({ mixBlendMode: "multiply", marginLeft: "1px", marginInlineStart: "1px" })',
      {
        options: [{ minimum: "error" }],
      }
    ),
  ],
  invalid: [
    at(CSS + "export const a = css({ width: 5 })", {
      errors: [
        {
          message:
            /does not accept a bare number \(5\) \(unitless-length\)\. Help: write the unit/,
          line: 2,
          column: 24,
          endColumn: 32,
        },
      ],
    }),
    at(CSS + "export const a = (w) => css({ width: w })", {
      options: [{ minimum: "info" }],
      errors: [{ message: /dynamic-bridged/ }],
    }),
    // UTF-8 bytes before the style: the location is still the property's.
    at(CSS + "// é\nexport const a = css({ width: 5 })", {
      errors: [{ message: /unitless-length/, line: 3, column: 24 }],
    }),
  ],
})

tester.run(
  "diagnostics (project-wide, settings root)",
  rules.diagnostics as never,
  {
    valid: [],
    invalid: [
      {
        code:
          CSS.replace("css,", "css, relation,") +
          'const lone = relation("lone")\nexport const a = css({ color: { [lone.within(":hover")]: "red" } })',
        filename: path.join(project, "lone.jsx"),
        settings: { kirana: { root: path.relative(process.cwd(), project) } },
        errors: [{ message: /relation-without-anchor/, line: 1, column: 1 }],
      },
      // Settings without a root fall back to the nearest configuration.
      at(CSS + "export const a = css({ width: 6 })", {
        settings: { kirana: {} },
        errors: [{ message: /unitless-length/ }],
      }),
    ],
  }
)

tester.run("sort-properties", rules["sort-properties"] as never, {
  valid: [
    at(
      CSS +
        'css({ display: "grid", width: "1px", fontSize: "1px", color: "red", cursor: "x", "--x": "1", "::before": { content: "\'\'" } })'
    ),
    at(
      CSS +
        'css({ color: { base: "a", "@media x": "b", ":hover": "c", "[data-x]": "d" } })'
    ),
    at(CSS + 'css({ ...rest, color: "red", display: "grid" })'),
    at(CSS + 'css({ color: "red" })'),
    at(CSS + 'css(base, { display: "grid" })'),
    at(
      'import * as kirana from "@kirana-style/core"\nimport { css } from "@kirana-style/core"\ncss({ display: "grid", 5: "x", [`plain`]: "x", [true]: 1, [`a${b}`]: 1 })'
    ),
    at(
      CSS +
        'recipe({ ...shared, base: { display: "grid" }, variants: { ...more, size: { ...sizes, sm: { width: "1px" } } } })'
    ),
  ],
  invalid: [
    at(CSS + 'css({ color: "red", display: "grid" })', {
      errors: [{ message: /^display belongs before color \(layout, box/ }],
      output: CSS + 'css({ display: "grid", color: "red" })',
    }),
    at(
      CSS +
        'css({ marginTop: "1px", padding: "1px", ":hover": "x", margin: "1px", textAlign: "x", borderTop: "x", zoom: 1, "::after": {}, "--a": "1" })',
      {
        errors: 1,
        output:
          CSS +
          'css({ margin: "1px", marginTop: "1px", padding: "1px", textAlign: "x", borderTop: "x", zoom: 1, "--a": "1", "::after": {}, ":hover": "x" })',
      }
    ),
    at(CSS + 'css({ scrollMarginTop: "1px", overflowX: "x", width: "1px" })', {
      errors: 1,
      output:
        CSS + 'css({ width: "1px", overflowX: "x", scrollMarginTop: "1px" })',
    }),
    at(
      CSS +
        'css({ color: { "[data-x]": "d", ":hover": "c", [card.within(":focus")]: "e", "@media x": "b", base: "a", [other]: "f", other: "g" } })',
      {
        errors: [{ message: /conditions go base, at-rules, relations/ }],
        output:
          CSS +
          'css({ color: { base: "a", "@media x": "b", [card.within(":focus")]: "e", ":hover": "c", "[data-x]": "d", [other]: "f", other: "g" } })',
      }
    ),
    at(CSS + 'css({ [select.child("a")]: { color: "red" }, color: "blue" })', {
      errors: 1,
      output:
        CSS + 'css({ color: "blue", [select.child("a")]: { color: "red" } })',
    }),
    at(
      CSS +
        'recipe({ base: { color: "red", display: "grid" }, variants: { size: { sm: { color: "red", width: "1px" }, lg: "x" }, other: "y" } })',
      {
        errors: 2,
        output:
          CSS +
          'recipe({ base: { display: "grid", color: "red" }, variants: { size: { sm: { width: "1px", color: "red" }, lg: "x" }, other: "y" } })',
      }
    ),
  ],
})

tester.run("sx-last", rules["sx-last"] as never, {
  valid: [
    at(CSS + "const A = ({ sx }) => <div sx={[root, sx]} />"),
    at(CSS + "const A = ({ sx }) => <div sx={sx} />"),
    at(CSS + "const A = (p) => <div sx={[root, ...rest, p.sx, other]} />"),
    at(CSS + "const A = ({ sx }) => <div {...styleProps(root, sx)} />"),
    at(CSS + "const A = () => <div sx={[root, other]} title='x' />"),
    at(
      CSS +
        "const A = ({ sx, className }) => <div {...styleProps(sx, className)} />"
    ),
  ],
  invalid: [
    at(CSS + "const A = ({ sx }) => <div sx={[root, sx, active && on]} />", {
      errors: [{ message: /^sx is followed by styles that override it/ }],
      output:
        CSS + "const A = ({ sx }) => <div sx={[root, active && on, sx]} />",
    }),
    at(CSS + "const A = (props) => <div {...styleProps(props.sx, root)} />", {
      errors: 1,
      output:
        CSS + "const A = (props) => <div {...styleProps(root, props.sx)} />",
    }),
  ],
})

tester.run("prefer-token", rules["prefer-token"] as never, {
  valid: [
    at(CSS + 'css({ color: "#abcdef", width: 1, height: x })'),
    // A mode token's joined value is not something a literal repeats.
    at(CSS + 'css({ mixBlendMode: "multiply screen" })'),
    // A file is not told to use the tokens it declares itself.
    {
      code: 'import { css, defineTokens } from "@kirana-style/core"\nexport const own = defineTokens("own", { a: "#0af0af" })\ncss({ color: "#0af0af" })',
      filename: path.join(project, "own.jsx"),
    },
  ],
  invalid: [
    at(
      CSS + 'import { color as c } from "./tokens"\ncss({ color: " #0AF " })',
      {
        errors: [
          {
            message:
              '" #0AF " is the value of color.brand; use the token so a theme reaches it.',
            suggestions: [
              {
                desc: "Use color.brand",
                output:
                  CSS +
                  'import { color as c } from "./tokens"\ncss({ color: c.brand })',
              },
            ],
          },
        ],
      }
    ),
    at(
      CSS +
        'css({ color: "#123456", backgroundColor: "#654321", padding: "1rem" })',
      {
        errors: [
          {
            message: /color\.x-y/,
            suggestions: [
              {
                desc: "Use color.x-y",
                output:
                  'import { color } from "./tokens"\n' +
                  CSS +
                  'css({ color: color["x-y"], backgroundColor: "#654321", padding: "1rem" })',
              },
            ],
          },
          {
            message: /color\.500/,
            suggestions: [
              {
                desc: "Use color.500",
                output:
                  'import { color } from "./tokens"\n' +
                  CSS +
                  'css({ color: "#123456", backgroundColor: color[500], padding: "1rem" })',
              },
            ],
          },
          {
            message: /space\.4/,
            suggestions: [
              {
                desc: "Use space.4",
                output:
                  'import { space } from "./tokens"\n' +
                  CSS +
                  'css({ color: "#123456", backgroundColor: "#654321", padding: space[4] })',
              },
            ],
          },
        ],
      }
    ),
    // A group that is not exported where it is declared has no suggestion.
    at(CSS + 'css({ color: "#999999" })', {
      errors: [{ message: /hidden\.a/, suggestions: [] }],
    }),
    // From a file in a subdirectory the import climbs out of it.
    {
      code: CSS + 'css({ color: "light-dark(black, white)" })',
      filename: path.join(project, "nested/case.jsx"),
      errors: [
        {
          message: /color\.ink/,
          suggestions: [
            {
              desc: "Use color.ink",
              output:
                'import { color } from "../tokens"\n' +
                CSS +
                "css({ color: color.ink })",
            },
          ],
        },
      ],
    },
  ],
})

tester.run("finite-bridge", rules["finite-bridge"] as never, {
  valid: [
    at(CSS + 'const size = (w) => css({ width: w })\nsize(x)\nsize("1px")'),
    at(
      CSS + 'const size = (w) => css({ width: w })\nsize("1px")\nsize("2px")',
      { options: [{ max: 1 }] }
    ),
    at(CSS + "const size = (w) => css({ width: w })"),
    at(CSS + "export default (w) => css({ width: w })"),
    at(CSS + "const sizes = [(w) => css({ width: w })]"),
    at(CSS + "const styles = { size: (w) => css({ width: w }) }.size"),
    at(CSS + 'const styles = { "size": (w) => css({ width: w }) }'),
    at(CSS + "call({ size: (w) => css({ width: w }) })"),
    at(CSS + 'const fixed = () => css({ width: "1px" })\nfixed()'),
  ],
  invalid: [
    at(
      CSS +
        'const size = (w) => css({ width: w })\nsize("1px")\nsize("2px")\nsize("1px")',
      {
        errors: [{ message: /^size is only called with "1px" \| "2px"/ }],
      }
    ),
    at(
      CSS +
        'const styles = { size: function (w, h) { return css({ width: w, height: h }) } }\nstyles.size("1px", "2px")\nother.size(x)\nsize(x)',
      {
        errors: [{ message: /^styles\.size is only called with "1px", "2px"/ }],
      }
    ),
  ],
})

tester.run("no-unused", rules["no-unused"] as never, {
  valid: [
    at(
      CSS +
        "const styles = { a: css({}) }\nexport const A = () => <div sx={styles.a} />"
    ),
    at(CSS + 'const styles = { a: css({}) }\nexport const B = styles["a"]'),
    at(CSS + "export const styles = { a: css({}) }"),
    at(CSS + "const styles = { a: css({}) }\nuse(styles)"),
    at(CSS + "const styles = { a: css({}) }\nuse(styles[key])"),
    at(CSS + "const styles = { a: 1 }"),
    at(
      CSS +
        "const other = { styles: 1 }\nconst styles = { a: css({}) }\nuse(styles.a)"
    ),
    at(
      CSS +
        'const button = recipe({ variants: { size: { sm: {}, lg: {} } }, defaultVariants: { size: "sm" } })\nbutton({ size: "lg" })'
    ),
    at(
      CSS +
        "const button = recipe({ variants: { size: { sm: {} } } })\nbutton({ size })"
    ),
    at(
      CSS +
        "const button = recipe({ variants: { size: { sm: {} } } })\nbutton(options)"
    ),
    at(
      CSS +
        "const button = recipe({ variants: { size: { sm: {} } } })\nbutton({ ...options })"
    ),
    at(
      CSS +
        "const button = recipe({ variants: { size: { sm: {} } } })\nuse(button)"
    ),
    at(CSS + "const button = recipe(config)"),
    at(CSS + "const button = recipe({ base: {} })"),
    at(
      CSS +
        'const button = recipe({ variants: { size: sizes, tone: { a: {} } } })\nbutton({ tone: "a" })'
    ),
    at(
      CSS + "export const button = recipe({ variants: { size: { sm: {} } } })"
    ),
    {
      code: CSS + "const styles = { probe: css({}) }",
      filename: path.join(project, "Probe.vue"),
    },
  ],
  invalid: [
    at(
      CSS +
        "const styles = { a: css({}), b: css({}) }\nexport const A = () => <div sx={styles.a} />",
      {
        errors: [
          {
            message: "styles.b is never applied.",
            suggestions: [
              {
                desc: "Remove b",
                output:
                  CSS +
                  "const styles = { a: css({}),  }\nexport const A = () => <div sx={styles.a} />",
              },
            ],
          },
        ],
      }
    ),
    at(CSS + "const styles = { b: css({}), a: css({}) }\nuse(styles.a)", {
      errors: [
        {
          message: "styles.b is never applied.",
          suggestions: [
            {
              desc: "Remove b",
              output: CSS + "const styles = { a: css({}) }\nuse(styles.a)",
            },
          ],
        },
      ],
    }),
    at(
      CSS +
        'const button = recipe({ variants: { size: { sm: {}, lg: {} } } })\nbutton({ size: "sm" })\nbutton()',
      {
        errors: [
          {
            message: 'button\'s size option "lg" is never selected.',
            suggestions: [
              {
                desc: "Remove lg",
                output:
                  CSS +
                  'const button = recipe({ variants: { size: { sm: {},  } } })\nbutton({ size: "sm" })\nbutton()',
              },
            ],
          },
        ],
      }
    ),
  ],
})

tester.run("no-conflicting-props", rules["no-conflicting-props"] as never, {
  valid: [
    at(CSS + 'const A = () => <div className="x" sx={a} />'),
    at(CSS + "const A = () => <div {...styleProps(a)} title='x' {...rest} />"),
    at(CSS + 'const A = () => <div className="x" {...other(a)} />'),
  ],
  invalid: [
    at(
      CSS +
        'const A = () => <Card className="x" {...styleProps(a)} style={s} />',
      {
        errors: [
          {
            message:
              /^The styleProps\(\) spread after this className replaces it/,
          },
          { message: /^This style replaces the one styleProps\(\) returned/ },
        ],
      }
    ),
  ],
})

tester.run(
  "override-keeps-conditions",
  rules["override-keeps-conditions"] as never,
  {
    valid: [
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator sx={css({ alignSelf: { base: "auto", \'[data-orientation="vertical"]\': "auto" } })} />'
      ),
      // Interaction states and compound keys with a pseudo-class are not structural.
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator sx={css({ color: "blue", width: "2px", [k]: "x", "--x": "1" })} />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator sx={other} title="x" />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator sx="p-4" />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator sx={[other(), css(base)]} />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <div sx={css({ alignSelf: "auto" })} />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <Separator />'
      ),
      at(
        CSS +
          'import { Separator } from "./separator"\nconst A = () => <x.Y sx={css({ alignSelf: "auto" })} />'
      ),
      at(
        CSS +
          'import React from "react"\nconst A = () => <Local sx={css({ alignSelf: "auto" })} />'
      ),
    ],
    invalid: [
      at(
        CSS +
          'import { Separator } from "./separator"\nconst override = css({ alignSelf: "auto" })\nconst A = () => <Separator sx={[override]} />',
        {
          errors: [
            {
              message:
                'Separator sets alignSelf under [data-orientation="vertical"]; this plain value does not override it there (Kirana merges per condition).',
              suggestions: [
                {
                  desc: "Set alignSelf under the component's conditions too",
                  output:
                    CSS +
                    'import { Separator } from "./separator"\nconst override = css({ alignSelf: { base: "auto", "[data-orientation=\\"vertical\\"]": "auto" } })\nconst A = () => <Separator sx={[override]} />',
                },
                {
                  desc: "Drop the component's alignSelf entries and set this value",
                  output:
                    CSS +
                    'import { Separator } from "./separator"\nconst override = css({ alignSelf: { "*": null, base: "auto" } })\nconst A = () => <Separator sx={[override]} />',
                },
              ],
            },
          ],
        }
      ),
    ],
  }
)

tester.run("no-classname-on-sx", rules["no-classname-on-sx"] as never, {
  valid: [
    at(
      'import { Spread } from "./spread"\nimport { Plain } from "./plain"\nconst A = () => <><Spread className="x" /><Plain className="y" /><div className="z" /><Spread /></>'
    ),
    at(
      'import { Missing } from "./missing"\nconst A = () => <Missing className="x" />'
    ),
    at(
      'function Local({ className }) { return null }\nconst A = () => <Local className="x" />'
    ),
  ],
  invalid: [
    at(
      'import { Button } from "./button"\nimport { Separator } from "./separator"\nconst A = () => <><Button className="x" /><Button className="y" /><Separator className="z" /></>',
      {
        errors: [
          {
            message:
              "Button reads sx, not className: this class never reaches the DOM. Pass a css() handle through sx.",
          },
          { message: /^Button reads sx/ },
          { message: /^Separator reads sx/ },
        ],
      }
    ),
    at(
      'const Local = function ({ sx }) { return null }\nconst A = () => <Local className="x" />',
      { errors: 1 }
    ),
  ],
})

describe("project root", () => {
  it("falls back when no configuration is above the file", async () => {
    const { expect } = await import("vite-plus/test")
    const { rootOf } = await import("../src/project.ts")
    expect(rootOf("/kirana-nowhere/a/b.jsx", "fallback")).toBe("fallback")
    expect(rootOf(file, "fallback")).toBe(project)
  })

  // KF-026: a linter hands a rule a component's script block; the template, which applies `sx`, is
  // not in it. The block is compiled as the build compiles it, so `useSx()`'s `sx` is not unused.
  it("lints a component's script block clean under oxlint (KF-034)", async () => {
    const { expect } = await import("vite-plus/test")
    const { spawnSync } = await import("node:child_process")
    const { mkdtempSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { createRequire } = await import("node:module")
    const require = createRequire(import.meta.url)
    const oxlint = path.join(
      path.dirname(require.resolve("oxlint/package.json")),
      "bin/oxlint"
    )
    const config = path.join(
      mkdtempSync(path.join(tmpdir(), "kirana-oxlint-")),
      "oxlintrc.json"
    )
    writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [
          {
            name: "kirana",
            specifier: path.join(import.meta.dirname, "../src/index.ts"),
          },
        ],
        rules: { "kirana/diagnostics": "error" },
      })
    )
    const run = spawnSync(
      process.execPath,
      [oxlint, "-c", config, "Button.vue"],
      { cwd: project, encoding: "utf8" }
    )
    expect(run.stdout + run.stderr).not.toContain("unused-sx")
    expect(run.status).toBe(0)
  })

  it("compiles a component's script block as its block module", async () => {
    const { expect } = await import("vite-plus/test")
    const { readFileSync } = await import("node:fs")
    const { inspect } = await import("../src/project.ts")
    const component = path.join(project, "Button.vue")
    const source = readFileSync(component, "utf8")
    const script = source.slice(
      source.indexOf(">") + 1,
      source.indexOf("</script>")
    )
    const context = (filename: string, text: string) =>
      ({ filename, cwd: project, settings: {}, sourceCode: { text } }) as never
    const names = (filename: string, text: string) =>
      inspect(context(filename, text)).diagnostics.map((found) => found.name)
    expect(names(component, script)).toEqual([])
    // Oxlint hands over the block without its leading line break (KF-034); the edges do not count.
    expect(names(component, script.slice(1))).toEqual([])
    expect(names(component, `${script.trim()}\n`)).toEqual([])
    // Text that is no block of the file, and a component that is not on disk, compile as the file.
    expect(names(component, `${script}const extra = 1\n`)).toEqual([
      "unused-sx",
    ])
    expect(names(path.join(project, "Missing.vue"), script)).toEqual([
      "unused-sx",
    ])
  })
})

tester.run("no-dark-variant", rules["no-dark-variant"] as never, {
  valid: [
    at(
      CSS +
        'export const a = css({ color: { base: "black", ":hover": "red" } })'
    ),
    // Outside a style, a media query is the page's own business (a theme toggle reads it).
    at('const dark = matchMedia("(prefers-color-scheme: dark)")'),
    at(
      'import { media } from "@kirana-style/core"\nexport const q = media("(min-width: 40rem)")\nexport const r = media(query)'
    ),
    at(
      'const A = () => <div className="dark" sx={a} class={b} title="dark:x" />'
    ),
  ],
  invalid: [
    at(
      CSS +
        'export const a = css({ color: { base: "black", "@media (prefers-color-scheme: dark)": "white" } })',
      { errors: [{ message: /^prefers-color-scheme follows the system/ }] }
    ),
    at(
      'import { css, media } from "@kirana-style/core"\nexport const a = css({ color: { [media(`(prefers-color-scheme: dark)`)]: "white" } })',
      { errors: [{ message: /^prefers-color-scheme follows the system/ }] }
    ),
    at('const A = () => <div className="p-2 dark:bg-black" class="dark:x" />', {
      errors: [
        { message: /^dark: is a Tailwind variant/ },
        { message: /^dark: is a Tailwind variant/ },
      ],
    }),
  ],
})

tester.run("no-class-helpers", rules["no-class-helpers"] as never, {
  valid: [
    at(CSS),
    at('import { cx } from "@kirana-style/core"\nimport x from "clsx-like"'),
  ],
  invalid: [
    at('import clsx from "clsx"', {
      errors: [{ message: /^clsx joins class strings.*use cx\(\) or sx/ }],
    }),
    at(
      'import { twMerge } from "tailwind-merge"\nimport { cva } from "class-variance-authority"\nimport cn from "classnames/bind"',
      {
        errors: [
          { message: /already merges per property/ },
          { message: /use recipe\(\)/ },
          { message: /^classnames\/bind joins/ },
        ],
      }
    ),
  ],
})

describe("configs under ESLint", () => {
  it("runs every rule over one compiled file", async () => {
    const { expect } = await import("vite-plus/test")
    const { Linter } = await import("eslint")
    const linter = new Linter({ configType: "flat" })
    const config = [
      {
        files: ["**/*.jsx"],
        ...plugin.configs.strict,
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      },
    ]
    const code =
      CSS +
      'const styles = { a: css({ color: "red", display: "grid", width: 5 }), b: css({}) }\nexport const A = ({ sx }) => <div sx={[sx, styles.a]} />'
    const messages = linter.verify(
      code,
      config as never,
      path.join(project, "strict.jsx")
    )
    expect(
      messages
        .map((message) => message.ruleId)
        .sort((a, b) => String(a).localeCompare(String(b)))
    ).toEqual([
      "kirana/diagnostics",
      "kirana/no-unused",
      "kirana/sort-properties",
      "kirana/sx-last",
    ])
  })
})

const RULES = {
  float: { reason: "Use flex or grid." },
  display: { values: ["flex", "grid", "none"] },
  zIndex: { values: [0, 10] },
  "line-height": {},
}

tester.run("restricted-properties", rules["restricted-properties"] as never, {
  valid: [
    // Not configured: the list is the project's own.
    at(CSS + 'export const a = css({ float: "left" })'),
    at(
      CSS +
        'export const a = css({ display: "grid", zIndex: 10, color: "red" })',
      { options: [RULES] }
    ),
    // A token or an expression is the design system's own; a spread, a computed key and a
    // pseudo-element block are not restricted properties themselves.
    at(
      CSS +
        'export const a = css({ display: layout.main, ...rest, [key]: "x", "::before": { display: "flex" }, color: { base: "red", ":hover": "blue" } })',
      { options: [RULES] }
    ),
    at(
      CSS +
        'export const a = css({ display: { base: "flex", ...more, "@media (x)": grid } })',
      { options: [RULES] }
    ),
  ],
  invalid: [
    at(CSS + 'export const a = css({ float: "left", "line-height": 1 })', {
      options: [RULES],
      errors: [
        {
          message: "float is ruled out in this project. Use flex or grid.",
          line: 2,
          column: 24,
        },
        { message: "line-height is ruled out in this project." },
      ],
    }),
    // Each literal of a conditional value, in a recipe too, and a number.
    at(
      CSS +
        'export const b = recipe({ base: { display: { base: "flex", ":hover": "table" } }, variants: { v: { a: { zIndex: 5, "::after": { float: "none" } } } } })',
      {
        options: [RULES],
        errors: [
          {
            message:
              'display takes flex, grid, none in this project, not "table".',
          },
          { message: "zIndex takes 0, 10 in this project, not 5." },
          { message: "float is ruled out in this project. Use flex or grid." },
        ],
      }
    ),
  ],
})

tester.run("use-logical-properties", rules["use-logical-properties"] as never, {
  valid: [
    at(
      CSS +
        'export const a = css({ marginInlineStart: "1px", top: 0, marginTop: "1px", ...rest, [side]: 0, color: { base: "red", ":hover": "blue" } })'
    ),
  ],
  invalid: [
    at(CSS + 'export const a = css({ marginLeft: "1px" })', {
      errors: [
        {
          message:
            "marginLeft stays on the same side in right-to-left text; marginInlineStart follows the writing direction.",
          line: 2,
          column: 24,
          suggestions: [
            {
              desc: "Rename marginLeft to marginInlineStart.",
              output:
                CSS + 'export const a = css({ marginInlineStart: "1px" })',
            },
          ],
        },
      ],
    }),
    // A quoted key keeps its quotes; pseudo-element blocks and recipes are styles too.
    at(
      CSS +
        'export const a = recipe({ base: { "::before": { "borderTopLeftRadius": 0 } }, variants: { v: { a: { right: 0 } } } })',
      {
        errors: [
          {
            message: /^borderTopLeftRadius .* borderStartStartRadius/,
            suggestions: [
              {
                desc: "Rename borderTopLeftRadius to borderStartStartRadius.",
                output:
                  CSS +
                  'export const a = recipe({ base: { "::before": { "borderStartStartRadius": 0 } }, variants: { v: { a: { right: 0 } } } })',
              },
            ],
          },
          {
            message: /^right .* insetInlineEnd/,
            suggestions: [
              {
                desc: "Rename right to insetInlineEnd.",
                output:
                  CSS +
                  'export const a = recipe({ base: { "::before": { "borderTopLeftRadius": 0 } }, variants: { v: { a: { insetInlineEnd: 0 } } } })',
              },
            ],
          },
        ],
      }
    ),
  ],
})

describe("use-logical-properties", () => {
  // The rule's pairs are the compiler's own: every pair the compiler knows for a side or a corner
  // of the inline axis (it reads them for mixed-logical-physical) is here, in camel case. Sizes
  // (`width` and `inlineSize`) are left out: a width does not change in right-to-left text.
  it("covers the compiler's inline-axis pairs", async () => {
    const { expect } = await import("vite-plus/test")
    const { readFileSync } = await import("node:fs")
    const { LOGICAL } = await import("../src/rules/use-logical-properties.ts")
    const source = readFileSync(
      path.join(
        import.meta.dirname,
        "../../../crates/kirana_css_data/src/lib.rs"
      ),
      "utf8"
    )
    const table = source.slice(source.indexOf("pub fn physical_counterpart"))
    const camel = (name: string) =>
      name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    const pairs = [...table.matchAll(/"([a-z-]+)" => "([a-z-]+)",/g)]
      .map(([, logical, physical]) => [camel(physical!), camel(logical!)])
      .filter(([, logical]) =>
        /Inline(Start|End)|StartStart|StartEnd|EndStart|EndEnd/.test(logical!)
      )
    expect(pairs.length).toBeGreaterThan(10)
    for (const [physical, logical] of pairs)
      expect([physical, LOGICAL[physical!]]).toEqual([physical, logical])
  })
})

describe("plugin", () => {
  it("exports every rule and two configs", async () => {
    const { expect } = await import("vite-plus/test")
    expect(Object.keys(plugin.rules)).toHaveLength(13)
    expect(plugin.configs.recommended.plugins.kirana).toBe(plugin)
    expect(Object.keys(plugin.configs.strict.rules)).toHaveLength(11)
    expect(
      plugin.configs.recommended.rules["kirana/sort-properties"]
    ).toBeUndefined()
  })
})
