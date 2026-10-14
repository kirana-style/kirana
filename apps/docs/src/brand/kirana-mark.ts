/**
 * The petal K: a mark of three parts — a stem, an arm and a leg — rebuilt from a grid and
 * Fibonacci circles so anyone can redraw it with a compass and a rule, not by tracing a file.
 *
 * Construction (units u; the mark is 16u × 21.5u):
 *
 * - **Width 16u, height 21.5u.** The stem's left edge is x = 0 and its top y = 0. The arm's tip is
 *   at (16, 2), 2u below the stem's top; the leg's tip is the bottom-right corner (16, 21.5).
 * - **One width, 5u (F5), for all three parts:** the stem is 5u wide, the arm 5u at its widest, the
 *   leg a 5u band.
 * - **One weight:** the stem rises 2u above the arm's tip and the leg ends 1.5u short of where the
 *   first cut ended, so the three parts show the same area to within 3 % ("Even" on /brand/mark).
 * - **The leg runs at 36°**, the angle of the golden triangle (cos 36° = φ / 2).
 * - **Every curve is an arc of a circle whose radius is a Fibonacci number** (3, 5, 8, 13, 55u), and
 *   every arc meets the next edge tangent to it: no kinks. Points are sharp only at the tips and
 *   where the leg docks under the arm.
 * - **The stem and the arm share one edge**: the arm's upper edge is also the stem's lower-right
 *   edge, from the notch at x = 5 down to the bottom tip.
 *
 * The values below are produced by the construction script (kirana-spec `brand/logo-fit/chosen.ts`),
 * which builds the mark from its circles and measures it against the reference drawing.
 */

export const MARK = {
  width: 16,
  height: 21.5,
  stroke: 5,
  legAngle: 36,
} as const

/** The three parts, in u. Painted stem → leg → arm: the arm lies over the stem and the leg's tip. */
export const PARTS = {
  stem: "M0 16.5829L0 0A5 5 0 0 1 5 5L5 8.8131A55 55 0 0 0 1.1191 13.9874A8 8 0 0 0 0 16.5829Z",
  arm: "M0 16.5829A8 8 0 0 1 1.1191 13.9874A55 55 0 0 1 9.2279 4.3493A8 8 0 0 1 12.6708 2.4335A13 13 0 0 1 16 2A8 8 0 0 1 15.2857 5.3043A5 5 0 0 1 12.8439 7.7713L4.2366 11.7819A8 8 0 0 0 0 16.5829Z",
  leg: "M8.4322 9.8213L13.9389 13.8222A5 5 0 0 1 16 17.8673L16 21.5L7.3023 15.1808A3 3 0 0 1 8.4322 9.8213Z",
} as const

export type Part = keyof typeof PARTS
export const PAINT_ORDER: readonly Part[] = ["stem", "leg", "arm"]

/** Every circle of the construction: its part, its role, radius (Fibonacci) and centre, in u. */
export const CIRCLES = [
  {
    part: "stem",
    role: "Top: a quarter circle, radius = the width",
    r: 5,
    cx: 0,
    cy: 5,
  },
  {
    part: "arm",
    role: "Bottom tip: the flare, shared with the stem",
    r: 8,
    cx: 7.7902,
    cy: 18.4029,
  },
  {
    part: "arm",
    role: "Upper edge: the long run, shared with the stem",
    r: 55,
    cx: 46.9829,
    cy: 44.3439,
  },
  {
    part: "arm",
    role: "Upper edge: the shoulder",
    r: 8,
    cx: 14.7196,
    cy: 10.1667,
  },
  {
    part: "arm",
    role: "Upper edge: eases flat into the tip (centre on x = 16)",
    r: 13,
    cx: 16,
    cy: 15,
  },
  {
    part: "arm",
    role: "Outer edge: leaves the tip vertical (centre level with the tip)",
    r: 8,
    cx: 8,
    cy: 2,
  },
  { part: "arm", role: "Outer edge: the belly", r: 5, cx: 10.7321, cy: 3.2391 },
  {
    part: "arm",
    role: "Outer edge: the reverse curve into the bottom tip",
    r: 8,
    cx: 7.6155,
    cy: 19.0333,
  },
  {
    part: "leg",
    role: "Right end: radius = the width, centre on the bottom edge",
    r: 5,
    cx: 11,
    cy: 17.8673,
  },
  {
    part: "leg",
    role: "Left end: tangent to the bottom edge, meets the top at the dock",
    r: 3,
    cx: 9.0657,
    cy: 12.7537,
  },
] as const

/** Named points of the construction, in u. */
export const POINTS = {
  tip: { x: 0, y: 16.5829, label: "Bottom tip" },
  notch: { x: 5, y: 8.8131, label: "Notch" },
  armTip: { x: 16, y: 2, label: "Arm tip" },
  dock: { x: 8.4322, y: 9.8213, label: "Dock" },
  legTip: { x: 16, y: 21.5, label: "Leg tip" },
} as const

/** The rules a designer needs, in order. */
export const RULES = [
  "Draw a grid of 16 × 21.5 units.",
  "Every part is 5u wide (F5): the stem, the arm at its widest, and the leg.",
  "Stem: from (0, 0) down the left edge; its top is a quarter circle of 5u centred at (0, 5).",
  "Arm: its tip sits at (16, 2), 2u below the stem's top; its upper edge runs 8 → 55 → 8 → 13u from the bottom tip, and is the stem's lower edge too.",
  "Arm outer edge: leaves the tip straight down on an 8u circle centred at (8, 2), turns on 5u, runs straight, and reverses on 8u into the bottom tip.",
  "Leg: a 5u band at 36° whose bottom edge passes through (16, 21.5); its right end is a 5u circle centred on that edge, its left end a 3u circle.",
  "The leg docks where its top edge meets the arm's outer edge.",
  "Every curve meets the next edge tangent to it. Only the tips are sharp.",
] as const

/** The reference drawing (CorelDRAW, 25400 units), drawn into u by `REFERENCE_TRANSFORM`. */
export const REFERENCE = {
  stem: "M3341.12 519.36c2422.5,-60.9 4404.9,1053.64 5637.57,4170.46l0 3872.85c-3010.75,3600.01 -5324.25,7228.48 -5637.57,8808.8l0 -16852.11z",
  arm: "M22058.87 546.27c-125.1,3468.72 -1349,6089.27 -4247.14,7398.3 -8558.73,3865.82 -12338.67,3509.03 -14470.61,9426.91 455.52,-2297.52 5138.57,-8924.09 10045.77,-13498.53 4017.16,-3744.76 7187.7,-3321.53 8671.98,-3326.68z",
  leg: "M19606.66 15325.6c2656.17,1976.35 2391.94,6128.38 2417.51,9557.38 -3672.77,-2078.23 -7345.5,-4156.48 -11018.27,-6234.72 -3220.92,-2800.92 -2027.19,-7139.52 411.85,-8120.42l8188.91 4797.76z",
} as const
const UNIT = 24363.62 / 21
/** Aligned on the arm, which is unchanged: the reference moves down by the stem's 2u rise. */
export const REFERENCE_TRANSFORM = `translate(0 2) scale(${1 / UNIT}) translate(-3341.12 -519.36)`

/** Overlap of each part with the reference, aligned on the arm (0.08u raster). The stem and the leg
 *  differ by design: the stem rises 2u, the leg is shorter, so each shows the same area. */
export const FIDELITY = {
  stem: 0.8119,
  arm: 0.9249,
  leg: 0.5442,
  whole: 0.7364,
} as const

/** Widths before and after, in u: the reference's, and the one width every part now has. */
export const WIDTHS = {
  reference: { stem: 4.86, arm: 5.37, leg: 6.2 },
  constructed: { stem: 5, arm: 5, leg: 5 },
} as const

/** Areas of the parts, in u²: whole, and what shows once the arm is painted over the others. */
export const AREAS = { stem: 54.91, arm: 54.78, leg: 56.37 } as const
export const VISIBLE = { stem: 55.2, arm: 54.8, leg: 56.3 } as const

/** The reference drawing's colours, kept for comparison on /brand/mark. */
export const REFERENCE_STOPS: Record<Part, [number, string][]> = {
  stem: [
    [0, "#CD7A4F"],
    [1, "#FED589"],
  ],
  arm: [
    [0, "#E28078"],
    [1, "#FAB679"],
  ],
  leg: [
    [0, "#1552B4"],
    [0.349, "#2A46A7"],
    [1, "#3F3A9A"],
  ],
}

/**
 * The brand colours: "Ocean", one linear gradient per part, its vector in u. Cyan, blue and indigo,
 * each with a light end, so every part holds on paper, on ink and in a dark editor.
 */
export const GRADIENTS: Record<
  Part,
  { x1: number; y1: number; x2: number; y2: number; stops: [number, string][] }
> = {
  stem: {
    x1: 0.047,
    y1: 16,
    x2: 4.812,
    y2: 0.824,
    stops: [
      [0, "#06B6D4"],
      [1, "#A5F3FC"],
    ],
  },
  arm: {
    x1: 5.596,
    y1: 5.935,
    x2: 9.739,
    y2: 11.229,
    stops: [
      [0, "#3B82F6"],
      [1, "#93C5FD"],
    ],
  },
  leg: {
    x1: 20.603,
    y1: 22.374,
    x2: 8.177,
    y2: 23.621,
    stops: [
      [0, "#6366F1"],
      [1, "#A5B4FC"],
    ],
  },
}

/** A gradient set: two or more stops per part, drawn along each part's vector in `GRADIENTS`. */
export type Palette = {
  id: string
  name: string
  note: string
  stops: Record<Part, [number, string][]>
}

/**
 * Gradient sets to choose from. The reference's leg ends in a deep indigo that sinks into dark
 * surfaces (about 2 : 1 on ink); the others keep every stop light enough to stand on ink and in a
 * dark editor, and the page measures each one on paper and on ink.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: "reference",
    name: "Reference",
    note: "The reference drawing's colours: warm stem and arm, a deep indigo leg.",
    stops: REFERENCE_STOPS,
  },
  {
    id: "lifted",
    name: "Reference, lifted",
    note: "The same hues, the leg raised to a periwinkle so it holds on dark.",
    stops: {
      stem: [
        [0, "#D98A5A"],
        [1, "#FED589"],
      ],
      arm: [
        [0, "#E8857C"],
        [1, "#FAB679"],
      ],
      leg: [
        [0, "#4C7BEA"],
        [1, "#7B6FE8"],
      ],
    },
  },
  {
    id: "dawn",
    name: "Dawn",
    note: "Amber, coral and violet: a sunrise, bright on both grounds.",
    stops: {
      stem: [
        [0, "#F59E0B"],
        [1, "#FDE68A"],
      ],
      arm: [
        [0, "#F43F5E"],
        [1, "#FB923C"],
      ],
      leg: [
        [0, "#6366F1"],
        [1, "#A855F7"],
      ],
    },
  },
  {
    id: "ember",
    name: "Ember",
    note: "All warm, from gold to crimson: no part sinks into a dark ground.",
    stops: {
      stem: [
        [0, "#F59E0B"],
        [1, "#FDE047"],
      ],
      arm: [
        [0, "#F97316"],
        [1, "#FDBA74"],
      ],
      leg: [
        [0, "#E11D48"],
        [1, "#FB7185"],
      ],
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    note: "Cyan, blue and indigo: cool and calm, a light end on every part.",
    stops: {
      stem: [
        [0, "#06B6D4"],
        [1, "#A5F3FC"],
      ],
      arm: [
        [0, "#3B82F6"],
        [1, "#93C5FD"],
      ],
      leg: [
        [0, "#6366F1"],
        [1, "#A5B4FC"],
      ],
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    note: "Lime, teal and sky: fresh, and bright on ink.",
    stops: {
      stem: [
        [0, "#84CC16"],
        [1, "#D9F99D"],
      ],
      arm: [
        [0, "#14B8A6"],
        [1, "#5EEAD4"],
      ],
      leg: [
        [0, "#0EA5E9"],
        [1, "#7DD3FC"],
      ],
    },
  },
  {
    id: "orchid",
    name: "Orchid",
    note: "Pink, lilac and periwinkle: a softer bloom.",
    stops: {
      stem: [
        [0, "#EC4899"],
        [1, "#F9A8D4"],
      ],
      arm: [
        [0, "#A855F7"],
        [1, "#D8B4FE"],
      ],
      leg: [
        [0, "#6366F1"],
        [1, "#A5B4FC"],
      ],
    },
  },
  {
    id: "sunlit",
    name: "Sunlit",
    note: "Gold stem and arm over a bright blue leg: Kirana, a ray of light, on sky.",
    stops: {
      stem: [
        [0, "#F2A93B"],
        [1, "#FFE08A"],
      ],
      arm: [
        [0, "#F7B733"],
        [1, "#FFD166"],
      ],
      leg: [
        [0, "#2F6FED"],
        [1, "#5AA9FF"],
      ],
    },
  },
]

/** A flat colour per part, as stops the explorer and `KiranaMark` read like a gradient's. */
const flat = (
  name: string,
  id: string,
  note: string,
  [stem, arm, leg]: [string, string, string]
): Palette => ({
  id,
  name,
  note,
  stops: {
    stem: [
      [0, stem],
      [1, stem],
    ],
    arm: [
      [0, arm],
      [1, arm],
    ],
    leg: [
      [0, leg],
      [1, leg],
    ],
  },
})

/** A gradient set: each part from its darker stop at the start of its vector to its lighter one. */
const ramp = (
  name: string,
  id: string,
  note: string,
  [stem, arm, leg]: [[string, string], [string, string], [string, string]]
): Palette => ({
  id,
  name,
  note,
  stops: {
    stem: [
      [0, stem[0]],
      [1, stem[1]],
    ],
    arm: [
      [0, arm[0]],
      [1, arm[1]],
    ],
    leg: [
      [0, leg[0]],
      [1, leg[1]],
    ],
  },
})

/**
 * Scenery sets: one per landscape in the brand's photography, its colours picked from the picture
 * (sky, light, ground), each stop light enough to hold on ink. `kirana-spec/brand/platform` renders
 * the mark in each set on its own landscape. A set is named for its mood, never for a place.
 */
export const SCENERY: readonly Palette[] = [
  ramp(
    "Highland morning",
    "scene-highlands",
    "Sun gold, forest green and the blue of far ridges.",
    [
      ["#D9A01E", "#F4CF70"],
      ["#5E8F3E", "#AFCB86"],
      ["#2E7FB2", "#8FC1DE"],
    ]
  ),
  ramp(
    "Crater dusk",
    "scene-crater-lake",
    "Low gold sky, a pale green pool and warm stone.",
    [
      ["#D69845", "#F6CF7D"],
      ["#4FA79F", "#A8DCD3"],
      ["#A7895F", "#D9C5A0"],
    ]
  ),
  ramp(
    "Still water",
    "scene-still-water",
    "Gold light on a blue lake, reflected twice.",
    [
      ["#E0A82E", "#FCDB73"],
      ["#2F7FB0", "#8CC4E0"],
      ["#3E8A8A", "#9CC9B8"],
    ]
  ),
  ramp(
    "Turquoise lake",
    "scene-turquoise-lake",
    "Warm cliffs above clear turquoise water.",
    [
      ["#E3B04B", "#FAD774"],
      ["#2FB0A8", "#9EE6D4"],
      ["#3C84B3", "#9CC8E6"],
    ]
  ),
  ramp(
    "Old hall",
    "scene-old-hall",
    "Amber evening, a grey-blue sky, ochre walls.",
    [
      ["#D99A26", "#FAC25D"],
      ["#5E8FA6", "#A9CAD6"],
      ["#B07A3E", "#E3B77A"],
    ]
  ),
  ramp(
    "Misty hills",
    "scene-misty-hills",
    "Sunrise orange over moss and morning mist.",
    [
      ["#F0A030", "#FBD96D"],
      ["#6F9A3A", "#B9D27A"],
      ["#7FA394", "#C3D6C8"],
    ]
  ),
  ramp(
    "Heritage street",
    "scene-heritage-street",
    "Gold light, red roofs and a clear blue sky.",
    [
      ["#E2A64A", "#FCD782"],
      ["#C8602C", "#F0A070"],
      ["#4F93B5", "#A6CBD9"],
    ]
  ),
  ramp(
    "City dusk",
    "scene-city-dusk",
    "Light trails, a rose horizon and a violet sky.",
    [
      ["#E07A40", "#F6B768"],
      ["#C2577E", "#F09AA8"],
      ["#6A5BC0", "#A99BE6"],
    ]
  ),
  ramp(
    "Golden fields",
    "scene-golden-fields",
    "Straw, a summer sky and dry wheat.",
    [
      ["#E8A43A", "#F7D07A"],
      ["#3D8CC4", "#93C6E6"],
      ["#B98544", "#E6C48A"],
    ]
  ),
  ramp(
    "Rock garden",
    "scene-rock-garden",
    "Gold grass, green slopes and a hazy blue.",
    [
      ["#E0B020", "#F5D468"],
      ["#7FA83A", "#C3DB7E"],
      ["#4F96B0", "#A2CBDA"],
    ]
  ),
]

/** Solid sets: one flat colour per part, for print, embroidery, small sizes and anywhere a gradient cannot go. */
export const SOLIDS: readonly Palette[] = [
  flat(
    "Reference, flat",
    "reference-flat",
    "The reference's colours at their midpoints.",
    ["#E6A86C", "#EE9A79", "#2F449F"]
  ),
  flat(
    "Sunlit",
    "sunlit-flat",
    "Gold, orange and a bright blue: the gradient set Sunlit, flattened.",
    ["#F5B841", "#F28C38", "#3B82F6"]
  ),
  flat(
    "Signal",
    "signal",
    "Amber, red and blue: primary, loud, legible on both grounds.",
    ["#F59E0B", "#EF4444", "#3B82F6"]
  ),
  flat("Ember", "ember-flat", "Three warm steps, from gold to rose.", [
    "#FBBF24",
    "#FB923C",
    "#F43F5E",
  ]),
  flat("Ocean", "ocean-flat", "Cyan, blue and indigo.", [
    "#22D3EE",
    "#3B82F6",
    "#6366F1",
  ]),
  flat("Aurora", "aurora-flat", "Lime, teal and sky.", [
    "#84CC16",
    "#14B8A6",
    "#0EA5E9",
  ]),
  flat("Orchid", "orchid-flat", "Pink, violet and indigo.", [
    "#EC4899",
    "#A855F7",
    "#6366F1",
  ]),
  flat(
    "One blue",
    "one-blue",
    "Three steps of one blue, the site's accent: a family, not a rainbow.",
    ["#93C5FD", "#3B82F6", "#1D4ED8"]
  ),
]

/** One colour for all three petals: the mark as a single shape, split only by its seams. */
export const ONE_COLOUR: readonly Palette[] = [
  ["Ink", "ink", "#0a0a0a", "The default on light: the header and the docs."],
  ["Paper", "paper", "#fafafa", "The default on dark."],
  ["Blue", "blue", "#3B82F6", "The site's accent."],
  ["Indigo", "indigo", "#6366F1", "The reference leg's hue, lifted."],
  ["Amber", "amber", "#F59E0B", "The reference stem's warmth."],
  ["Coral", "coral", "#F97362", "The reference arm's hue."],
  ["Emerald", "emerald", "#10B981", "A green for contrast with the rest."],
  ["Violet", "violet", "#8B5CF6", "Between the blue and the pink."],
].map(([name, id, colour, note]) =>
  flat(name!, `one-${id}`, note!, [colour!, colour!, colour!])
)

/** Moves and scales a path made of M, L, A and Z commands (all this mark uses). */
export function placePath(
  d: string,
  scale: number,
  dx: number,
  dy: number
): string {
  const n = (v: number) => +v.toFixed(4)
  return d.replace(
    /([MLAZ])([^MLAZ]*)/g,
    (_, command: string, body: string) => {
      const v = body
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
      if (command === "Z") return "Z"
      if (command === "A") {
        const [rx, ry, rot, large, sweep, x, y] = v as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ]
        return `A${n(rx * scale)} ${n(ry * scale)} ${rot} ${large} ${sweep} ${n(x * scale + dx)} ${n(y * scale + dy)}`
      }
      return `${command}${n(v[0]! * scale + dx)} ${n(v[1]! * scale + dy)}`
    }
  )
}

/** Where each part's 5u width is measured: the widest circle that fits inside it (diameter 5u). */
export const WIDTH_CIRCLES = [
  { part: "stem", cx: 2.5, cy: 5.05 },
  { part: "arm", cx: 11.9, cy: 5.45 },
  { part: "leg", cx: 10.55, cy: 14.45 },
] as const

/** Points that are sharp on purpose: the tips, the stem's top corner, and the dock. */
export const TIPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 16.5829],
  [16, 2],
  [16, 21.5],
  [8.4322, 9.8213],
]
/** Where the stem's right edge meets the arm: a junction of two parts, not a corner of one. */
export const JUNCTIONS: readonly (readonly [number, number])[] = [[5, 8.8131]]

export type Arc = {
  r: number
  cx: number
  cy: number
  from: [number, number]
  to: [number, number]
  mid: [number, number]
}

/** The arcs of a part, with their centres (from the SVG arc parameters) and midpoints. */
export function arcsOf(d: string): Arc[] {
  const out: Arc[] = []
  let cur: [number, number] = [0, 0]
  for (const [, command, body] of d.matchAll(/([MLAZ])([^MLAZ]*)/g)) {
    const v = body!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (command === "M" || command === "L") cur = [v[0]!, v[1]!]
    if (command !== "A") continue
    const [r, , , large, sweep, x, y] = v as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    const to: [number, number] = [x, y]
    const mx = (cur[0] + x) / 2,
      my = (cur[1] + y) / 2,
      dx = x - cur[0],
      dy = y - cur[1],
      q = Math.hypot(dx, dy)
    const h = Math.sqrt(Math.max(0, r * r - (q / 2) ** 2)),
      side = large === sweep ? -1 : 1
    const cx = mx + (side * h * -dy) / q,
      cy = my + (side * h * dx) / q
    const a0 = Math.atan2(cur[1] - cy, cur[0] - cx)
    let a1 = Math.atan2(y - cy, x - cx)
    if (sweep && a1 < a0) a1 += 2 * Math.PI
    if (!sweep && a1 > a0) a1 -= 2 * Math.PI
    const am = (a0 + a1) / 2
    out.push({
      r,
      cx,
      cy,
      from: cur,
      to,
      mid: [cx + r * Math.cos(am), cy + r * Math.sin(am)],
    })
    cur = to
  }
  return out
}

/** Every vertex of the outlines, once: where one piece hands over to the next. */
export function joints() {
  const seen = new Map<string, [number, number]>()
  for (const d of Object.values(PARTS))
    for (const [, , body] of d.matchAll(/([MLA])([^MLAZ]*)/g)) {
      const v = body!
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
      const p: [number, number] = [v.at(-2)!, v.at(-1)!]
      seen.set(p.map((n) => n.toFixed(2)).join(","), p)
    }
  const near = (
    p: [number, number],
    list: readonly (readonly [number, number])[]
  ) => list.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01)
  return [...seen.values()].map((p) => ({
    x: p[0],
    y: p[1],
    kind: near(p, TIPS) ? "tip" : near(p, JUNCTIONS) ? "junction" : "smooth",
  }))
}
