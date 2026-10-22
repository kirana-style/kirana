import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { Markdown } from "@tanstack/markdown/react"

import { DocsPage } from "@workspace/docs-ui/docs-page.tsx"

import { markdownComponents } from "@/components/markdown"
import {
  MOVED,
  findPage,
  loadDocument,
  neighbours,
  pageHref,
} from "@/lib/pages"

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const href = pageHref(params._splat)
    const moved = MOVED[href]
    if (moved) throw redirect({ href: moved, statusCode: 301 })
    const meta = findPage(href)
    if (!meta) throw notFound()
    return { meta, document: await loadDocument(href) }
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.meta.title} · Kirana` },
            { name: "description", content: loaderData.meta.description },
          ],
        }
      : {},
  component: Page,
})

function Page() {
  const { meta, document } = Route.useLoaderData()
  const { previous, next } = neighbours(meta.href)

  return (
    <DocsPage meta={meta} previous={previous} next={next}>
      <Markdown components={markdownComponents}>{document}</Markdown>
    </DocsPage>
  )
}
