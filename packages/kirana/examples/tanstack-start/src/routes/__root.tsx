import kiranaCss from "@kirana-style/core/stylesheet.css?url"
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: "utf-8" }, { title: "Kirana on TanStack Start" }],
    links: [{ rel: "stylesheet", href: kiranaCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
