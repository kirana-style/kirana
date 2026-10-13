/**
 * `<!-- ::start:tabs -->` … `<!-- ::end:tabs -->`: the section's headings become tabs, and what
 * follows each heading its panel (TanStack Markdown splits them, as `md-tab-panel` nodes). Every
 * panel stays in the page, hidden until chosen, so search and the page's markdown twin read all of
 * it. The chosen tab is kept in the address (`?tab=`), so a link can open one.
 */
import { useState, useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"

const styles = {
  root: css({ marginBlockEnd: spacing[8] }),
  list: css({
    // `overflowX: auto` turns the other axis to `auto` too, and the active tab's underline then
    // scrolls the list by a pixel: keep the swipe on narrow screens, without a scrollbar.
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
    maxWidth: "100%",
    borderBlockEndWidth: "1px",
    borderBlockEndStyle: "solid",
    borderBlockEndColor: theme.border,
  }),
  panel: css({ paddingBlockStart: spacing[6] }),
}

type Tab = { slug: string; name: string }

/** The address changes only through `choose`, which sets the state itself. */
const ignore = () => () => {}

export function MarkdownTabs({
  tabs = [],
  children,
}: {
  tabs?: readonly Tab[]
  children?: React.ReactNode
}) {
  const [chosen, setChosen] = useState<string>()
  // The address names a tab only after hydration, so the server and the first render agree.
  const wanted = useSyncExternalStore(
    ignore,
    () => new URLSearchParams(window.location.search).get("tab"),
    () => null
  )
  const value =
    chosen ??
    (tabs.some((tab) => tab.slug === wanted) ? wanted! : tabs[0]?.slug)
  const choose = (next: string) => {
    setChosen(next)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    window.history.replaceState(window.history.state, "", url)
  }
  return (
    <Tabs
      value={value}
      onValueChange={(next) => choose(String(next))}
      sx={styles.root}
      data-slot="markdown-tabs"
    >
      <TabsList variant="line" sx={styles.list}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.slug} value={tab.slug}>
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}

/** One tab's content: rendered always, shown when its tab is chosen. */
export function MarkdownTabPanel({
  "data-tab-slug": slug,
  children,
}: {
  "data-tab-slug"?: string
  children?: React.ReactNode
}) {
  return (
    <TabsContent value={slug} keepMounted sx={styles.panel}>
      {children}
    </TabsContent>
  )
}
