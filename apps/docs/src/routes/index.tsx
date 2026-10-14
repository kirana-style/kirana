import { createFileRoute } from "@tanstack/react-router"

import { Home as HomePage } from "@/components/home/home"
import { Page } from "@/components/site/page"

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [{ title: "Kirana: write objects, read classes, ship CSS" }],
  }),
})

function Home() {
  return (
    <Page scene="highlands">
      <HomePage />
    </Page>
  )
}
