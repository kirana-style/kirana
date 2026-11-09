import "@kirana-style/core/stylesheet.css"
import { createInertiaApp } from "@inertiajs/react"
import type { ComponentType } from "react"
import { createRoot } from "react-dom/client"

const pages = import.meta.glob<{ default: ComponentType }>("./pages/**/*.tsx", {
  eager: true,
})

createInertiaApp({
  resolve: (name) => pages[`./pages/${name}.tsx`]!,
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
