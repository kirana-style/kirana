import "@kirana-style/core/stylesheet.css"
import type { ReactNode } from "react"

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <>
      <title>Kirana on Waku</title>
      {children}
    </>
  )
}

export const getConfig = async () => ({ render: "static" }) as const
