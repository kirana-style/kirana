/**
 * The extension in a real VS Code (S6-EDIT-01): downloads VS Code, opens `test/fixture` with the
 * extension under development, and runs `suite.cjs` inside it against the real language server.
 *
 *   bun run test:e2e        # Linux CI runs it under `xvfb-run`
 *
 * The fixture finds its server the way a project does, through `node_modules/.bin/kirana-style`;
 * this script writes that shim to point at this repository's command entry, so the native addon must be
 * built first (`bun run build` in `npm/compiler`).
 */
import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { runTests } from "@vscode/test-electron"

const extension = path.resolve(import.meta.dirname, "../..")
const fixture = path.join(extension, "test/fixture")
const entry = path.resolve(extension, "../../npm/cli/bin/kirana-style.ts")
const bin = path.join(fixture, "node_modules/.bin")
mkdirSync(bin, { recursive: true })
writeFileSync(
  path.join(bin, "kirana-style"),
  `#!/bin/sh\nexec node ${JSON.stringify(entry)} "$@"\n`
)
chmodSync(path.join(bin, "kirana-style"), 0o755)

await runTests({
  extensionDevelopmentPath: extension,
  extensionTestsPath: path.join(import.meta.dirname, "suite.cjs"),
  launchArgs: [
    fixture,
    "--disable-extensions",
    "--skip-welcome",
    "--disable-workspace-trust",
    // Without a display (no Xvfb), Electron's own headless platform still runs the extension host.
    // Hosted Ubuntu runners restrict the unprivileged user namespaces Electron's sandbox needs.
    ...(process.env.CI ? ["--no-sandbox"] : []),
    ...(process.platform === "linux" && !process.env.DISPLAY
      ? ["--ozone-platform=headless", "--disable-gpu"]
      : []),
  ],
})
