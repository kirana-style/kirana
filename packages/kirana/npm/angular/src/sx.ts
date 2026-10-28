/**
 * What `[sx]` does to an element, without Angular: merge the handles with Kirana's runtime (the same
 * one compiled modules call), then bring the element's classes and custom properties from what the
 * last value applied to what this one applies. Only what `[sx]` added is ever removed, so the
 * element's own `class` and `style` stay.
 */
import type { Sx } from "@kirana-style/core"
import { runtime } from "@kirana-style/core/internal"
import type { Handle } from "@kirana-style/core/internal"

/**
 * What an `sx` input takes: `Sx`, or the class strings handles are once compiled. The Angular CLI
 * builders type-check the compiled copy, where a template passes those strings.
 */
export type SxInput = Sx | Handle

/** The part of Angular's `Renderer2` this needs. */
export type Renderer = {
  addClass: (element: unknown, name: string) => void
  removeClass: (element: unknown, name: string) => void
  setStyle: (
    element: unknown,
    name: string,
    value: string,
    flags?: number
  ) => void
  removeStyle: (element: unknown, name: string, flags?: number) => void
}

/** What the last value applied: its classes and its custom properties. */
export type Applied = { classes: Set<string>; styles: Set<string> }

/** `RendererStyleFlags2.DashCase`: the name is a custom property, set as written. */
export const DASH_CASE = 2

const runtimes = new Map<string, ReturnType<typeof runtime>>()

/** One runtime per class-name prefix, as each compiled module creates one. */
export function runtimeFor(prefix: string): ReturnType<typeof runtime> {
  let created = runtimes.get(prefix)
  if (!created) {
    created = runtime(prefix, "class")
    runtimes.set(prefix, created)
  }
  return created
}

/**
 * A part's host props: its own handles, then its caller's `sx`, merged with Kirana's runtime as
 * `[sx]` merges them, the caller's last (KF-049). A part binds `class` and `style` to its host and
 * lists `provideSxPart()`, so `SxDirective` leaves the element to it.
 */
export function partSx(
  own: SxInput,
  sx: SxInput,
  prefix = "k"
): { class: string; style: Record<string, string> } {
  const props = runtimeFor(prefix).sx([own, sx] as Handle[], [], [])
  return { class: props.class ?? "", style: props.style ?? {} }
}

/** Applies `value` (a handle, or an array of handles and falsy guards); returns what is applied now. */
export function applySx(
  renderer: Renderer,
  element: unknown,
  previous: Applied,
  value: unknown,
  prefix: string
): Applied {
  const handles = (Array.isArray(value) ? value : [value]) as Handle[]
  const props = runtimeFor(prefix).sx(handles, [], [])
  const classes = new Set((props.class ?? "").split(" ").filter(Boolean))
  const styles = props.style ?? {}
  for (const name of previous.classes)
    if (!classes.has(name)) renderer.removeClass(element, name)
  for (const name of classes)
    if (!previous.classes.has(name)) renderer.addClass(element, name)
  for (const name of previous.styles)
    if (!(name in styles)) renderer.removeStyle(element, name, DASH_CASE)
  for (const [name, setting] of Object.entries(styles))
    renderer.setStyle(element, name, setting, DASH_CASE)
  return { classes, styles: new Set(Object.keys(styles)) }
}
