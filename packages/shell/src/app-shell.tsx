import { css } from "@kirana-style/core"
import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { flattenNav } from "./nav"
import type { NavGroup, NavItem } from "./nav"
import { SearchCommand } from "./search-command"
import { ThemeToggle } from "./theme-toggle"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { duration, easing } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"
import { peer } from "@workspace/ui/theme/markers"

const styles = {
  text: css({
    display: "flex",
    width: spacing["8"],
    height: spacing["8"],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: theme.primary,
    fontFamily: fontFamily.heading,
    color: theme.primaryForeground,
  }),
  text2: css({
    display: "flex",
    flexDirection: "column",
    gap: spacing["0.5"],
    lineHeight: 1,
  }),
  text3: css({
    fontWeight: fontWeight.medium,
  }),
  text4: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  chevron: css({
    marginInlineStart: "auto",
    transitionProperty: "rotate",
    transitionDuration: duration["200"],
    transitionTimingFunction: easing.inOut,
    // The Collapsible carries the default marker; `data-open` is Base UI's.
    rotate: { [peer.within("[data-open]")]: "90deg" },
  }),
  sidebarInset: css({
    minWidth: "0px",
  }),
  header: css({
    position: "sticky",
    top: "0px",
    zIndex: 10,
    display: "flex",
    height: spacing["14"],
    flexShrink: 0,
    alignItems: "center",
    gap: spacing["2"],
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    backgroundColor: theme.background,
    paddingInline: spacing["4"],
    borderBottomColor: theme.border,
  }),
  separator: css({
    marginInlineStart: spacing["1"],
    marginInlineEnd: spacing["1"],
    // The same condition as the Separator's own entries, so these replace them
    // rather than sit beside them.
    height: { '[data-orientation="vertical"]': spacing["4"] },
    alignSelf: { '[data-orientation="vertical"]': "auto" },
  }),
  text5: css({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  row: css({
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
    gap: spacing["2"],
  }),
  box: css({
    minWidth: "0px",
    flex: 1,
  }),
}

export function AppShell({
  appName,
  groups,
  children,
}: {
  appName: string
  groups: NavGroup[]
  children: React.ReactNode
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const current = flattenNav(groups).find((item) => item.href === pathname)

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/" />}>
                <span sx={styles.text}>{appName.slice(0, 1)}</span>
                <span sx={styles.text2}>
                  <span sx={styles.text3}>{appName}</span>
                  <span sx={styles.text4}>shadcn/ui</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) =>
                    item.items ? (
                      <NavCollapsible
                        key={item.title}
                        item={item}
                        pathname={pathname}
                      />
                    ) : (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={item.href === pathname}
                          render={<Link to={item.href} />}
                        >
                          {item.title}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset sx={styles.sidebarInset}>
        <header sx={styles.header}>
          <SidebarTrigger />
          <Separator orientation="vertical" sx={styles.separator} />
          <span sx={styles.text5}>
            {current?.title ?? (pathname === "/search" ? "Search" : appName)}
          </span>
          <div sx={styles.row}>
            <SearchCommand groups={groups} />
            <ThemeToggle />
          </div>
        </header>
        <div sx={styles.box}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** A parent item: closed by default, open while one of its children is the current page. */
function NavCollapsible({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const children = item.items ?? []
  const containsCurrent = children.some((child) => child.href === pathname)

  return (
    <Collapsible defaultOpen={containsCurrent} sx={peer.anchor}>
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton />}>
          <span>{item.title}</span>
          <Icon icon={ArrowRight01Icon} sx={styles.chevron} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  isActive={child.href === pathname}
                  render={<Link to={child.href} />}
                >
                  <span>{child.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
