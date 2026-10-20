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
} from "@hugeicons/core-free-icons"

/** What a partner can provide, in the order the page lists it. An area with `today` and `unlocks`
 * spans the grid's width, for the room its two paragraphs need. */
export type Area = {
  id: string
  title: string
  /** What Kirana uses it for. */
  use: string
  /** What Kirana runs on today without a partner, and where that stops. */
  today?: string
  /** What a partner's service would change. */
  unlocks?: string
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
    id: "ai",
    title: "AI",
    use: "Models and credits for the agent skills, the docs' answers and the work on the compiler.",
    icon: AiBrain01Icon,
  },
  {
    id: "machines",
    title: "Machines for tests and benchmarks",
    use: "Runners for CI on every platform, and a quiet machine for the benchmarks.",
    today:
      "GitHub's free hosted runners: 20 jobs at once and 5 of them macOS, shared by every pull request. So a pull request runs no macOS job: macOS runs once per merge, in the merge queue.",
    unlocks:
      "Every platform on every pull request, a shorter queue for contributors, and benchmarks measured on dedicated hardware instead of shared CI.",
    icon: CpuIcon,
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
