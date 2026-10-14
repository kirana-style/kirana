/**
 * The scenes: the ten landscapes of the brand's photography, and what each one gives the site.
 *
 * Every page and docs tab stands in one scene. The scene supplies its picture (the hero and the
 * footer draw it in pixels), its hue (the page's `accent`, from `PALETTE` in docs-ui) and its mark
 * colours (a `SCENERY` ramp). One golden-hour light runs through all ten, which is what keeps
 * pages that each have their own colour feeling like one site. Which page stands where, and why,
 * is in each scene's `uses` and `reason`, shown on the brand page.
 *
 * A scene is described by what is in the picture, never by the place it shows.
 */
import type { AccentName } from "@workspace/docs-ui/accent.ts"

export type SceneId =
  | "highlands"
  | "misty-hills"
  | "rock-garden"
  | "crater-lake"
  | "turquoise-lake"
  | "heritage-street"
  | "still-water"
  | "old-hall"
  | "golden-fields"
  | "city-dusk"

export type Scene = {
  id: SceneId
  /** The mood, as the brand names it. */
  name: string
  /** The scene hue a page in this scene is tinted with. */
  hue: Exclude<AccentName, "neutral">
  /** The `SCENERY` ramp the mark takes in this scene. */
  ramp: `scene-${SceneId}`
  /** Where to anchor the picture when it is cropped (CSS `object-position`). */
  position: string
  /** What the picture shows, for a reader who cannot see it. */
  alt: string
  /** Where the site stands in it. */
  uses: string
  /** Why those pages stand here. */
  reason: string
}

export const SCENES: Record<SceneId, Scene> = {
  highlands: {
    id: "highlands",
    name: "Highland morning",
    hue: "forest",
    ramp: "scene-highlands",
    position: "50% 40%",
    alt: "A painted morning over forested ridges, mist in the valleys and a wooden lookout among the trees.",
    uses: "The homepage, Why Kirana, the brand page, the Learn tab",
    reason: "The master scene: the first view, the case and the brand.",
  },
  "misty-hills": {
    id: "misty-hills",
    name: "Misty hills",
    hue: "tea",
    ramp: "scene-misty-hills",
    position: "50% 45%",
    alt: "The sun rising over rows of tea on rolling hills, morning mist between them.",
    uses: "The Frameworks tab, the homepage's closing card, the missing page",
    reason:
      "Rows of tea, many alike and each its own; and sunrise, for a start.",
  },
  "rock-garden": {
    id: "rock-garden",
    name: "Rock garden",
    hue: "tea",
    ramp: "scene-rock-garden",
    position: "50% 50%",
    alt: "Pale limestone rocks on a grassy hill, a thatched shelter among them and blue hills behind.",
    uses: "Ecosystem",
    reason: "Many stones, one garden: many packages, one engine.",
  },
  "crater-lake": {
    id: "crater-lake",
    name: "Crater dusk",
    hue: "crater",
    ramp: "scene-crater-lake",
    position: "50% 55%",
    alt: "A volcanic crater with a pale green pool at its floor and a wooden fence along the rim.",
    uses: "The compiler, the Reference tab",
    reason: "Heat that turns one thing into another.",
  },
  "turquoise-lake": {
    id: "turquoise-lake",
    name: "Turquoise lake",
    hue: "crater",
    ramp: "scene-turquoise-lake",
    position: "50% 55%",
    alt: "Clear turquoise water below pale cliffs and wooded slopes.",
    uses: "The playground",
    reason: "Clear water to play in.",
  },
  "heritage-street": {
    id: "heritage-street",
    name: "Heritage street",
    hue: "terracotta",
    ramp: "scene-heritage-street",
    position: "50% 50%",
    alt: "An old street of white façades with red tiled roofs and iron lamps in early light.",
    uses: "Migrate, the Guides tab",
    reason: "Old buildings in new use: the code you already have.",
  },
  "still-water": {
    id: "still-water",
    name: "Still water",
    hue: "lake",
    ramp: "scene-still-water",
    position: "50% 50%",
    alt: "A calm lake reflecting a blue sky and a wooded headland.",
    uses: "Compare",
    reason: "A reflection: two things side by side.",
  },
  "old-hall": {
    id: "old-hall",
    name: "Old hall",
    hue: "ochre",
    ramp: "scene-old-hall",
    position: "50% 50%",
    alt: "A white hall with a tiered roof under old trees, lit by an amber evening.",
    uses: "License, Open source, the Project tab",
    reason: "A public hall: the commons and its rules.",
  },
  "golden-fields": {
    id: "golden-fields",
    name: "Golden fields",
    hue: "ochre",
    ramp: "scene-golden-fields",
    position: "50% 50%",
    alt: "Golden fields behind a woven bamboo fence, green hills under a summer sky.",
    uses: "Sponsor",
    reason: "Fields someone tends: the work sponsorship pays for.",
  },
  "city-dusk": {
    id: "city-dusk",
    name: "City dusk",
    hue: "dusk",
    ramp: "scene-city-dusk",
    position: "50% 45%",
    alt: "A cable-stayed bridge and the lights of a city at dusk, mountains on the horizon.",
    uses: "The blog, the changelog, the showcase",
    reason: "The city in the evening: news, time passing, things built.",
  },
}

/** The picture at `width` pixels wide (800 or 1600), from `public/scenes`. */
export function sceneImage(id: SceneId, width: 800 | 1600): string {
  return `/scenes/${id}-${width}.webp`
}

/** Both sizes, for an `<img srcSet>`. */
export function sceneSrcSet(id: SceneId): string {
  return `${sceneImage(id, 800)} 800w, ${sceneImage(id, 1600)} 1600w`
}
