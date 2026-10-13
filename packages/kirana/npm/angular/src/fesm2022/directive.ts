/**
 * `[sx]` for Angular templates (D-068). A template reaches only its component's members, so `sx`
 * cannot be compiled away there as it is in JSX and in Vue, Svelte or Astro templates: this
 * directive merges the handles at runtime with Kirana's runtime instead, and keeps the element's own
 * classes and styles.
 *
 * The class carries Angular's partial declarations (`ɵɵngDeclareFactory`, `ɵɵngDeclareDirective`),
 * the form `ngc` emits for a library and Angular's linker compiles in every app build. They are
 * written here rather than generated because this workspace's TypeScript (7) has no JavaScript API
 * for `ngc` to run on; the Analog and Angular CLI examples build them in CI. The static types are the
 * ones `ngc` would declare, so templates type-check `[sx]` against `Sx`. The file sits under
 * `fesm2022/`, the Angular Package Format's folder, because Analog links only files on such a path.
 */
import * as i0 from "@angular/core"
import type { Sx } from "@kirana-style/core"
import type { Handle } from "@kirana-style/core/internal"

import { applySx } from "../sx.ts"
import type { Applied } from "../sx.ts"

/** The class-name prefix (`names.prefix`); `k` unless the app provides another (`provideKirana`). */
export const KIRANA_PREFIX = new i0.InjectionToken<string>("kirana prefix", {
  providedIn: "root",
  factory: () => "k",
})

/** Providers for an app whose `kirana.config` sets another class-name prefix. */
export function provideKirana(options: { prefix: string }): i0.Provider[] {
  return [{ provide: KIRANA_PREFIX, useValue: options.prefix }]
}

export class SxDirective implements i0.OnChanges {
  /**
   * The handles: one, or an array with falsy guards (`[styles.card, active && styles.on]`). Compiled
   * handles are class strings (the Angular CLI builders type-check the compiled copy), so both are
   * accepted.
   */
  sx: Sx | Handle
  readonly #element: unknown = i0.inject(i0.ElementRef).nativeElement
  readonly #renderer = i0.inject(i0.Renderer2)
  readonly #prefix = i0.inject(KIRANA_PREFIX)
  #applied: Applied = { classes: new Set(), styles: new Set() }

  ngOnChanges(): void {
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
