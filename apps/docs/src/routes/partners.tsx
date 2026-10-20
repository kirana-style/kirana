import { createFileRoute } from "@tanstack/react-router"

import { PartnersPage } from "@/components/partners/partners-page"
import { Page } from "@/components/site/page"

export const Route = createFileRoute("/partners")({
  component: Partners,
  head: () => ({
    meta: [
      { title: "Partners · Kirana" },
      {
        name: "description",
        content:
          "The companies that give Kirana a service it runs on: hosting, machines for tests and benchmarks, email and AI. Listed by what each provides, with no tiers.",
      },
    ],
  }),
})

function Partners() {
  return (
    <Page scene="old-hall">
      <PartnersPage />
    </Page>
  )
}
