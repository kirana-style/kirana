import { stylesheet } from "@kirana-style/remix"
import { render } from "remix/middleware/render"
import { createRouter } from "remix/router"
import type { MiddlewareContext } from "remix/router"

import controller from "./actions/controller.tsx"
import { assets } from "./assets.ts"
import { routes } from "./routes.ts"

const renderMiddleware = render({ assets })
type AppContext = MiddlewareContext<[typeof renderMiddleware]>

declare module "remix" {
  interface RouterTypes {
    context: AppContext
  }
}

// `stylesheet()` answers /kirana.css from the session that compiled every module.
export const router = createRouter<AppContext>({
  middleware: [stylesheet(), renderMiddleware],
})

router.map(routes, controller)
