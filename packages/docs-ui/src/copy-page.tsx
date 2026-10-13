/**
 * "Copy page": the page as markdown, for a language model or an agent. The
 * main button copies it; the menu views it raw or opens it in an assistant with
 * the page's markdown URL in the prompt.
 *
 * The markdown is the generator's twin of the page (`/docs/<slug>.md`), so what
 * is copied is exactly what `llms-full.txt` carries.
 */
import { useState } from "react"
import { css } from "@kirana-style/core"
import {
  ArrowDown01Icon,
  ChatGptIcon,
  ClaudeIcon,
  Copy01Icon,
  FileScriptIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Icon } from "@workspace/ui/primitives/icon"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { duration } from "@workspace/ui/tokens/motion"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontSize,
  fontWeight,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { useDocs } from "./provider.tsx"

const styles = {
  group: css({
    display: "inline-flex",
    alignItems: "stretch",
    height: spacing[8],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
    overflow: "hidden",
  }),
  button: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing["1.5"],
    paddingInline: spacing["2.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    color: theme.foreground,
    backgroundColor: { base: "transparent", ":hover": alpha.muted50 },
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: duration[150],
  }),
  divider: css({ width: "1px", backgroundColor: theme.border }),
  chevron: css({ paddingInline: spacing[2] }),
  item: css({
    alignItems: "flex-start",
    gap: spacing[3],
    paddingBlock: spacing[2],
  }),
  tile: css({
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: spacing[8],
    height: spacing[8],
    borderRadius: radius.md,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  text: css({ display: "grid", gap: "1px" }),
  title: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  hint: css({
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
  menu: css({ width: "19rem" }),
}

/** The markdown twin of a docs href: `/docs` → `/docs/index.md`. */
export function markdownPath(href: string): string {
  return `${href === "/docs" ? "/docs/index" : href}.md`
}

export function CopyPage({ href }: { href: string }) {
  const { siteUrl, siteName } = useDocs()
  const [copied, setCopied] = useState(false)
  const path = markdownPath(href)
  const prompt = encodeURIComponent(
    `Read ${siteUrl}${path} — it is a page of the ${siteName} documentation — so I can ask you questions about it.`
  )

  const copy = async () => {
    const response = await fetch(path)
    await navigator.clipboard.writeText(await response.text())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const item = (icon: typeof Copy01Icon, title: string, hint: string) => (
    <>
      <span sx={styles.tile}>
        <Icon icon={icon} size="1rem" />
      </span>
      <span sx={styles.text}>
        <span sx={styles.title}>{title}</span>
        <span sx={styles.hint}>{hint}</span>
      </span>
    </>
  )

  return (
    <div sx={styles.group}>
      <button type="button" sx={styles.button} onClick={() => void copy()}>
        <Icon icon={copied ? Tick02Icon : Copy01Icon} size="0.875rem" />
        {copied ? "Copied" : "Copy page"}
      </button>
      <span sx={styles.divider} aria-hidden="true" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="More ways to use this page"
              sx={[styles.button, styles.chevron]}
            />
          }
        >
          <Icon icon={ArrowDown01Icon} size="0.875rem" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sx={styles.menu}>
          <DropdownMenuItem sx={styles.item} onClick={() => void copy()}>
            {item(Copy01Icon, "Copy page", "As markdown, for an LLM")}
          </DropdownMenuItem>
          <DropdownMenuItem
            sx={styles.item}
            render={<a href={path} target="_blank" rel="noreferrer" />}
          >
            {item(FileScriptIcon, "View as markdown", "The page as plain text")}
          </DropdownMenuItem>
          <DropdownMenuItem
            sx={styles.item}
            render={
              <a
                href={`https://chatgpt.com/?q=${prompt}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {item(
              ChatGptIcon,
              "Open in ChatGPT",
              "Ask questions about this page"
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            sx={styles.item}
            render={
              <a
                href={`https://claude.ai/new?q=${prompt}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {item(
              ClaudeIcon,
              "Open in Claude",
              "Ask questions about this page"
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
