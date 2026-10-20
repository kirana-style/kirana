import "@kirana-style/core/stylesheet.css"
import type { ReactNode } from "react"

// Wraps every page, so Kirana's stylesheet loads once for the whole site.
export default function Root({ children }: { children: ReactNode }) {
  return <>{children}</>
}
