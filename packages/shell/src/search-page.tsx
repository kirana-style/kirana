import { css } from "@kirana-style/core"
import { Link } from "@tanstack/react-router"
import { Search01Icon } from "@hugeicons/core-free-icons"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"

import { filterNav, flattenNav } from "./nav"
import type { NavGroup } from "./nav"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

const styles = {
  stack: css({
    marginInline: "auto",
    display: "flex",
    width: "100%",
    maxWidth: "48rem",
    flexDirection: "column",
    gap: spacing["6"],
    padding: {
      base: spacing["4"],
      "@media (min-width: 40rem) and (max-width: 63.999rem)": spacing["6"],
      [breakpoint.lg]: spacing["12"],
    },
  }),
  paragraph: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.mutedForeground,
  }),
  stack2: css({
    display: "flex",
    flexDirection: "column",
    gap: spacing["2"],
  }),
  heading: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
  }),
}

export function SearchPage({
  groups,
  query,
  onQueryChange,
}: {
  groups: NavGroup[]
  query: string
  onQueryChange: (query: string) => void
}) {
  const results = filterNav(groups, query)
  const count = flattenNav(results).length

  return (
    <div sx={styles.stack}>
      <InputGroup>
        <InputGroupInput
          autoFocus
          placeholder="Search by name…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <InputGroupAddon>
          <Icon icon={Search01Icon} />
        </InputGroupAddon>
      </InputGroup>
      <p sx={styles.paragraph}>
        {count} {count === 1 ? "result" : "results"}
      </p>
      {count === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing matches “{query}”</EmptyTitle>
            <EmptyDescription>
              Try a shorter or different word.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        results.map((group) => (
          <section key={group.label} sx={styles.stack2}>
            <h2 sx={styles.heading}>{group.label}</h2>
            <ItemGroup>
              {flattenNav([group]).map((item) => (
                <Item
                  key={item.href}
                  variant="outline"
                  size="sm"
                  render={<Link to={item.href} />}
                >
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>
                      {item.description ?? item.href}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </section>
        ))
      )}
    </div>
  )
}
