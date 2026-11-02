import "@kirana-style/core/stylesheet.css"
import type { ReactNode } from "react"

export const metadata = { title: "Kirana on vinext" }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
