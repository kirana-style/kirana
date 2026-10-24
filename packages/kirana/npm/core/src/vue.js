// `useSx()`, typed and described in `vue.d.ts`. Plain JavaScript beside a hand-written declaration
// file, so `/// <reference types="@kirana-style/core/vue" />` keeps reading the declarations.
import { computed, normalizeClass, useAttrs } from "vue"

export function useSx() {
  const fallthrough = useAttrs()
  return {
    sx: computed(() => normalizeClass(fallthrough.class) || undefined),
    attrs: computed(() => {
      const { class: _class, ...rest } = fallthrough
      return rest
    }),
  }
}
