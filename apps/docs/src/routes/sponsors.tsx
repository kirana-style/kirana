import { createFileRoute } from "@tanstack/react-router"

import { Page } from "@/components/site/page"
import { SponsorsPage } from "@/components/sponsors/sponsors-page"

export const Route = createFileRoute("/sponsors")({
  component: Sponsors,
  head: () => ({
    meta: [
      { title: "Sponsor Kirana" },
      {
        name: "description",
        content:
          "Support Kirana monthly or once, as a person or a company, through GitHub Sponsors, Open Collective, Polar or an invoice.",
      },
    ],
  }),
})

function Sponsors() {
  return (
    <Page scene="golden-fields">
      <SponsorsPage />
    </Page>
  )
}
