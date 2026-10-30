/**
 * `[sx]` for Angular templates (D-068). A template reaches only its component's members, so `sx`
 * cannot be compiled away: this directive merges the handles with Kirana's runtime and keeps the
 * element's own classes and styles. Its partial declarations (`ɵɵngDeclare*`, with the types `ngc`
 * would declare) are hand-written because TypeScript 7 has no JavaScript API for `ngc`; the examples
 * build them in CI. It sits under `fesm2022/` because Analog links only files on such a path.
 */
import * as i0 from "@angular/core"

import { applySx } from "../sx.ts"
import type { Applied, SxInput } from "../sx.ts"

/** The class-name prefix (`names.prefix`); `k` unless the app provides another (`provideKirana`). */
export const KIRANA_PREFIX = new i0.InjectionToken<string>("kirana prefix", {
  providedIn: "root",
  factory: () => "k",
})

/** Providers for an app whose `kirana.config` sets another class-name prefix. */
export function provideKirana(options: { prefix: string }): i0.Provider[] {
  return [{ provide: KIRANA_PREFIX, useValue: options.prefix }]
}

/**
 * Provided by a part, a directive that merges `sx` with its own styles itself (D-100, `partSx`):
 * `SxDirective` on the same element then applies nothing, since a class it added would be dropped
 * when the part's `[class]` binding next changed (KF-049). A part lists `provideSxPart()` in its
 * `providers`.
 */
export const SX_PART = new i0.InjectionToken<boolean>("kirana sx part")

/** The provider that marks a part's element, so `SxDirective` leaves `[sx]` to the part. */
export function provideSxPart(): i0.Provider {
  return { provide: SX_PART, useValue: true }
}

export class SxDirective implements i0.OnChanges {
  /**
   * The handles: one, or an array with falsy guards (`[styles.card, active && styles.on]`). Compiled
   * handles are class strings (the Angular CLI builders type-check the compiled copy), so both are
   * accepted.
   */
  sx: SxInput
  readonly #element: unknown = i0.inject(i0.ElementRef).nativeElement
  readonly #renderer = i0.inject(i0.Renderer2)
  readonly #prefix = i0.inject(KIRANA_PREFIX)
  /** Whether a part on this element merges `sx` itself (`SX_PART`). */
  readonly #part = i0.inject(SX_PART, { self: true, optional: true }) ?? false
  #applied: Applied = { classes: new Set(), styles: new Set() }

  ngOnChanges(): void {
    if (this.#part) return
    this.#applied = applySx(
      this.#renderer,
      this.#element,
      this.#applied,
      this.sx,
      this.#prefix
    )
  }

  static ɵfac: i0.ɵɵFactoryDeclaration<SxDirective, never> =
    i0.ɵɵngDeclareFactory({
      minVersion: "12.0.0",
      // A literal, as the linker reads it: the Angular version these were written against.
      version: "22.2.1",
      ngImport: i0,
      type: SxDirective,
      deps: [],
      target: i0.ɵɵFactoryTarget.Directive,
    } as Parameters<
      typeof i0.ɵɵngDeclareFactory
    >[0]) as i0.ɵɵFactoryDeclaration<SxDirective, never>

  static ɵdir: i0.ɵɵDirectiveDeclaration<
    SxDirective,
    "[sx]",
    never,
    { sx: { alias: "sx"; required: false } },
    {},
    never,
    never,
    true,
    never
  > = i0.ɵɵngDeclareDirective({
    minVersion: "14.0.0",
    // A literal, as the linker reads it: the Angular version these were written against.
    version: "22.2.1",
    type: SxDirective,
    isStandalone: true,
    selector: "[sx]",
    inputs: { sx: "sx" },
    usesOnChanges: true,
    ngImport: i0,
  } as Parameters<typeof i0.ɵɵngDeclareDirective>[0])
}
