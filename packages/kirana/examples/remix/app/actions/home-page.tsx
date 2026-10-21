import { ImportMap } from "remix/component/server"

import { scriptEntry } from "../assets.ts"
import { Probe } from "./public/probe.tsx"

export function HomePage() {
  return () => {
    const { href, importMap, preloads } = scriptEntry
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Kirana on Remix</title>
          <link rel="stylesheet" href="/kirana.css" />
          <ImportMap value={importMap} />
          {preloads.map((preload) => (
            <link key={preload} rel="modulepreload" href={preload} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>
          <Probe />
        </body>
      </html>
    )
  }
}
