import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vite-plus/test"

import { main, NODE_HELP } from "../src/cli.ts"

const root = mkdtempSync(path.join(tmpdir(), "kirana-help-"))
// A configuration that does not load: no help may need it.
writeFileSync(path.join(root, "package.json"), '{"name":"app"}')
writeFileSync(path.join(root, "kirana.config.json"), "{ not json")
afterAll(() => rmSync(root, { recursive: true, force: true }))

async function run(...argv: string[]) {
  let text = ""
  const code = await main(argv, root, (chunk) => void (text += chunk))
  return { code, text }
}

/** The commands `kirana-style --help` lists, each with its line. */
function listed(help: string): Map<string, string> {
  const commands = help.split("Commands:\n")[1]!.split("\n\n")[0]!
  return new Map(
    commands.split("\n").map((line) => {
      const [, name, text] = /^ {2}(\S+)\s+(.*)$/.exec(line)!
      return [name!, text!]
    })
  )
}

describe("KRN-DX-008 one --help for every command", () => {
  it("lists every command the CLI dispatches, and each one answers --help", async () => {
    const { code, text } = await run("--help")
    expect(code).toBe(0)
    const commands = listed(text)
    // The commands run here are listed with the first line of their own help.
    for (const [name, help] of Object.entries(NODE_HELP))
      expect(commands.get(name)).toBe(help.split("\n")[0])
    for (const name of commands.keys()) {
      const answer = await run(name, "--help")
      expect(`${name}: ${answer.code}`).toBe(`${name}: 0`)
      expect(answer.text).toMatch(new RegExp(`Usage: kirana-style ${name}\\b`))
    }
    // Each command the engine does not run is one this package dispatches itself, and the other way.
    const engine = [...commands.keys()].filter(
      (name) => !Object.hasOwn(NODE_HELP, name)
    )
    expect(engine).toEqual([
      "check",
      "build",
      "analyze",
      "export",
      "trace",
      "migrate",
      "lsp",
    ])
  })

  it("answers -h, help <command> and no command without a configuration", async () => {
    expect(await run("init", "-h")).toEqual({ code: 0, text: NODE_HELP.init })
    expect(await run("help", "doctor")).toEqual({
      code: 0,
      text: NODE_HELP.doctor,
    })
    expect(await run("help", "ui")).toEqual({ code: 0, text: NODE_HELP.ui })
    expect((await run("help", "check")).text).toContain(
      "Usage: kirana-style check"
    )
    expect((await run("help")).text).toContain("Commands:")
    expect((await run("migrate", "tailwind", "-h")).text).toContain(
      "Usage: kirana-style migrate tailwind"
    )
    // No command prints the list, as a mistake: exit 2.
    const none = await run()
    expect(none.code).toBe(2)
    expect(none.text).toContain("Commands:")
  })

  it("names no internal specification or decision id in any help", async () => {
    const texts = [(await run("--help")).text, ...Object.values(NODE_HELP)]
    for (const name of listed(texts[0]!).keys())
      texts.push((await run(name, "--help")).text)
    expect(texts.join("\n")).not.toMatch(
      /\b(KRN-[A-Z]+-\d+|D-\d{3}|KF-\d{3}|E-\d{2})\b/
    )
  })
})
