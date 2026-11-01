#!/usr/bin/env node
// The `kirana-style` command. Every subcommand lives in @kirana-style/compiler, which this package
// depends on; `npx kirana-style@latest init` runs it in a project that has nothing installed yet.
import { isatty } from "node:tty"

import { colourOf, main } from "@kirana-style/compiler"

process.exitCode = await main(
  process.argv.slice(2),
  process.cwd(),
  (text) => process.stdout.write(text),
  undefined,
  undefined,
  // Whether standard output is a terminal, asked of the descriptor: `process.stdout` would make a
  // pipe non-blocking, and `lsp` writes that pipe from the engine, which gives up on a full one.
  colourOf({ isTTY: isatty(1) })
)
