import { createFileRoute } from "@tanstack/react-router"

import { MarkPage } from "@/components/brand/mark-page"
import { Page } from "@/components/site/page"

export const Route = createFileRoute("/brand/mark")({
  component: BrandMark,
  head: () => ({
    meta: [
      { title: "The petal K · Brand · Kirana" },
      {
        name: "description",
        content:
          "The petal K logo direction: its 16 × 21 grid, Fibonacci circles and rules, its balance, and how closely it follows the reference drawing.",
      },
    ],
  }),
})

function BrandMark() {
  return (
    <Page scene="highlands">
      <MarkPage />
    </Page>
  )
}
