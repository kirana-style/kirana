#!/usr/bin/env node
// `npx kirana-style <command>`: the `kirana` command of @kirana-style/compiler, under a package name
// npm can give it, for a project that does not have Kirana installed yet. Once `init` has added
// @kirana-style/compiler, the project runs its own `kirana`.
import { main } from "@kirana-style/compiler"

process.exitCode = await main(process.argv.slice(2), process.cwd(), (text) =>
  process.stdout.write(text)
)
