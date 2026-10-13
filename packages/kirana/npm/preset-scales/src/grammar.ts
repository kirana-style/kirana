/**
 * The utility grammar of `@kirana-style/preset-scales` (KRN-API-012, `design-notes/utility-surface.md`):
 * Tailwind CSS v4's utility names over this preset's scales, as data the compiler interprets. A
 * utility lowers to the object a person would write — `px-4` is `{ paddingInline: space[4] }` — so
 * the two forms produce the same atoms.
 *
 * Built from small tables below; nothing here runs in the compiler.
 */
import type { UtilityGrammar, UtilityRule } from "@kirana-style/core/config"

const MODULE = "@kirana-style/preset-scales"
const scale = (name: string) => [{ module: MODULE, export: name }]

/** Tailwind v4's spacing: a key of the scale, or any number of `0.25rem` steps (`w-50`). */
const SPACING = { step: 0.25, unit: "rem" }
const space = (
  properties: string[],
  negative = false,
  fractions = false,
  also?: Record<string, string>
): UtilityRule => ({
  properties,
  scale: "space",
  number: SPACING,
  negative,
  ...(fractions ? { fractions } : {}),
  ...(also ? { also } : {}),
})

/**
 * Composed utilities (`./compose.ts`): each sets its own layer, then the property that reads every
 * layer, exactly as Tailwind v4 composes `--tw-shadow` and `--tw-ring-shadow` into `box-shadow`.
 */
const BOX_SHADOW = {
  boxShadow:
    "{compose.inset-shadow}, {compose.inset-ring-shadow}, {compose.ring-offset-shadow}, {compose.ring-shadow}, {compose.shadow}",
}
const RING = {
  "{compose.ring-shadow}": "0 0 0 {compose.ring-width} {compose.ring-color}",
  ...BOX_SHADOW,
}
const TRANSLATE = { translate: "{compose.translate-x} {compose.translate-y}" }

/** Tailwind v4's filter chains: every step, unset ones falling back to nothing. */
const FILTERS = [
  "blur",
  "brightness",
  "contrast",
  "grayscale",
  "hue-rotate",
  "invert",
  "saturate",
  "sepia",
  "drop-shadow",
]
const FILTER = {
  filter: FILTERS.map((step) => `{compose.${step}}`).join(" "),
}
const BACKDROP = {
  backdropFilter: [
    "blur",
    "brightness",
    "contrast",
    "grayscale",
    "hue-rotate",
    "invert",
    "opacity",
    "saturate",
    "sepia",
  ]
    .map((step) => `{compose.backdrop-${step}}`)
    .join(" "),
}
/** A filter step: `brightness-50` sets `{compose.brightness}` to `brightness(50%)`, then the chain. */
const step = (
  layer: string,
  fn: string,
  unit: string,
  chain: Record<string, string>,
  negative = false
): UtilityRule => ({
  properties: [`{compose.${layer}}`],
  number: { step: 1, unit },
  format: `${fn}({value})`,
  negative,
  also: chain,
})
/** A filter step that has a default: `grayscale` alone is `grayscale(100%)`. */
const whole = (layer: string, value: string, chain: Record<string, string>) =>
  fixed({ [`{compose.${layer}}`]: value, ...chain })

/** tw-animate-css: a layer of the `enter` or `exit` keyframes, alone or with a number. */
const layerOf = (
  layer: string,
  alone: string,
  number: { step: number; unit: string },
  negative = false
): UtilityRule[] => [
  fixed({ [`{compose.${layer}}`]: alone }),
  { properties: [`{compose.${layer}}`], number, negative },
]
/** `slide-in-from-top-2`: a translate of the spacing scale, negated towards the top and left. */
const slide = (layer: string, towards: boolean): UtilityRule[] => [
  fixed({ [`{compose.${layer}}`]: towards ? "-100%" : "100%" }),
  {
    properties: [`{compose.${layer}}`],
    scale: "space",
    number: SPACING,
    fractions: true,
    ...(towards ? { format: "calc({value} * -1)" } : {}),
  },
]
const ANIMATION = (name: string, rest: Record<string, string>) =>
  fixed({ animationName: `{animation.${name}}`, ...rest })
const SCALE = { scale: "{compose.scale-x} {compose.scale-y}" }
const translate = (axes: string[]): UtilityRule[] => {
  const properties = axes.map((axis) => `{compose.translate-${axis}}`)
  return [
    space(properties, true, true, TRANSLATE),
    keyword(properties, { full: "100%", px: "1px" }, TRANSLATE),
  ]
}
const scaled = (axes: string[]): UtilityRule[] => [
  {
    properties: axes.map((axis) => `{compose.scale-${axis}}`),
    number: { step: 1, unit: "%" },
    negative: true,
    also: SCALE,
  },
]
/** A bare number with a unit: `border-3` is `3px`, `duration-450` is `450ms`. */
const numbered = (
  properties: string[],
  unit: string,
  also?: Record<string, string>
): UtilityRule => ({
  properties,
  number: { step: 1, unit },
  ...(also ? { also } : {}),
})
const keyword = (
  properties: string[],
  values: Record<string, string>,
  also?: Record<string, string>
): UtilityRule => ({ properties, values, ...(also ? { also } : {}) })
const fixed = (declarations: Record<string, string>): UtilityRule => ({
  static: declarations,
})
const colour = (properties: string[]): UtilityRule[] => [
  { properties, scale: "color", alpha: true },
  keyword(properties, {
    inherit: "inherit",
    current: "currentColor",
    transparent: "transparent",
  }),
]

/** Tailwind's blend modes, for `mix-blend-*` and `bg-blend-*`. */
const BLEND_MODES = Object.fromEntries(
  [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
    "plus-darker",
    "plus-lighter",
  ].map((value) => [value, value])
)

/** `1` … `n` as keys, each value built from the number. */
const counted = (to: number, value: (n: number) => string) =>
  Object.fromEntries(
    Array.from({ length: to }, (_, index) => [
      String(index + 1),
      value(index + 1),
    ])
  )

const SIZES = {
  auto: "auto",
  full: "100%",
  min: "min-content",
  max: "max-content",
  fit: "fit-content",
}
const width = (property: string, viewport: string): UtilityRule[] => [
  space([property], false, true),
  keyword([property], {
    ...SIZES,
    screen: `100${viewport}`,
    [`s${viewport}`]: `100s${viewport}`,
    [`l${viewport}`]: `100l${viewport}`,
    [`d${viewport}`]: `100d${viewport}`,
  }),
]

/** Margins, padding and insets: every side, both axes and both logical ends. */
const SIDES: Record<string, string[]> = {
  // Both axes rather than the physical shorthand: the value is the same on every side in any writing
  // mode, and a later `p-0` then replaces an earlier `py-4` entry for entry, as `cn()` did.
  "": ["Block", "Inline"],
  x: ["Inline"],
  y: ["Block"],
  s: ["InlineStart"],
  e: ["InlineEnd"],
  t: ["Top"],
  r: ["Right"],
  b: ["Bottom"],
  l: ["Left"],
}
const sides = (root: string, property: string, negative: boolean) =>
  Object.fromEntries(
    Object.entries(SIDES).map(([side, suffixes]) => {
      const properties = suffixes.map((suffix) => property + suffix)
      const rules: UtilityRule[] = [space(properties, negative)]
      if (property === "margin")
        rules.push(keyword(properties, { auto: "auto" }))
      return [side ? `${root}${side}` : root, rules]
    })
  )

const INSETS: Record<string, string[]> = {
  inset: ["insetBlock", "insetInline"],
  "inset-x": ["insetInline"],
  "inset-y": ["insetBlock"],
  start: ["insetInlineStart"],
  end: ["insetInlineEnd"],
  top: ["top"],
  right: ["right"],
  bottom: ["bottom"],
  left: ["left"],
}

/** Border widths for each side, each also making the border solid, as Tailwind v4 does. */
const BORDER_SIDES: Record<string, string> = {
  border: "borderWidth",
  "border-x": "borderInlineWidth",
  "border-y": "borderBlockWidth",
  "border-s": "borderInlineStartWidth",
  "border-e": "borderInlineEndWidth",
  "border-t": "borderTopWidth",
  "border-r": "borderRightWidth",
  "border-b": "borderBottomWidth",
  "border-l": "borderLeftWidth",
}
// Tailwind v4 composes the style: `border-dashed` then `border` (a caller's) stays dashed.
const SOLID = { borderStyle: "{compose.border-style}" }
const borders = Object.fromEntries(
  Object.entries(BORDER_SIDES).map(([root, property]) => {
    const colourProperty = property.replace("Width", "Color")
    const rules: UtilityRule[] = [
      fixed({ [property]: "1px", ...SOLID }),
      numbered([property], "px", SOLID),
      ...colour([colourProperty]),
    ]
    if (root === "border") {
      rules.push(
        keyword(["borderStyle", "{compose.border-style}"], {
          solid: "solid",
          dashed: "dashed",
          dotted: "dotted",
          double: "double",
          hidden: "hidden",
          none: "none",
        }),
        keyword(["borderCollapse"], {
          collapse: "collapse",
          separate: "separate",
        })
      )
    }
    return [root, rules]
  })
)

const CORNERS: Record<string, string[]> = {
  rounded: ["borderRadius"],
  "rounded-t": ["borderTopLeftRadius", "borderTopRightRadius"],
  "rounded-r": ["borderTopRightRadius", "borderBottomRightRadius"],
  "rounded-b": ["borderBottomRightRadius", "borderBottomLeftRadius"],
  "rounded-l": ["borderTopLeftRadius", "borderBottomLeftRadius"],
  "rounded-s": ["borderStartStartRadius", "borderEndStartRadius"],
  "rounded-e": ["borderStartEndRadius", "borderEndEndRadius"],
  "rounded-tl": ["borderTopLeftRadius"],
  "rounded-tr": ["borderTopRightRadius"],
  "rounded-br": ["borderBottomRightRadius"],
  "rounded-bl": ["borderBottomLeftRadius"],
}
const corners = Object.fromEntries(
  Object.entries(CORNERS).map(([root, properties]) => [
    root,
    [
      // `rounded` alone is Tailwind v4's 0.25rem, the `sm` step.
      fixed(
        Object.fromEntries(properties.map((property) => [property, "0.25rem"]))
      ),
      { properties, scale: "radius" },
      keyword(properties, { none: "0", full: "calc(infinity * 1px)" }),
    ] satisfies UtilityRule[],
  ])
)

const DISPLAY: Record<string, string> = {
  block: "block",
  "inline-block": "inline-block",
  inline: "inline",
  flex: "flex",
  "inline-flex": "inline-flex",
  grid: "grid",
  "inline-grid": "inline-grid",
  contents: "contents",
  table: "table",
  "table-row": "table-row",
  "table-cell": "table-cell",
  "flow-root": "flow-root",
  "list-item": "list-item",
  hidden: "none",
}

const ALIGN = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  baseline: "baseline",
  stretch: "stretch",
}
const JUSTIFY = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
  stretch: "stretch",
  normal: "normal",
}

/** `transition-*` property lists, as Tailwind v4 declares them. */
const COLOURS =
  "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"
/**
 * Timing through the `compose` layers `duration-*` and `ease-*` also set, as Tailwind's
 * `var(--tw-duration, …)`: `duration-200 transition` and `transition duration-200` agree.
 */
const TRANSITION = {
  transitionTimingFunction: "{compose.transition-ease}",
  transitionDuration: "{compose.transition-duration}",
}
const transition = (property: string) => ({
  transitionProperty: property,
  ...TRANSITION,
})

const utilities: Record<string, UtilityRule[]> = {
  // Layout
  ...Object.fromEntries(
    Object.entries(DISPLAY).map(([name, value]) => [
      name,
      [fixed({ display: value })],
    ])
  ),
  static: [fixed({ position: "static" })],
  fixed: [fixed({ position: "fixed" })],
  absolute: [fixed({ position: "absolute" })],
  relative: [fixed({ position: "relative" })],
  sticky: [fixed({ position: "sticky" })],
  visible: [fixed({ visibility: "visible" })],
  invisible: [fixed({ visibility: "hidden" })],
  isolate: [fixed({ isolation: "isolate" })],
  overflow: [
    keyword(["overflow"], {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
  ],
  "overflow-x": [
    keyword(["overflowX"], {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
  ],
  "overflow-y": [
    keyword(["overflowY"], {
      auto: "auto",
      hidden: "hidden",
      clip: "clip",
      visible: "visible",
      scroll: "scroll",
    }),
  ],
  z: [
    {
      properties: ["zIndex"],
      scale: "zIndex",
      number: { step: 1, unit: "" },
      negative: true,
    },
    keyword(["zIndex"], { auto: "auto" }),
  ],
  object: [
    keyword(["objectFit"], {
      contain: "contain",
      cover: "cover",
      fill: "fill",
      none: "none",
      "scale-down": "scale-down",
    }),
  ],
  aspect: [
    keyword(["aspectRatio"], {
      auto: "auto",
      square: "1 / 1",
      video: "16 / 9",
    }),
  ],
  ...Object.fromEntries(
    Object.entries(INSETS).map(([root, properties]) => [
      root,
      [
        space(properties, true, true),
        keyword(properties, { auto: "auto", full: "100%" }),
      ],
    ])
  ),

  // Flexbox and grid
  // `flex` alone is a display; `flex-row`, `flex-wrap` and `flex-1` are the rest.
  flex: [
    fixed({ display: "flex" }),
    keyword(["flexDirection"], {
      row: "row",
      "row-reverse": "row-reverse",
      col: "column",
      "col-reverse": "column-reverse",
    }),
    keyword(["flexWrap"], {
      wrap: "wrap",
      "wrap-reverse": "wrap-reverse",
      nowrap: "nowrap",
    }),
    keyword(["flex"], {
      "1": "1 1 0%",
      auto: "1 1 auto",
      initial: "0 1 auto",
      none: "none",
    }),
    // `flex-0`, `flex-2`: the number as written.
    numbered(["flex"], ""),
  ],
  grow: [fixed({ flexGrow: "1" }), keyword(["flexGrow"], { "0": "0" })],
  shrink: [fixed({ flexShrink: "1" }), keyword(["flexShrink"], { "0": "0" })],
  basis: [
    space(["flexBasis"], false, true),
    keyword(["flexBasis"], { auto: "auto", full: "100%" }),
  ],
  order: [
    keyword(["order"], {
      ...counted(12, String),
      first: "-9999",
      last: "9999",
      none: "0",
    }),
  ],
  "grid-cols": [
    keyword(["gridTemplateColumns"], {
      ...counted(12, (n) => `repeat(${n}, minmax(0, 1fr))`),
      none: "none",
      subgrid: "subgrid",
    }),
  ],
  "grid-rows": [
    keyword(["gridTemplateRows"], {
      ...counted(12, (n) => `repeat(${n}, minmax(0, 1fr))`),
      none: "none",
      subgrid: "subgrid",
    }),
  ],
  "auto-cols": [
    keyword(["gridAutoColumns"], {
      auto: "auto",
      min: "min-content",
      max: "max-content",
      fr: "minmax(0, 1fr)",
    }),
  ],
  "auto-rows": [
    keyword(["gridAutoRows"], {
      auto: "auto",
      min: "min-content",
      max: "max-content",
      fr: "minmax(0, 1fr)",
    }),
  ],
  "col-start": [
    numbered(["gridColumnStart"], ""),
    keyword(["gridColumnStart"], { auto: "auto" }),
  ],
  "col-end": [
    numbered(["gridColumnEnd"], ""),
    keyword(["gridColumnEnd"], { auto: "auto" }),
  ],
  "row-start": [
    numbered(["gridRowStart"], ""),
    keyword(["gridRowStart"], { auto: "auto" }),
  ],
  "row-end": [
    numbered(["gridRowEnd"], ""),
    keyword(["gridRowEnd"], { auto: "auto" }),
  ],
  "col-span": [
    keyword(["gridColumn"], {
      ...counted(12, (n) => `span ${n} / span ${n}`),
      full: "1 / -1",
    }),
  ],
  "row-span": [
    keyword(["gridRow"], {
      ...counted(12, (n) => `span ${n} / span ${n}`),
      full: "1 / -1",
    }),
  ],
  gap: [space(["gap"])],
  "gap-x": [space(["columnGap"])],
  "gap-y": [space(["rowGap"])],
  items: [keyword(["alignItems"], ALIGN)],
  self: [keyword(["alignSelf"], { auto: "auto", ...ALIGN })],
  justify: [keyword(["justifyContent"], JUSTIFY)],
  "justify-items": [
    keyword(["justifyItems"], {
      start: "start",
      end: "end",
      center: "center",
      stretch: "stretch",
    }),
  ],
  "justify-self": [
    keyword(["justifySelf"], {
      auto: "auto",
      start: "start",
      end: "end",
      center: "center",
      stretch: "stretch",
    }),
  ],
  content: [keyword(["alignContent"], { ...JUSTIFY, baseline: "baseline" })],
  "place-items": [
    keyword(["placeItems"], {
      start: "start",
      end: "end",
      center: "center",
      stretch: "stretch",
      baseline: "baseline",
    }),
  ],
  "place-content": [
    keyword(["placeContent"], {
      start: "start",
      end: "end",
      center: "center",
      between: "space-between",
      around: "space-around",
      evenly: "space-evenly",
      stretch: "stretch",
    }),
  ],

  // Spacing
  ...sides("p", "padding", false),
  ...sides("m", "margin", true),

  // Sizing
  w: width("width", "vw"),
  h: width("height", "vh"),
  "min-w": [
    { properties: ["minWidth"], scale: "containerSize" },
    ...width("minWidth", "vw"),
  ],
  "min-h": width("minHeight", "vh"),
  "max-h": width("maxHeight", "vh"),
  "max-w": [
    { properties: ["maxWidth"], scale: "containerSize" },
    ...width("maxWidth", "vw"),
    keyword(["maxWidth"], { none: "none", prose: "65ch" }),
  ],
  size: [
    space(["width", "height"], false, true),
    keyword(["width", "height"], SIZES),
  ],

  // Typography
  text: [
    {
      properties: ["fontSize"],
      scale: "fontSize",
      pair: { lineHeight: "lineHeight" },
    },
    ...colour(["color"]),
    keyword(["textAlign"], {
      left: "left",
      center: "center",
      right: "right",
      justify: "justify",
      start: "start",
      end: "end",
    }),
    keyword(["textWrap"], {
      wrap: "wrap",
      nowrap: "nowrap",
      balance: "balance",
      pretty: "pretty",
    }),
    keyword(["textOverflow"], { ellipsis: "ellipsis", clip: "clip" }),
  ],
  font: [
    { properties: ["fontWeight"], scale: "fontWeight" },
    { properties: ["fontFamily"], scale: "fontFamily" },
  ],
  leading: [
    { properties: ["lineHeight"], scale: "leading", number: SPACING },
    keyword(["lineHeight"], { none: "1" }),
  ],
  tracking: [{ properties: ["letterSpacing"], scale: "letterSpacing" }],
  italic: [fixed({ fontStyle: "italic" })],
  "not-italic": [fixed({ fontStyle: "normal" })],
  uppercase: [fixed({ textTransform: "uppercase" })],
  lowercase: [fixed({ textTransform: "lowercase" })],
  capitalize: [fixed({ textTransform: "capitalize" })],
  "normal-case": [fixed({ textTransform: "none" })],
  underline: [fixed({ textDecorationLine: "underline" })],
  overline: [fixed({ textDecorationLine: "overline" })],
  "line-through": [fixed({ textDecorationLine: "line-through" })],
  "no-underline": [fixed({ textDecorationLine: "none" })],
  truncate: [
    fixed({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
  ],
  whitespace: [
    keyword(["whiteSpace"], {
      normal: "normal",
      nowrap: "nowrap",
      pre: "pre",
      "pre-line": "pre-line",
      "pre-wrap": "pre-wrap",
      "break-spaces": "break-spaces",
    }),
  ],
  break: [
    keyword(["wordBreak"], {
      normal: "normal",
      all: "break-all",
      keep: "keep-all",
    }),
  ],
  "wrap-break-word": [fixed({ overflowWrap: "break-word" })],
  "tabular-nums": [fixed({ fontVariantNumeric: "tabular-nums" })],
  "line-clamp": [
    numbered(["WebkitLineClamp"], "", {
      overflow: "hidden",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
    }),
    keyword(
      ["WebkitLineClamp"],
      { none: "unset" },
      {
        overflow: "visible",
        display: "block",
        WebkitBoxOrient: "horizontal",
      }
    ),
  ],
  list: [
    keyword(["listStyleType"], {
      none: "none",
      disc: "disc",
      decimal: "decimal",
    }),
    keyword(["listStylePosition"], { inside: "inside", outside: "outside" }),
  ],
  decoration: colour(["textDecorationColor"]),
  "underline-offset": [
    numbered(["textUnderlineOffset"], "px"),
    keyword(["textUnderlineOffset"], { auto: "auto" }),
  ],

  // Tables
  caption: [keyword(["captionSide"], { top: "top", bottom: "bottom" })],

  // Colour
  bg: colour(["backgroundColor"]),
  "bg-clip": [
    keyword(["backgroundClip"], {
      border: "border-box",
      padding: "padding-box",
      content: "content-box",
      text: "text",
    }),
  ],
  fill: colour(["fill"]),
  stroke: colour(["stroke"]),
  caret: colour(["caretColor"]),
  accent: colour(["accentColor"]),

  // Borders and outlines
  ...borders,
  ...corners,
  // Tailwind v4 composes the style: `outline-hidden` then `focus-visible:outline-2` stays hidden.
  outline: [
    fixed({ outlineStyle: "{compose.outline-style}", outlineWidth: "1px" }),
    numbered(["outlineWidth"], "px", {
      outlineStyle: "{compose.outline-style}",
    }),
    ...colour(["outlineColor"]),
    keyword(["outlineStyle", "{compose.outline-style}"], {
      none: "none",
      solid: "solid",
      dashed: "dashed",
      dotted: "dotted",
      double: "double",
    }),
  ],
  "outline-hidden": [
    fixed({ "{compose.outline-style}": "none", outlineStyle: "none" }),
  ],
  "outline-offset": [numbered(["outlineOffset"], "px")],

  // Effects
  shadow: [
    // `shadow` alone is Tailwind v4's `sm` step.
    fixed({
      "{compose.shadow}":
        "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      ...BOX_SHADOW,
    }),
    { properties: ["{compose.shadow}"], scale: "shadow", also: BOX_SHADOW },
    keyword(["{compose.shadow}"], { none: "0 0 #0000" }, BOX_SHADOW),
  ],
  ring: [
    // `ring` alone is 1px wide; the colour defaults to the text colour.
    fixed({ "{compose.ring-width}": "1px", ...RING }),
    numbered(["{compose.ring-width}"], "px", RING),
    { properties: ["{compose.ring-color}"], scale: "color", alpha: true },
    keyword(["{compose.ring-color}"], {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
    }),
  ],
  "text-shadow": [
    { properties: ["textShadow"], scale: "textShadow" },
    keyword(["textShadow"], { none: "none" }),
  ],
  opacity: [numbered(["opacity"], "%")],
  "mix-blend": [keyword(["mixBlendMode"], BLEND_MODES)],
  // `plus-darker` and `plus-lighter` are compositing operators, not background blend modes.
  "bg-blend": [
    keyword(
      ["backgroundBlendMode"],
      Object.fromEntries(
        Object.entries(BLEND_MODES).filter(
          ([mode]) => !mode.startsWith("plus-")
        )
      )
    ),
  ],

  // Transitions
  transition: [
    fixed(
      transition(
        `${COLOURS}, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events`
      )
    ),
    // `transition-[width]`: the property as written, timed like the rest.
    keyword(["transitionProperty"], {}, TRANSITION),
    // `transition-none` over a component's `transition-all` removed that whole utility through
    // `cn()`; nothing transitions either way, and the timing and duration are back to initial.
    keyword(
      ["transitionProperty"],
      { none: "none" },
      { transitionTimingFunction: "ease", transitionDuration: "0s" }
    ),
  ],
  "transition-all": [fixed(transition("all"))],
  "transition-colors": [fixed(transition(COLOURS))],
  "transition-opacity": [fixed(transition("opacity"))],
  "transition-shadow": [fixed(transition("box-shadow"))],
  "transition-transform": [
    fixed(transition("transform, translate, scale, rotate")),
  ],
  duration: [
    {
      // `--tw-duration` in Tailwind: it also times `animate-in` and `animate-out`.
      properties: [
        "transitionDuration",
        "{compose.transition-duration}",
        "{compose.animation-duration}",
      ],
      scale: "duration",
      number: { step: 1, unit: "ms" },
    },
  ],
  delay: [
    {
      // tw-animate-css's `delay-*` delays animations too.
      properties: ["transitionDelay", "animationDelay"],
      scale: "duration",
      number: { step: 1, unit: "ms" },
    },
  ],

  // Transforms
  translate: translate(["x", "y"]),
  "translate-x": translate(["x"]),
  "translate-y": translate(["y"]),
  scale: [...scaled(["x", "y"]), keyword(["scale"], { none: "none" })],
  "scale-x": scaled(["x"]),
  "scale-y": scaled(["y"]),
  rotate: [
    {
      properties: ["rotate"],
      number: { step: 1, unit: "deg" },
      negative: true,
    },
    keyword(["rotate"], { none: "none" }),
  ],
  origin: [
    keyword(["transformOrigin"], {
      center: "center",
      top: "top",
      "top-right": "top right",
      right: "right",
      "bottom-right": "bottom right",
      bottom: "bottom",
      "bottom-left": "bottom left",
      left: "left",
      "top-left": "top left",
    }),
  ],
  "will-change": [
    keyword(["willChange"], {
      auto: "auto",
      scroll: "scroll-position",
      contents: "contents",
      transform: "transform",
    }),
  ],
  touch: [
    keyword(["touchAction"], {
      auto: "auto",
      none: "none",
      manipulation: "manipulation",
      "pan-x": "pan-x",
      "pan-y": "pan-y",
      "pinch-zoom": "pinch-zoom",
    }),
  ],

  transform: [keyword(["transform"], { none: "none" })],

  // Scrolling and sizing behaviour
  ...sides("scroll-m", "scrollMargin", true),
  ...sides("scroll-p", "scrollPadding", false),
  ...Object.fromEntries(
    [
      ["overscroll", "overscrollBehavior"],
      ["overscroll-x", "overscrollBehaviorX"],
      ["overscroll-y", "overscrollBehaviorY"],
    ].map(([root, property]) => [
      root,
      [
        keyword([property!], {
          auto: "auto",
          contain: "contain",
          none: "none",
        }),
      ],
    ])
  ),
  contain: [
    keyword(
      ["contain"],
      Object.fromEntries(
        [
          "none",
          "content",
          "strict",
          "size",
          "inline-size",
          "layout",
          "paint",
          "style",
        ].map((value) => [value, value])
      )
    ),
  ],
  align: [
    keyword(
      ["verticalAlign"],
      Object.fromEntries(
        [
          "baseline",
          "top",
          "middle",
          "bottom",
          "text-top",
          "text-bottom",
          "sub",
          "super",
        ].map((value) => [value, value])
      )
    ),
  ],
  "field-sizing": [
    keyword(["fieldSizing"], { fixed: "fixed", content: "content" }),
  ],

  // Container queries: `@container`, and `@container/name` names it.
  "@container": [fixed({ containerType: "inline-size" })],
  ease: [
    {
      properties: [
        "transitionTimingFunction",
        "{compose.transition-ease}",
        "{compose.animation-ease}",
      ],
      scale: "easing",
      aliases: { "in-out": "inOut" },
    },
    keyword(
      [
        "transitionTimingFunction",
        "{compose.transition-ease}",
        "{compose.animation-ease}",
      ],
      {
        linear: "linear",
      }
    ),
  ],

  // Filters
  blur: [
    whole("blur", "blur(8px)", FILTER),
    {
      properties: ["{compose.blur}"],
      scale: "blur",
      format: "blur({value})",
      also: FILTER,
    },
  ],
  brightness: [step("brightness", "brightness", "%", FILTER)],
  contrast: [step("contrast", "contrast", "%", FILTER)],
  saturate: [step("saturate", "saturate", "%", FILTER)],
  grayscale: [
    whole("grayscale", "grayscale(100%)", FILTER),
    step("grayscale", "grayscale", "%", FILTER),
  ],
  invert: [
    whole("invert", "invert(100%)", FILTER),
    step("invert", "invert", "%", FILTER),
  ],
  sepia: [
    whole("sepia", "sepia(100%)", FILTER),
    step("sepia", "sepia", "%", FILTER),
  ],
  "hue-rotate": [step("hue-rotate", "hue-rotate", "deg", FILTER, true)],
  "filter-none": [fixed({ filter: "none" })],
  "backdrop-blur": [
    whole("backdrop-blur", "blur(8px)", BACKDROP),
    {
      properties: ["{compose.backdrop-blur}"],
      scale: "blur",
      format: "blur({value})",
      also: BACKDROP,
    },
  ],
  "backdrop-brightness": [
    step("backdrop-brightness", "brightness", "%", BACKDROP),
  ],
  "backdrop-contrast": [step("backdrop-contrast", "contrast", "%", BACKDROP)],
  "backdrop-saturate": [step("backdrop-saturate", "saturate", "%", BACKDROP)],
  "backdrop-opacity": [step("backdrop-opacity", "opacity", "%", BACKDROP)],
  "backdrop-grayscale": [
    whole("backdrop-grayscale", "grayscale(100%)", BACKDROP),
    step("backdrop-grayscale", "grayscale", "%", BACKDROP),
  ],
  "backdrop-invert": [
    whole("backdrop-invert", "invert(100%)", BACKDROP),
    step("backdrop-invert", "invert", "%", BACKDROP),
  ],
  "backdrop-sepia": [
    whole("backdrop-sepia", "sepia(100%)", BACKDROP),
    step("backdrop-sepia", "sepia", "%", BACKDROP),
  ],
  "backdrop-hue-rotate": [
    step("backdrop-hue-rotate", "hue-rotate", "deg", BACKDROP, true),
  ],
  "backdrop-filter-none": [fixed({ backdropFilter: "none" })],

  // Animations: Tailwind's, and tw-animate-css's enter and exit layers
  "animate-in": [
    ANIMATION("enter", {
      animationDuration: "{compose.animation-duration}",
      animationTimingFunction: "{compose.animation-ease}",
    }),
  ],
  "animate-out": [
    ANIMATION("exit", {
      animationDuration: "{compose.animation-duration}",
      animationTimingFunction: "{compose.animation-ease}",
    }),
  ],
  "animate-spin": [
    ANIMATION("spin", {
      animationDuration: "1s",
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
    }),
  ],
  "animate-ping": [
    ANIMATION("ping", {
      animationDuration: "1s",
      animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
      animationIterationCount: "infinite",
    }),
  ],
  "animate-pulse": [
    ANIMATION("pulse", {
      animationDuration: "2s",
      animationTimingFunction: "cubic-bezier(0.4, 0, 0.6, 1)",
      animationIterationCount: "infinite",
    }),
  ],
  "animate-bounce": [
    ANIMATION("bounce", {
      animationDuration: "1s",
      animationIterationCount: "infinite",
    }),
  ],
  "animate-none": [fixed({ animationName: "none" })],
  ...Object.fromEntries(
    [
      "accordion-down",
      "accordion-up",
      "collapsible-down",
      "collapsible-up",
    ].map((name) => [
      `animate-${name}`,
      [
        ANIMATION(name, {
          animationDuration: "0.2s",
          animationTimingFunction: "ease-out",
        }),
      ],
    ])
  ),
  "animate-caret-blink": [
    ANIMATION("caret-blink", {
      animationDuration: "1.25s",
      animationTimingFunction: "ease-out",
      animationIterationCount: "infinite",
    }),
  ],
  "fade-in": layerOf("enter-opacity", "0", { step: 0.01, unit: "" }),
  "fade-out": layerOf("exit-opacity", "0", { step: 0.01, unit: "" }),
  "zoom-in": layerOf("enter-scale", "0", { step: 1, unit: "%" }, true),
  "zoom-out": layerOf("exit-scale", "0", { step: 1, unit: "%" }, true),
  "spin-in": layerOf("enter-rotate", "30deg", { step: 1, unit: "deg" }, true),
  "spin-out": layerOf("exit-rotate", "30deg", { step: 1, unit: "deg" }, true),
  "blur-in": layerOf("enter-blur", "20px", { step: 1, unit: "px" }),
  "blur-out": layerOf("exit-blur", "20px", { step: 1, unit: "px" }),
  "slide-in-from-top": slide("enter-translate-y", true),
  "slide-in-from-bottom": slide("enter-translate-y", false),
  "slide-in-from-left": slide("enter-translate-x", true),
  "slide-in-from-right": slide("enter-translate-x", false),
  "slide-out-to-top": slide("exit-translate-y", true),
  "slide-out-to-bottom": slide("exit-translate-y", false),
  "slide-out-to-left": slide("exit-translate-x", true),
  "slide-out-to-right": slide("exit-translate-x", false),
  "animation-duration": [
    numbered(["animationDuration", "{compose.animation-duration}"], "ms"),
  ],
  repeat: [
    numbered(["animationIterationCount"], ""),
    keyword(["animationIterationCount"], { infinite: "infinite" }),
  ],
  direction: [
    keyword(["animationDirection"], {
      normal: "normal",
      reverse: "reverse",
      alternate: "alternate",
      "alternate-reverse": "alternate-reverse",
    }),
  ],
  "fill-mode": [
    keyword(["animationFillMode"], {
      none: "none",
      forwards: "forwards",
      backwards: "backwards",
      both: "both",
    }),
  ],
  running: [fixed({ animationPlayState: "running" })],
  paused: [fixed({ animationPlayState: "paused" })],

  // Interactivity
  cursor: [
    keyword(
      ["cursor"],
      Object.fromEntries(
        [
          "auto",
          "default",
          "pointer",
          "wait",
          "text",
          "move",
          "help",
          "not-allowed",
          "none",
          "progress",
          "crosshair",
          "grab",
          "grabbing",
        ].map((value) => [value, value])
      )
    ),
  ],
  select: [
    keyword(["userSelect"], {
      none: "none",
      text: "text",
      all: "all",
      auto: "auto",
    }),
  ],
  "pointer-events": [
    keyword(["pointerEvents"], { none: "none", auto: "auto" }),
  ],
  resize: [
    fixed({ resize: "both" }),
    keyword(["resize"], { none: "none", x: "horizontal", y: "vertical" }),
  ],
  "appearance-none": [fixed({ appearance: "none" })],
  "sr-only": [
    fixed({
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      // Tailwind 4 clips with `clip-path`, not the deprecated `clip`.
      clipPath: "inset(50%)",
      whiteSpace: "nowrap",
      borderWidth: "0",
    }),
  ],
}

const variants: Record<string, string> = {
  // Pseudo-classes
  ...Object.fromEntries(
    [
      "hover",
      "focus",
      "focus-visible",
      "focus-within",
      "active",
      "visited",
      "target",
      "disabled",
      "enabled",
      "checked",
      "indeterminate",
      "default",
      "required",
      "valid",
      "invalid",
      "read-only",
      "empty",
      "placeholder-shown",
      "autofill",
    ].map((name) => [name, `:${name}`])
  ),
  first: ":first-child",
  last: ":last-child",
  only: ":only-child",
  odd: ":nth-child(odd)",
  even: ":nth-child(even)",
  "first-of-type": ":first-of-type",
  "last-of-type": ":last-of-type",
  // `<details open>`, `<dialog open>`: Tailwind v4 matches the attribute.
  open: "[open]",
  // Writing direction
  rtl: ":dir(rtl)",
  ltr: ":dir(ltr)",
  // Pseudo-elements: a block of their own in css(); `before:` and `after:` also get `content: ""`.
  before: "::before",
  after: "::after",
  placeholder: "::placeholder",
  file: "::file-selector-button",
  selection: "::selection",
  marker: "::marker",
  backdrop: "::backdrop",
  "first-letter": "::first-letter",
  "first-line": "::first-line",
  // Breakpoints, as `breakpoint.*` in this preset
  sm: "@media (width >= 40rem)",
  md: "@media (width >= 48rem)",
  lg: "@media (width >= 64rem)",
  xl: "@media (width >= 80rem)",
  "2xl": "@media (width >= 96rem)",
  "max-sm": "@media (width < 40rem)",
  "max-md": "@media (width < 48rem)",
  "max-lg": "@media (width < 64rem)",
  "max-xl": "@media (width < 80rem)",
  "max-2xl": "@media (width < 96rem)",
  // Container queries, as `containerQuery.*` in this preset
  "@3xs": "@container (width >= 16rem)",
  "@2xs": "@container (width >= 18rem)",
  "@xs": "@container (width >= 20rem)",
  "@sm": "@container (width >= 24rem)",
  "@md": "@container (width >= 28rem)",
  "@lg": "@container (width >= 32rem)",
  "@xl": "@container (width >= 36rem)",
  "@2xl": "@container (width >= 42rem)",
  "@3xl": "@container (width >= 48rem)",
  "@4xl": "@container (width >= 56rem)",
  "@5xl": "@container (width >= 64rem)",
  "@6xl": "@container (width >= 72rem)",
  "@7xl": "@container (width >= 80rem)",
  // Preferences
  "motion-safe": "@media (prefers-reduced-motion: no-preference)",
  "motion-reduce": "@media (prefers-reduced-motion: reduce)",
  "contrast-more": "@media (prefers-contrast: more)",
  print: "@media print",
}

export const grammar: UtilityGrammar = {
  scales: Object.fromEntries(
    [
      "space",
      "color",
      "fontSize",
      "lineHeight",
      "fontWeight",
      "fontFamily",
      "letterSpacing",
      "leading",
      "radius",
      "shadow",
      "textShadow",
      "blur",
      "duration",
      "easing",
      "zIndex",
      "containerSize",
      "compose",
      "animation",
    ].map((name) => [name, scale(name)])
  ),
  utilities,
  variants,
}
