/**
 * `<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->`: the install
 * command for npm, pnpm, Yarn, Bun and Deno, as tabs. The chosen package manager is
 * remembered, and every install block on the site follows it.
 *
 * `run="kirana-style@latest init"` shows how each one runs a package it has not installed, and
 * `exec="kirana-style check"` how it runs one the project has; the commands are in
 * `@workspace/docs-core/package-managers.ts`, which the markdown twin reads too.
 */
import { useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"

import {
  PACKAGE_MANAGERS,
  installLines,
} from "@workspace/docs-core/package-managers.ts"
import type { PackageManager as Manager } from "@workspace/docs-core/package-managers.ts"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { BrandIcon, PACKAGE_MANAGER_ICONS } from "../brand-icon.tsx"
import { CopyButton } from "./code-block.tsx"

const KEY = "docs-ui:package-manager"
const EVENT = "docs-ui:package-manager"

const styles = {
  root: css({
    marginBlockEnd: spacing[5],
    borderRadius: "1.125rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: alpha.muted50,
    padding: "3px",
  }),
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    paddingInline: spacing[2],
    paddingBlock: spacing[1],
  }),
  // Five tabs outgrow a phone: they scroll, and the copy button stays put.
  tabs: css({
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  copy: css({ marginInlineStart: "auto", flexShrink: 0 }),
  panel: css({
    overflowX: "auto",
    borderRadius: "0.875rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingInline: spacing[4],
    paddingBlock: spacing["3.5"],
    fontFamily: fontFamily.mono,
    fontSize: "0.8125rem",
    lineHeight: "1.6",
    whiteSpace: "pre",
  }),
}

function stored(): Manager {
  try {
    const value = localStorage.getItem(KEY)
    if (PACKAGE_MANAGERS.includes(value as Manager)) return value as Manager
  } catch {}
  return "npm"
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function InstallTabs({
  packages = "",
  dev = "",
  run = "",
  exec = "",
}: {
  packages?: string
  dev?: string
  run?: string
  exec?: string
}) {
  // npm on the server; the saved choice after hydration, followed across blocks.
  const manager = useSyncExternalStore<Manager>(subscribe, stored, () => "npm")

  const choose = (next: Manager) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }

  const command = installLines(manager, { packages, dev, run, exec }).join("\n")

  return (
    <div sx={styles.root} data-slot="install-tabs">
      <div sx={styles.bar}>
        <Tabs
          value={manager}
          onValueChange={(value) => choose(value as Manager)}
          sx={styles.tabs}
        >
          <TabsList variant="line">
            {PACKAGE_MANAGERS.map((name) => (
              <TabsTrigger key={name} value={name}>
                <BrandIcon icon={PACKAGE_MANAGER_ICONS[name]} size="0.875rem" />
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <CopyButton source={command} sx={styles.copy} />
      </div>
      <div sx={styles.panel}>{command}</div>
    </div>
  )
}
