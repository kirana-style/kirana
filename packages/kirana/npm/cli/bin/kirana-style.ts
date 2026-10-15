#!/usr/bin/env node
// The `kirana-style` command. Every subcommand lives in @kirana-style/compiler, which this package
// depends on; `npx kirana-style@latest init` runs it in a project that has nothing installed yet.
import { main } from "@kirana-style/compiler"

process.exitCode = await main(process.argv.slice(2), process.cwd(), (text) =>
  process.stdout.write(text)
)
