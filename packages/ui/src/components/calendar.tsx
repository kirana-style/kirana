import * as React from "react"
import { css, props as styleProps } from "@kirana-style/core"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import type { DayButton, Locale } from "react-day-picker"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import { button, buttonRing } from "../recipes/button"
import { Button } from "./button"
import { Icon } from "../primitives/icon"
import { calendarCtx, ctx } from "../theme/context"
import {
  calendarDayMarker,
  cardMarker,
  popoverContentMarker,
} from "../theme/markers"
import { alpha, radius, theme } from "../theme/semantic"
import { breakpoint } from "../tokens/breakpoints"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, lineHeight } from "../tokens/typography"

/**
 * react-day-picker takes a map of class name strings, so every style here is
 * turned into a class with `styleProps(...).className`. A day cell carries a
 * relation anchor so the button inside it can react to the cell's state. Cell
 * size and radius are variables because the whole grid has to agree on them.
 */

const styles = {
  root: css({
    backgroundColor: {
      base: theme.background,
      [cardMarker.within('[data-slot="card"]')]: "transparent",
      [popoverContentMarker.within("[data-slot]")]: "transparent",
    },
    padding: spacing[2],
    [calendarCtx.cellSize]: spacing[7],
    [calendarCtx.cellRadius]: radius.md,
  }),
  rootWidth: css({ width: "fit-content" }),
  months: css({
    position: "relative",
    display: "flex",
    flexDirection: { base: "column", [breakpoint.md]: "row" },
    gap: spacing[4],
  }),
  month: css({
    display: "flex",
    width: "100%",
    flexDirection: "column",
    gap: spacing[4],
  }),
  nav: css({
    position: "absolute",
    insetInline: 0,
    top: 0,
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[1],
  }),
  navButton: css({
    width: calendarCtx.cellSize,
    height: calendarCtx.cellSize,
    // Logical longhands, not `padding: 0`: Button sets `paddingInline` plus
    // conditional `paddingInlineStart`/`End`, and a merge replaces entries of
    // the same longhand; `padding` would set the physical ones beside them.
    paddingTop: 0,
    paddingBottom: 0,
    paddingInlineStart: 0,
    paddingInlineEnd: 0,
    userSelect: "none",
    opacity: { '[aria-disabled="true"]': 0.5 },
  }),
  monthCaption: css({
    display: "flex",
    height: calendarCtx.cellSize,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    // Keeps the label clear of the two nav buttons sitting over it.
    paddingInline: calendarCtx.cellSize,
  }),
  dropdowns: css({
    display: "flex",
    height: calendarCtx.cellSize,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing["1.5"],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
  }),
  dropdownRoot: css({
    position: "relative",
    borderRadius: calendarCtx.cellRadius,
  }),
  /** The real select, invisible over the styled label. */
  dropdown: css({
    position: "absolute",
    inset: 0,
    backgroundColor: theme.popover,
    opacity: 0,
  }),
  captionLabel: css({
    fontWeight: fontWeight.medium,
    userSelect: "none",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  captionLabelDropdown: css({
    display: "flex",
    alignItems: "center",
    gap: spacing[1],
    borderRadius: calendarCtx.cellRadius,
    [ctx.iconSize]: "0.875rem",
  }),
  /** The dropdown caret: the label's text keeps its colour, the caret mutes. */
  caret: css({ color: theme.mutedForeground }),
  monthGrid: css({ width: "100%", borderCollapse: "collapse" }),
  weekdays: css({ display: "flex" }),
  weekday: css({
    flex: 1,
    borderRadius: calendarCtx.cellRadius,
    fontSize: "0.8rem",
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
    userSelect: "none",
  }),
  week: css({ marginTop: spacing[2], display: "flex", width: "100%" }),
  weekNumberHeader: css({ width: calendarCtx.cellSize, userSelect: "none" }),
  weekNumber: css({
    fontSize: "0.8rem",
    color: theme.mutedForeground,
    userSelect: "none",
  }),
  weekNumberCell: css({
    display: "flex",
    width: calendarCtx.cellSize,
    height: calendarCtx.cellSize,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  }),

  day: css({
    position: "relative",
    aspectRatio: "1 / 1",
    height: "100%",
    width: "100%",
    borderRadius: calendarCtx.cellRadius,
    padding: 0,
    textAlign: "center",
    userSelect: "none",
  }),
  /** A range's ends round outward and bleed into the neighbouring cell. */
  rangeStart: css({
    position: "relative",
    isolation: "isolate",
    zIndex: 0,
    borderStartStartRadius: calendarCtx.cellRadius,
    borderEndStartRadius: calendarCtx.cellRadius,
    backgroundColor: theme.muted,
    "::after": {
      content: "''",
      position: "absolute",
      insetBlock: 0,
      insetInlineEnd: 0,
      width: spacing[4],
      backgroundColor: theme.muted,
    },
  }),
  rangeMiddle: css({ borderRadius: 0 }),
  rangeEnd: css({
    position: "relative",
    isolation: "isolate",
    zIndex: 0,
    borderStartEndRadius: calendarCtx.cellRadius,
    borderEndEndRadius: calendarCtx.cellRadius,
    backgroundColor: theme.muted,
    "::after": {
      content: "''",
      position: "absolute",
      insetBlock: 0,
      insetInlineStart: 0,
      width: spacing[4],
      backgroundColor: theme.muted,
    },
  }),
  today: css({
    borderRadius: {
      base: calendarCtx.cellRadius,
      '[data-selected="true"]': 0,
    },
    backgroundColor: theme.muted,
    color: theme.foreground,
  }),
  outside: css({ color: theme.mutedForeground }),
  disabled: css({ color: theme.mutedForeground, opacity: 0.5 }),
  hidden: css({ visibility: "hidden" }),

  dayButton: css({
    position: "relative",
    isolation: "isolate",
    zIndex: 10,
    display: "flex",
    aspectRatio: "1 / 1",
    width: "100%",
    height: "auto",
    minWidth: calendarCtx.cellSize,
    flexDirection: "column",
    gap: spacing[1],
    borderWidth: 0,
    lineHeight: 1,
    fontWeight: fontWeight.normal,

    // The focus ring is owned by the cell, which is what knows it has focus.
    borderColor: {
      [calendarDayMarker.within('[data-focused="true"]')]: theme.ring,
    },
    boxShadow: {
      [calendarDayMarker.within('[data-focused="true"]')]:
        `0 0 0 ${ring.width} ${alpha.ring50}`,
    },

    backgroundColor: {
      '[data-selected-single="true"]': theme.primary,
      '[data-range-start="true"]': theme.primary,
      '[data-range-end="true"]': theme.primary,
      '[data-range-middle="true"]': theme.muted,
    },
    color: {
      '[data-selected-single="true"]': theme.primaryForeground,
      '[data-range-start="true"]': theme.primaryForeground,
      '[data-range-end="true"]': theme.primaryForeground,
      '[data-range-middle="true"]': theme.foreground,
    },
    /**
     * `base` restates the Button's own radius: this namespace owns
     * `borderRadius` once merged after the recipe, so `null` would remove it and
     * square every day in the grid.
     */
    borderRadius: {
      base: radius.lg,
      '[data-range-middle="true"]': 0,
      '[data-range-start="true"]': calendarCtx.cellRadius,
      '[data-range-end="true"]': calendarCtx.cellRadius,
    },
    // Rounds the outer edges of a selected run where a week row starts or ends.
    // Repeated inside `[data-range-middle]`: the precedence ladder ranks that
    // attribute condition above these relation reads.
    borderStartStartRadius: {
      [calendarDayMarker.within(':first-child[data-selected="true"]')]:
        calendarCtx.cellRadius,
      '[data-range-middle="true"]': {
        base: 0,
        [calendarDayMarker.within(':first-child[data-selected="true"]')]:
          calendarCtx.cellRadius,
      },
    },
    borderEndStartRadius: {
      [calendarDayMarker.within(':first-child[data-selected="true"]')]:
        calendarCtx.cellRadius,
      '[data-range-middle="true"]': {
        base: 0,
        [calendarDayMarker.within(':first-child[data-selected="true"]')]:
          calendarCtx.cellRadius,
      },
    },
    borderStartEndRadius: {
      [calendarDayMarker.within(':last-child[data-selected="true"]')]:
        calendarCtx.cellRadius,
      '[data-range-middle="true"]': {
        base: 0,
        [calendarDayMarker.within(':last-child[data-selected="true"]')]:
          calendarCtx.cellRadius,
      },
    },
    borderEndEndRadius: {
      [calendarDayMarker.within(':last-child[data-selected="true"]')]:
        calendarCtx.cellRadius,
      '[data-range-middle="true"]': {
        base: 0,
        [calendarDayMarker.within(':last-child[data-selected="true"]')]:
          calendarCtx.cellRadius,
      },
    },
  }),
}

/**
 * Turns a set of styles into the class string react-day-picker wants.
 *
 * Safe here because every style in this file is static: `styleProps` only also
 * returns a `style` object for bridged runtime values, and there are none.
 */
function cls(...values: Sx[]) {
  return styleProps(values).className ?? ""
}

/** The styles `modifiersSx` names for whichever modifiers a day carries. */
function modifierStyles(
  modifiersSx: Record<string, { day?: Sx; button?: Sx }> | undefined,
  modifiers: Record<string, boolean>,
  part: "day" | "button"
): Sx[] {
  if (!modifiersSx) return []
  return Object.entries(modifiersSx)
    .filter(([name]) => modifiers[name])
    .map(([, value]) => value[part] ?? null)
}

function Calendar({
  sx,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  modifiersSx,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
  sx?: Sx
  /**
   * Styles for days carrying a modifier, keyed by its name: the cell as `day`,
   * its button as `button`. Use it instead of `modifiersClassNames`, whose class
   * strings would race the calendar's own styles in stylesheet order.
   */
  modifiersSx?: Record<string, { day?: Sx; button?: Sx }>
}) {
  const defaults = getDefaultClassNames()
  const navButtonClass = cls(
    buttonRing,
    ...button({ variant: buttonVariant }),
    styles.navButton
  )

  const dayPickerProps = {
    showOutsideDays,
    // One class string for the root, so a caller's width replaces `fit-content`
    // instead of racing it in stylesheet order.
    className: cls(styles.root, styles.rootWidth, sx),
    captionLayout,
    locale,
    formatters: {
      formatMonthDropdown: (date: Date) =>
        date.toLocaleString(locale?.code, { month: "short" }),
      ...formatters,
    },
    classNames: {
      root: defaults.root,
      months: `${cls(styles.months)} ${defaults.months}`,
      month: `${cls(styles.month)} ${defaults.month}`,
      nav: `${cls(styles.nav)} ${defaults.nav}`,
      button_previous: `${navButtonClass} ${defaults.button_previous}`,
      button_next: `${navButtonClass} ${defaults.button_next}`,
      month_caption: `${cls(styles.monthCaption)} ${defaults.month_caption}`,
      dropdowns: `${cls(styles.dropdowns)} ${defaults.dropdowns}`,
      dropdown_root: `${cls(styles.dropdownRoot)} ${defaults.dropdown_root}`,
      dropdown: `${cls(styles.dropdown)} ${defaults.dropdown}`,
      caption_label: `${cls(
        styles.captionLabel,
        captionLayout !== "label" && styles.captionLabelDropdown
      )} ${defaults.caption_label}`,
      month_grid: `${cls(styles.monthGrid)} ${defaults.month_grid}`,
      weekdays: `${cls(styles.weekdays)} ${defaults.weekdays}`,
      weekday: `${cls(styles.weekday)} ${defaults.weekday}`,
      week: `${cls(styles.week)} ${defaults.week}`,
      week_number_header: `${cls(styles.weekNumberHeader)} ${defaults.week_number_header}`,
      week_number: `${cls(styles.weekNumber)} ${defaults.week_number}`,
      // The day cell's own styles are merged in the Day component below, where
      // the modifiers are known. As separate class strings they would all set
      // `borderRadius`, and which one won would depend on stylesheet order.
      ...classNames,
    },
    components: {
      Root: ({ className, rootRef, ...rootProps }) => (
        <div
          data-slot="calendar"
          ref={rootRef}
          className={className}
          {...rootProps}
        />
      ),
      Chevron: ({ orientation }) => {
        if (orientation === "left") {
          return <Icon icon={ArrowLeft01Icon} size="1rem" />
        }

        if (orientation === "right") {
          return <Icon icon={ArrowRight01Icon} size="1rem" />
        }

        return <Icon icon={ArrowDown01Icon} sx={styles.caret} />
      },
      Day: ({ day: _day, modifiers, className, ...dayProps }) => (
        <td
          {...dayProps}
          className={`${className ?? ""} ${cls(
            // The marker is what lets each day button read its own cell's state.
            calendarDayMarker.anchor,
            styles.day,
            modifiers.today && styles.today,
            modifiers.outside && styles.outside,
            modifiers.disabled && styles.disabled,
            modifiers.hidden && styles.hidden,
            modifiers.range_start && styles.rangeStart,
            modifiers.range_middle && styles.rangeMiddle,
            modifiers.range_end && styles.rangeEnd,
            ...modifierStyles(modifiersSx, modifiers, "day")
          )}`}
        />
      ),
      DayButton: (dayProps) => (
        <CalendarDayButton
          locale={locale}
          {...dayProps}
          sx={mergeSx(
            ...modifierStyles(modifiersSx, dayProps.modifiers, "button")
          )}
        />
      ),
      WeekNumber: ({ children, ...weekProps }) => (
        <td {...weekProps}>
          <div sx={styles.weekNumberCell}>{children}</div>
        </td>
      ),
      ...components,
    },
    ...props,
  } as React.ComponentProps<typeof DayPicker>

  return <DayPicker {...dayPickerProps} />
}

function CalendarDayButton({
  sx,
  day,
  modifiers,
  locale,
  ...props
}: Omit<React.ComponentProps<typeof DayButton>, "className"> & {
  locale?: Partial<Locale>
  sx?: Sx
}) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      {...props}
      sx={mergeSx(styles.dayButton, sx)}
    />
  )
}

export { Calendar, CalendarDayButton }
