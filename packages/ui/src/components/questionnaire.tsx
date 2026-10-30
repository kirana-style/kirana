import { css, props as styleProps } from "@kirana-style/core"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import type { Sx } from "../lib/sx"
import { button, buttonRing } from "../recipes/button"
import { controlStyles } from "../recipes/control"
import type { Button } from "./button"
import { Icon } from "../primitives/icon"
import { questionnaireOptionMarker } from "../theme/markers"
import { alpha, radius, surface, theme } from "../theme/semantic"
import { breakpoint } from "../tokens/breakpoints"
import { duration, easing } from "../tokens/motion"
import { ring } from "../tokens/ring"
import { spacing } from "../tokens/spacing"
import {
  fontFamily,
  fontSize,
  fontWeight,
  leading,
  lineHeight,
} from "../tokens/typography"

/** Nudges the indicator onto the text's optical baseline. */
const BASELINE_NUDGE = "0.1125rem"

const styles = {
  root: css({
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing[4],
  }),
  progress: css({
    minHeight: "1lh",
    width: "fit-content",
    minWidth: "14ch",
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
    fontVariantNumeric: "tabular-nums",
  }),
  item: css({
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
  }),
  title: css({
    fontSize: fontSize.base,
    lineHeight: leading.snug,
    fontWeight: fontWeight.semibold,
    textWrap: "pretty",
    // Only spaced away from the choices when no description follows it.
    marginBottom: {
      base: spacing[4],
      ':has(~ [data-slot="questionnaire-description"])': 0,
    },
  }),
  description: css({
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    textWrap: "pretty",
    color: theme.mutedForeground,
  }),
  choices: css({
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    gap: spacing[2],
  }),

  choice: css({
    position: "relative",
    display: "flex",
    minHeight: spacing[11],
    cursor: "pointer",
    alignItems: "flex-start",
    gap: spacing["2.5"],
    borderRadius: radius.lg,
    borderWidth: "1px",
    borderStyle: "solid",
    paddingInline: spacing[3],
    paddingBlock: spacing["2.5"],
    textAlign: "start",
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    outlineStyle: "none",
    userSelect: "none",
    transitionProperty: "color, background-color, border-color, box-shadow",
    transitionDuration: duration[150],
    transitionTimingFunction: easing.inOut,

    backgroundColor: {
      base: surface.choice,
      ":hover": alpha.muted50,
      "[data-checked]": theme.muted,
    },
    borderColor: {
      base: theme.input,
      ":has(> input:focus-visible)": theme.ring,
      "[data-invalid]": surface.borderInvalid,
      // An invalid choice stays red when it is checked too.
      "[data-checked]": {
        base: alpha.primary40,
        "[data-invalid]": surface.borderInvalid,
      },
    },
    boxShadow: {
      ":has(> input:focus-visible)": `0 0 0 ${ring.width} ${alpha.ring50}`,
    },
    pointerEvents: { "[data-disabled]": "none" },
    opacity: { "[data-disabled]": 0.5 },
  }),
  /** The real control, covering the card so the whole card is the hit target. */
  choiceInput: css({
    position: "absolute",
    inset: 0,
    zIndex: 10,
    width: "100%",
    height: "100%",
    cursor: "pointer",
    opacity: 0,
  }),
  indicator: css({
    pointerEvents: "none",
    position: "relative",
    display: "flex",
    width: spacing[4],
    height: spacing[4],
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: "1px",
    borderStyle: "solid",
    // A radio is round, a checkbox is a rounded square.
    borderRadius: {
      base: "4px",
      [questionnaireOptionMarker.within('[data-type="radio"]')]:
        "calc(infinity * 1px)",
    },
    translate: {
      base: `0 ${BASELINE_NUDGE}`,
      [questionnaireOptionMarker.within(
        ':has([data-slot="questionnaire-choice-description"])'
      )]: `0 ${spacing["0.5"]}`,
    },
    backgroundColor: {
      base: surface.control,
      [questionnaireOptionMarker.within("[data-checked]")]: theme.primary,
    },
    borderColor: {
      base: theme.input,
      [questionnaireOptionMarker.within("[data-checked]")]: theme.primary,
    },
    color: {
      [questionnaireOptionMarker.within("[data-checked]")]:
        theme.primaryForeground,
    },
  }),
  /** The filled dot, for a radio. */
  indicatorDot: css({
    width: spacing[2],
    height: spacing[2],
    borderRadius: "calc(infinity * 1px)",
    backgroundColor: theme.primaryForeground,
    // Shown when checked, but never in a checkbox.
    display: {
      base: "none",
      [questionnaireOptionMarker.within("[data-checked]")]: {
        base: "block",
        [questionnaireOptionMarker.within('[data-type="checkbox"]')]: "none",
      },
    },
  }),
  /** The tick, for a checkbox. */
  indicatorCheck: css({
    // Shown when checked, but never in a radio.
    display: {
      base: "none",
      [questionnaireOptionMarker.within("[data-checked]")]: {
        base: "block",
        [questionnaireOptionMarker.within('[data-type="radio"]')]: "none",
      },
    },
  }),

  choiceLabel: css({
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: spacing["0.5"],
    lineHeight: leading.snug,
  }),
  choiceDescription: css({ color: theme.mutedForeground }),
  choiceShortcut: css({
    pointerEvents: "none",
    marginInlineStart: "auto",
    width: spacing[5],
    height: spacing[5],
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.input,
    backgroundColor: theme.background,
    fontFamily: fontFamily.mono,
    fontSize: "0.625rem",
    lineHeight: 1,
    fontWeight: fontWeight.medium,
    color: theme.mutedForeground,
    // Only shown when the choice actually declares one.
    display: {
      base: "none",
      [questionnaireOptionMarker.within("[data-shortcut]")]: "inline-flex",
    },
    translate: {
      base: `0 ${BASELINE_NUDGE}`,
      [questionnaireOptionMarker.within(
        ':has([data-slot="questionnaire-choice-description"])'
      )]: `0 ${spacing["0.5"]}`,
    },
  }),

  inputWrapper: css({ position: "relative", width: "100%", minWidth: 0 }),
  input: css({
    height: spacing[8],
    // 44px tall below `sm`, the minimum comfortable touch target.
    minHeight: { base: spacing[11], [breakpoint.sm]: 0 },
    paddingInline: spacing["2.5"],
    paddingBlock: spacing[1],
    fontSize: { base: fontSize.base, [breakpoint.md]: fontSize.sm },
    lineHeight: { base: lineHeight.base, [breakpoint.md]: lineHeight.sm },
    "::selection": {
      backgroundColor: theme.primary,
      color: theme.primaryForeground,
    },
    pointerEvents: { ":disabled": "none" },
  }),

  error: css({
    marginTop: spacing[2],
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    color: theme.destructive,
  }),

  actions: css({
    display: "grid",
    minHeight: { base: spacing[11], [breakpoint.sm]: spacing[8] },
    width: "100%",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: spacing[2],
  }),
  leading: css({
    gridColumnStart: 1,
    gridRowStart: 1,
    minHeight: { base: spacing[11], [breakpoint.sm]: 0 },
    justifySelf: "start",
  }),
  trailing: css({
    minHeight: { base: spacing[11], [breakpoint.sm]: 0 },
    justifySelf: "end",
  }),
}

type ButtonVariants = Pick<
  React.ComponentProps<typeof Button>,
  "size" | "variant"
>

function Questionnaire({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Root>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      {...props}
      {...styleProps(styles.root, sx)}
    />
  )
}

function QuestionnaireProgress({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Progress>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      {...props}
      {...styleProps(styles.progress, sx)}
    />
  )
}

function QuestionnaireItem({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Item>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      {...props}
      {...styleProps(styles.item, sx)}
    />
  )
}

function QuestionnaireTitle({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Title>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      {...props}
      {...styleProps(styles.title, sx)}
    />
  )
}

function QuestionnaireDescription({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Description>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      {...props}
      {...styleProps(styles.description, sx)}
    />
  )
}

function QuestionnaireChoices({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Choices>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      {...props}
      {...styleProps(styles.choices, sx)}
    />
  )
}

function QuestionnaireChoice({
  children,
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Choice>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      {...props}
      {...styleProps(questionnaireOptionMarker.anchor, styles.choice, sx)}
    >
      <QuestionnairePrimitive.ChoiceInput
        data-slot="questionnaire-choice-input"
        {...styleProps(styles.choiceInput)}
      />
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-indicator"
        sx={styles.indicator}
      >
        <span
          data-slot="questionnaire-choice-indicator-dot"
          sx={styles.indicatorDot}
        />
        <Icon
          icon={Tick02Icon}
          strokeWidth={2}
          size="0.875rem"
          data-slot="questionnaire-choice-indicator-check"
          sx={styles.indicatorCheck}
        />
      </span>
      <QuestionnairePrimitive.ChoiceLabel
        data-slot="questionnaire-choice-label"
        {...styleProps(styles.choiceLabel)}
      >
        {children}
      </QuestionnairePrimitive.ChoiceLabel>
      <QuestionnairePrimitive.ChoiceShortcut
        data-slot="questionnaire-choice-shortcut"
        {...styleProps(styles.choiceShortcut)}
      />
    </QuestionnairePrimitive.Choice>
  )
}

function QuestionnaireChoiceDescription({
  sx,
  ...props
}: Omit<React.ComponentProps<"span">, "className"> & { sx?: Sx }) {
  return (
    <span
      data-slot="questionnaire-choice-description"
      {...props}
      sx={[styles.choiceDescription, sx]}
    />
  )
}

function QuestionnaireInput({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Input>,
  "className"
> & { sx?: Sx }) {
  return (
    <div data-slot="questionnaire-input-wrapper" sx={styles.inputWrapper}>
      <QuestionnairePrimitive.Input
        data-slot="questionnaire-input"
        {...props}
        {...styleProps(
          controlStyles.field,
          controlStyles.placeholder,
          styles.input,
          sx
        )}
      />
    </div>
  )
}

function QuestionnaireError({
  sx,
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Error>,
  "className"
> & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      {...props}
      {...styleProps(styles.error, sx)}
    />
  )
}

function QuestionnaireActions({
  sx,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & { sx?: Sx }) {
  return (
    <div
      data-slot="questionnaire-actions"
      {...props}
      sx={[styles.actions, sx]}
    />
  )
}

function QuestionnairePrevious({
  children,
  sx,
  size = "default",
  variant = "outline",
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Previous>,
  "className"
> &
  ButtonVariants & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      data-size={size}
      data-variant={variant}
      {...props}
      {...styleProps(
        buttonRing,
        ...button({ size, variant }),
        styles.leading,
        sx
      )}
    >
      {children ?? "Previous"}
    </QuestionnairePrimitive.Previous>
  )
}

function QuestionnaireSkip({
  children,
  sx,
  size = "default",
  variant = "ghost",
  ...props
}: Omit<React.ComponentProps<typeof QuestionnairePrimitive.Skip>, "className"> &
  ButtonVariants & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Skip
      data-slot="questionnaire-skip"
      data-size={size}
      data-variant={variant}
      {...props}
      {...styleProps(
        buttonRing,
        ...button({ size, variant }),
        styles.trailing,
        sx
      )}
    >
      {children ?? "Skip"}
    </QuestionnairePrimitive.Skip>
  )
}

function QuestionnaireNext({
  children,
  sx,
  size = "default",
  variant = "default",
  ...props
}: Omit<React.ComponentProps<typeof QuestionnairePrimitive.Next>, "className"> &
  ButtonVariants & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      data-size={size}
      data-variant={variant}
      {...props}
      {...styleProps(
        buttonRing,
        ...button({ size, variant }),
        styles.trailing,
        sx
      )}
    >
      {children ?? "Next"}
    </QuestionnairePrimitive.Next>
  )
}

function QuestionnaireSubmit({
  children,
  sx,
  size = "default",
  variant = "default",
  ...props
}: Omit<
  React.ComponentProps<typeof QuestionnairePrimitive.Submit>,
  "className"
> &
  ButtonVariants & { sx?: Sx }) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      data-size={size}
      data-variant={variant}
      {...props}
      {...styleProps(
        buttonRing,
        ...button({ size, variant }),
        styles.trailing,
        sx
      )}
    >
      {children ?? "Submit"}
    </QuestionnairePrimitive.Submit>
  )
}

export {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
}
