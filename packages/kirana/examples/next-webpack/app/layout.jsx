import "@kirana-style/core/stylesheet.css"

export const metadata = { title: "Kirana on Next.js (webpack)" }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
