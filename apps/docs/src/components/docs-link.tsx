import { Link } from "@tanstack/react-router"
import { props as styleProps } from "@kirana-style/core"
import type { Sx } from "@workspace/ui/lib/sx"

/**
 * A link to a documentation page.
 *
 * Every page is served by the `/docs/$` splat route, so a plain `to="/docs/x"`
 * does not typecheck. This turns an href from the generated manifest into the
 * splat the router expects, and spreads the compiled styles, because `Link` is
 * an installed component and never reads `sx`.
 */
export function DocsLink({
  href,
  sx,
  className,
  children,
  ...rest
}: {
  href: string
  sx?: Sx
  children?: React.ReactNode
} & Omit<React.ComponentProps<"a">, "href" | "sx" | "children">) {
  // `props()` takes class strings too, so a `className` handed down by a
  // component that renders this one (Button's `render`) is merged, not dropped.
  const styled = styleProps(sx, className)

  // The fragment is the router's `hash`, not part of the path: inside the splat
  // it would be encoded (`editor%23hover`) and the page would not be found.
  const [path = href, hash] = href.split("#", 2)
  if (path.startsWith("/docs")) {
    const splat = path.slice("/docs".length).replace(/^\//, "")
    return (
      <Link
        {...rest}
        {...styled}
        to="/docs/$"
        params={{ _splat: splat }}
        hash={hash}
        activeOptions={{ exact: true }}
      >
        {children}
      </Link>
    )
  }
  if (path.startsWith("/")) {
    return (
      <Link
        {...rest}
        {...styled}
        to={path}
        hash={hash}
        activeOptions={{ exact: true }}
      >
        {children}
      </Link>
    )
  }
  return (
    <a {...rest} {...styled} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  )
}
