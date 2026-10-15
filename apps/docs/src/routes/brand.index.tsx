import { createFileRoute } from "@tanstack/react-router"

import { BrandPage } from "@/components/brand/brand-page"
import { Page } from "@/components/site/page"

export const Route = createFileRoute("/brand/")({
  component: Brand,
  head: () => ({
    meta: [
      { title: "Brand · Kirana" },
      {
        name: "description",
        content:
          "The Kirana logo, its construction grid and formula, colours, type, and every logo file in SVG and PNG.",
      },
    ],
  }),
})

function Brand() {
  return (
    <Page scene="highlands">
      <BrandPage />
    </Page>
  )
}
