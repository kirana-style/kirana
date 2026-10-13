/**
 * `<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->`: the install
 * command for npm, pnpm, yarn and bun, as tabs. The chosen package manager is
 * remembered, and every install block on the site follows it.
 */
import { useSyncExternalStore } from "react"
import { css } from "@kirana-style/core"

import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { alpha, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { BrandIcon, PACKAGE_MANAGER_ICONS } from "../brand-icon.tsx"
import { CopyButton } from "./code-block.tsx"

const MANAGERS = {
  npm: { add: "npm install", dev: "npm install -D" },
  pnpm: { add: "pnpm add", dev: "pnpm add -D" },
  yarn: { add: "yarn add", dev: "yarn add -D" },
  bun: { add: "bun add", dev: "bun add -d" },
} as const

type Manager = keyof typeof MANAGERS

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
    paddingInline: spacing[2],
    paddingBlock: spacing[1],
  }),
  copy: css({ marginInlineStart: "auto" }),
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
    if (value && value in MANAGERS) return value as Manager
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
}: {
  packages?: string
  dev?: string
}) {
  // npm on the server; the saved choice after hydration, followed across blocks.
  const manager = useSyncExternalStore<Manager>(subscribe, stored, () => "npm")

  const choose = (next: Manager) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }

  const lines = [
    packages ? `${MANAGERS[manager].add} ${packages}` : "",
    dev ? `${MANAGERS[manager].dev} ${dev}` : "",
  ].filter(Boolean)
  const command = lines.join("\n")

  return (
    <div sx={styles.root} data-slot="install-tabs">
      <div sx={styles.bar}>
        <Tabs
          value={manager}
          onValueChange={(value) => choose(value as Manager)}
        >
          <TabsList variant="line">
            {(Object.keys(MANAGERS) as Manager[]).map((name) => (
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
