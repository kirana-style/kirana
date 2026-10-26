#!/usr/bin/env node
// `kirana-style ui` from this package itself, for a folder with nothing installed yet (KF-035):
// `npx @kirana-style/registry init --template vite-react my-app`. In a project that has the package,
// `kirana-style ui` runs the project's copy instead (D-103).
import { main } from "../src/index.ts"

process.exitCode = await main(process.argv.slice(2), process.cwd(), (text) =>
  process.stdout.write(text)
)
