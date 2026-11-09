import kiranaCss from "@kirana-style/core/stylesheet.css?url"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/solid-router"
import type { JSX } from "solid-js"
import { HydrationScript } from "solid-js/web"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charset: "utf-8" },
      { title: "Kirana on TanStack Start with Solid" },
    ],
    links: [{ rel: "stylesheet", href: kiranaCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        {props.children}
        <Scripts />
      </body>
    </html>
  )
}
