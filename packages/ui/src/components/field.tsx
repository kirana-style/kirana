import { useMemo } from "react"
import { css } from "@kirana-style/core"

import type { Sx } from "../lib/sx"
import { mergeSx } from "../lib/sx"
import type { VariantProps } from "../recipes/recipe"
import { recipe } from "../recipes/recipe"
import { Label } from "./label"
import { Separator } from "./separator"
import { fieldLabelMarker, fieldMarker, peer } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { fieldGroupQuery } from "../tokens/container"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import { fontSize, fontWeight, leading, lineHeight } from "../tokens/typography"

/** A label that wraps a whole Field, which turns it into a selectable card. */
const CARD = ':has(> [data-slot="field"])'

const styles = {
  set: css({
    display: "flex",
    flexDirection: "column",
    gap: {
      base: spacing[4],
      ':has(> [data-slot="checkbox-group"])': spacing[3],
      ':has(> [data-slot="radio-group"])': spacing[3],
    },
  }),

  legend: css({
    marginBottom: spacing["1.5"],
    fontWeight: fontWeight.medium,
    fontSize: {
      base: fontSize.base,
      '[data-variant="label"]': fontSize.sm,
    },
    lineHeight: {
      base: lineHeight.base,
      '[data-variant="label"]': lineHeight.sm,
    },
  }),

  group: css({
    display: "flex",
    width: "100%",
    flexDirection: "column",
    // A group used as a checkbox list is tighter. A group directly inside
    // another is tighter still; that is a child rule, in globals.css.
    gap: { base: spacing[5], '[data-slot="checkbox-group"]': spacing[3] },
    // Declared so the `responsive` orientation below can query it.
    containerType: "inline-size",
    containerName: "field-group",
  }),

  fieldBase: css({
    display: "flex",
    width: "100%",
    gap: spacing[2],
    color: { '[data-invalid="true"]': theme.destructive },
  }),
  vertical: css({ flexDirection: "column" }),
  horizontal: css({
    flexDirection: "row",
    alignItems: {
      base: "center",
      ':has(> [data-slot="field-content"])': "flex-start",
    },
  }),
  /**
   * Stacks on a narrow container and lays out in a row once there is room. The
   * query names `field-group`, so it tracks the width of its FieldGroup rather
   * than the viewport.
   */
  responsive: css({
    flexDirection: { base: "column", [fieldGroupQuery.md]: "row" },
    alignItems: {
      [fieldGroupQuery.md]: {
        base: "center",
        ':has(> [data-slot="field-content"])': "flex-start",
      },
    },
  }),

  content: css({
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: spacing["0.5"],
    lineHeight: leading.snug,
  }),

  label: css({
    display: "flex",
    gap: spacing[2],
    lineHeight: leading.snug,
    opacity: {
      [fieldMarker.within('[data-disabled="true"]')]: 0.5,
    },
    // A label wrapping a whole Field is a selectable card, like a radio tile,
    // by a `:has()` test, so no prop is needed to opt in.
    width: { base: "fit-content", [CARD]: "100%" },
    flexDirection: { [CARD]: "column" },
    borderRadius: { [CARD]: radius.lg },
    borderWidth: { [CARD]: "1px" },
    borderStyle: { [CARD]: "solid" },
    borderColor: {
      [CARD]: {
        base: theme.border,
        // A checked card keeps its checked edge while focused.
        ":has(:focus-visible)": {
          base: theme.ring,
          ":has([data-checked])": surface.checkedSoftBorder,
        },
        ":has([data-checked])": surface.checkedSoftBorder,
      },
    },
    backgroundColor: {
      [CARD]: {
        // Hover only applies while nothing inside is disabled.
        ":hover": alpha.muted50,
        ":has(:disabled)": null,
        ":has([data-disabled])": null,
        ":has([data-checked])": surface.checkedSoft,
      },
    },
    boxShadow: {
      [CARD]: {
        ":has(:focus-visible)": `0 0 0 ${ring.width} ${alpha.ring50}`,
      },
    },
  }),

  title: css({
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.medium,
    opacity: {
      [fieldMarker.within('[data-disabled="true"]')]: 0.5,
    },
  }),

  description: css({
    textAlign: "start",
    fontSize: fontSize.sm,
    lineHeight: leading.normal,
    fontWeight: fontWeight.normal,
    color: theme.mutedForeground,
    // Balanced when the field contains a horizontal control, a slider say. A
    // horizontal field is not its own descendant, so a checkbox or switch row
    // wraps normally.
    textWrap: {
      [fieldMarker.within(':has([data-orientation="horizontal"])')]: "balance",
    },
    // Links written straight into the description; see "Inline content" in
    // globals.css.
    "--inline-link-hover": theme.primary,
    // Tightens a description that sits directly above the control rather than
    // at the end of the field, and pulls one up under a legend. The legend
    // carries the default relation; its rule wins in every position.
    marginTop: {
      [peer.after('[data-variant="legend"]')]: `calc(${spacing["1.5"]} * -1)`,
      ":nth-last-child(2)": {
        base: `calc(${spacing[1]} * -1)`,
        [peer.after('[data-variant="legend"]')]: `calc(${spacing["1.5"]} * -1)`,
      },
      ":last-child": {
        base: 0,
        [peer.after('[data-variant="legend"]')]: `calc(${spacing["1.5"]} * -1)`,
      },
    },
  }),

  separator: css({
    position: "relative",
    marginBlock: `calc(${spacing[2]} * -1)`,
    height: spacing[5],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  }),
  separatorLine: css({ position: "absolute", inset: 0, top: "50%" }),
  separatorContent: css({
    position: "relative",
    marginInline: "auto",
    display: "block",
    width: "fit-content",
    backgroundColor: theme.background,
    paddingInline: spacing[2],
    color: theme.mutedForeground,
  }),

  error: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: fontWeight.normal,
    color: theme.destructive,
  }),
  errorList: css({
    marginInlineStart: spacing[4],
    display: "flex",
    listStyleType: "disc",
    flexDirection: "column",
    gap: spacing[1],
  }),
}

const field = recipe({
  base: styles.fieldBase,
  variants: {
    orientation: {
      vertical: styles.vertical,
      horizontal: styles.horizontal,
      responsive: styles.responsive,
    },
  },
  defaults: { orientation: "vertical" },
})

type El<T extends keyof React.JSX.IntrinsicElements = "div"> = Omit<
  React.ComponentProps<T>,
  "className"
> & { sx?: Sx }

function FieldSet({ sx, ...props }: El<"fieldset">) {
  return <fieldset data-slot="field-set" {...props} sx={[styles.set, sx]} />
}

function FieldLegend({
  sx,
  variant = "legend",
  ...props
}: El<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      {...props}
      sx={[peer.anchor, styles.legend, sx]}
    />
  )
}

function FieldGroup({ sx, ...props }: El) {
  return <div data-slot="field-group" {...props} sx={[styles.group, sx]} />
}

function Field({
  sx,
  orientation = "vertical",
  ...props
}: El & VariantProps<typeof field>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      {...props}
      sx={[fieldMarker.anchor, ...field({ orientation }), sx]}
    />
  )
}

function FieldContent({ sx, ...props }: El) {
  return <div data-slot="field-content" {...props} sx={[styles.content, sx]} />
}

function FieldLabel({ sx, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      {...props}
      sx={mergeSx(fieldLabelMarker.anchor, styles.label, sx)}
    />
  )
}

// `field-label`, so a Field's rules for its label (here and in globals.css) reach a title too.
function FieldTitle({ sx, ...props }: El) {
  return <div data-slot="field-label" {...props} sx={[styles.title, sx]} />
}

function FieldDescription({ sx, ...props }: El<"p">) {
  return (
    <p data-slot="field-description" {...props} sx={[styles.description, sx]} />
  )
}

function FieldSeparator({
  children,
  sx,
  contentSx,
  ...props
}: El & {
  children?: React.ReactNode
  /** Styles the label box that interrupts the line, e.g. its fill on a card. */
  contentSx?: Sx
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      {...props}
      sx={[styles.separator, sx]}
    >
      <Separator sx={styles.separatorLine} />
      {children && (
        <span
          data-slot="field-separator-content"
          sx={[styles.separatorContent, contentSx]}
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  sx,
  children,
  errors,
  ...props
}: El & { errors?: Array<{ message?: string } | undefined> }) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul sx={styles.errorList}>
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      {...props}
      sx={[styles.error, sx]}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
  field as fieldVariants,
}
