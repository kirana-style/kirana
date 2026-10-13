import "@kirana-style/core/stylesheet.css"
import { component$ } from "@qwik.dev/core"
import { DocumentHeadTags, RouterOutlet, useQwikRouter } from "@qwik.dev/router"

export default component$(() => {
  useQwikRouter()
  return (
    <>
      <head>
        <meta charset="utf-8" />
        <title>Kirana on Qwik</title>
        <DocumentHeadTags />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </>
  )
})
