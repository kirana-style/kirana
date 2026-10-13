import { createFileRoute } from "@tanstack/react-router"

import { Home as HomePage } from "@/components/home/home"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [{ title: "Kirana — Write objects. Read classes. Ship CSS." }],
  }),
})

function Home() {
  return (
    <>
      <SiteHeader />
      <HomePage />
      <SiteFooter />
    </>
  )
}
