<script setup lang="ts">
import { css, props as styleProps, relation } from "@kirana-style/core"
import { Switch } from "@kirana-style/states/base-ui"

import Badge from "./Badge.vue"

/**
 * The probe the example runner reads back from the browser. Styles are declared in the script and
 * applied with `:sx`, which Kirana rewrites into the element's `class` and `style`.
 */
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
  /**
   * A component state as a condition key: plain data, so it works in any framework. The runner
   * checks it applies to an element in that state.
   */
  state: css({ paddingBottom: { base: "0px", [Switch.Root.checked]: "9px" } }),
}
const gap = `${document.title.length % 3}px`
const offset = css({ marginLeft: gap })
const wide = css({ paddingInline: "8px" })

/** Anchored only in the template (KF-088): the build fails if the compiler does not see it there. */
const scope = relation("probe-scope")
const inScope = css({
  paddingBottom: { base: "0px", [scope.within("[data-scope]")]: "6px" },
})
/** A removal the badge's own merge applies to its state entry for the property (KF-089). */
const plain = css({ paddingTop: { "*": null, base: "5px" } })
/** Handed to an element by `props()` called in the template, not in the script (KF-096). */
const handed = css({ paddingBottom: "8px" })
</script>

<template>
  <p data-probe="" class="probe" :sx="[styles.probe, offset]">
    Styled by Kirana.
  </p>
  <span data-probe-state="" data-checked="" :sx="styles.state" />
  <span data-probe-props="" :class="styleProps(handed).className" />
  <div data-scope="" :sx="scope.anchor">
    <Badge :sx="[wide, plain]" aria-label="badge" data-probe-reset="">
      Badge<i data-probe-anchor="" :sx="inScope" />
    </Badge>
  </div>
</template>
