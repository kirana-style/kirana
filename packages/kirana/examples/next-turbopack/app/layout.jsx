import "./globals.css"

export const metadata = { title: "Kirana on Next.js (Turbopack)" }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
