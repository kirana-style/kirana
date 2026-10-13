import { css } from "@kirana-style/core"
import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import { Kbd } from "@workspace/ui/components/kbd"

import { flattenNav } from "./nav"
import type { NavGroup } from "./nav"
import { Icon } from "@workspace/ui/primitives/icon"
import { theme } from "@workspace/ui/theme/semantic"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"
import { spacing } from "@workspace/ui/tokens/spacing"

const styles = {
  button: css({
    width: { base: spacing["40"], [breakpoint.sm]: spacing["56"] },
    justifyContent: "space-between",
    // The shortcut sits as far from the end edge as from the top and bottom:
    // 3px of padding plus the 1px border, matching the (28 - 20) / 2 px above
    // and below the 20px key.
    paddingInlineEnd: "3px",
    color: theme.mutedForeground,
  }),
  text: css({
    display: "flex",
    alignItems: "center",
    gap: spacing["2"],
  }),
}

export function SearchCommand({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        sx={styles.button}
        onClick={() => setOpen(true)}
      >
        <span sx={styles.text}>
          <Icon icon={Search01Icon} />
          Search
        </span>
        <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {flattenNav([group]).map((item) => (
                  <CommandItem
                    key={item.href}
                    value={[item.title, ...(item.keywords ?? [])].join(" ")}
                    onSelect={() => {
                      setOpen(false)
                      void navigate({ to: item.href })
                    }}
                  >
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
