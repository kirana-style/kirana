/**
 * Partners: companies that give Kirana a service it runs on, in kind rather than as funding. A
 * sponsor pays for the work and is listed by tier (`/sponsors`); a partner is listed by what it
 * provides, with no tiers, since a service is not an amount.
 */
import type { IconProps } from "@workspace/ui/primitives/icon"
import {
  AiBrain01Icon,
  CloudServerIcon,
  CpuIcon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"

/** What a partner can provide, in the order the page lists it. */
export type Area = {
  id: string
  title: string
  /** What Kirana uses it for. */
  use: string
  icon: IconProps["icon"]
}

export const AREAS: readonly Area[] = [
  {
    id: "hosting",
    title: "Hosting and the edge",
    use: "The site, its Worker and the docs, served close to every reader.",
    icon: CloudServerIcon,
  },
  {
    id: "machines",
    title: "Machines for tests and benchmarks",
    use: "Dedicated runners, so the lab measures on a quiet machine instead of a shared one.",
    icon: CpuIcon,
  },
  {
    id: "email",
    title: "Email",
    use: "Delivery for the project's addresses, and for release and security notices.",
    icon: Mail01Icon,
  },
  {
    id: "ai",
    title: "AI",
    use: "Models and credits for the agent skills, the docs' answers and the work on the compiler.",
    icon: AiBrain01Icon,
  },
]

export type Partner = {
  name: string
  url: string
  /** A logo to show; the name stands in without one. */
  logo?: string
  /** The `AREAS` id of what it provides. */
  area: string
  /** What it provides, in a line: "Workers and static assets for kirana.style". */
  provides: string
}

/** None yet. A partner is added here once the service is in use. */
export const PARTNERS: readonly Partner[] = []

/** Where a company writes to offer a service. */
export const PARTNER_EMAIL = "hello@kirana.style"
