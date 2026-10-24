import {
  ErrorComponent,
  createRouter as createTanStackRouter,
  useRouter,
} from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import {
  isStaleBuildError,
  reloadOnce,
} from "@workspace/docs-core/stale-build.ts"

import { routeTree } from "./routeTree.gen"

/**
 * A page open across a deploy asks for a chunk the deploy removed (`@workspace/docs-core/stale-build.ts`):
 * it loads the page the reader was going to from the new build instead of showing the failure. The
 * destination, not `location`: a loader's chunk fails before the router moves the address, and a
 * reload there would land on the page being left. TanStack Router reloads for a route component's
 * chunk on its own; this covers the docs pages' content, which their loader imports.
 */
function RouteError(props: ErrorComponentProps) {
  const router = useRouter()
  const stale = isStaleBuildError(props.error)
  // Hidden while the page may reload; shown if it reloaded for this address already.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!stale) return
    const destination = new URL(
      router.latestLocation.href,
      window.location.origin
    ).href
    let storage: Storage | undefined
    try {
      storage = window.sessionStorage
    } catch {
      storage = undefined
    }
    const reloaded = reloadOnce({
      href: destination,
      reload: () => window.location.assign(destination),
      storage,
      now: () => Date.now(),
    })
    if (!reloaded && box.current) box.current.hidden = false
  }, [stale, router])
  return (
    <div ref={box} hidden={stale}>
      <ErrorComponent {...props} />
    </div>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
