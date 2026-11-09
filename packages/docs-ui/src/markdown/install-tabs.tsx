/**
 * `<!-- ::install packages="@kirana-style/core" dev="@kirana-style/vite" -->`: the install
 * command for each package manager, as pills rounded as the code beneath them (their logos alone
 * on a phone); the chosen one is remembered and every block follows it. `run="kirana-style@latest init"` runs a package not installed, `exec="kirana-style check"`
 * one the project has. The commands are in `@workspace/docs-core/package-managers.ts`, which the
 * markdown twin reads too.
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
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily } from "@workspace/ui/tokens/typography"

import { BrandIcon, PACKAGE_MANAGER_ICONS } from "../brand-icon.tsx"
import { CopyButton } from "./code-block.tsx"

const KEY = "docs-ui:package-manager"
const EVENT = "docs-ui:package-manager"

/**
 * The card's corner, and inside its 3px the code panel's and the pills' track's, and inside the
 * track's 3px the pills': each nested corner the one around it less the space between.
 */
const CARD_RADIUS = "1.125rem"
const PANEL_RADIUS = `calc(${CARD_RADIUS} - 3px)`

const styles = {
  root: css({
    marginBlockEnd: spacing[5],
    borderRadius: CARD_RADIUS,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: alpha.muted50,
    padding: "3px",
  }),
  // The pills' track sits on the card's 3px inset, as the code panel does, with the same 3px
  // between them: their edges line up.
  bar: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    marginBlockEnd: "3px",
  }),
  // Six managers outgrow a phone: below `sm` each pill is its logo alone (named for assistive
  // technology and on hover), and if even that does not fit, the row scrolls; the copy button
  // stays put.
  tabs: css({
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
  }),
  // The choice as pills: a track on the page's ground with a hairline, rounded as the code
  // beneath it, the chosen manager the tabs' own active pill.
  pills: css({
    borderRadius: { "*": null, base: PANEL_RADIUS },
    backgroundColor: theme.background,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    height: { "*": null, base: "auto" },
    gap: "2px",
  }),
  pill: css({
    flex: "none",
    borderRadius: `calc(${PANEL_RADIUS} - 3px)`,
    paddingInlineStart: {
      "*": null,
      base: spacing[2],
      [breakpoint.sm]: spacing["2.5"],
    },
    paddingInlineEnd: {
      "*": null,
      base: spacing[2],
      [breakpoint.sm]: spacing["2.5"],
    },
    paddingBlock: spacing[1],
    fontSize: "0.8125rem",
  }),
  label: css({ display: { base: "none", [breakpoint.sm]: "inline" } }),
  copy: css({
    marginInlineStart: "auto",
    marginInlineEnd: spacing[2],
    flexShrink: 0,
  }),
  panel: css({
    overflowX: "auto",
    borderRadius: PANEL_RADIUS,
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
          <TabsList aria-label="Package manager" sx={styles.pills}>
            {PACKAGE_MANAGERS.map((name) => (
              <TabsTrigger
                key={name}
                value={name}
                aria-label={name}
                title={PACKAGE_MANAGER_ICONS[name].title}
                sx={styles.pill}
              >
                <BrandIcon icon={PACKAGE_MANAGER_ICONS[name]} size="0.875rem" />
                <span sx={styles.label}>{name}</span>
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
