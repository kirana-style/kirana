<script setup lang="ts">
import { css } from "@kirana-style/core"
import { Switch } from "@kirana-style/states/base-ui"

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
</script>

<template>
  <p data-probe="" class="probe" :sx="[styles.probe, offset]">
    Styled by Kirana.
  </p>
  <span data-probe-state="" data-checked="" :sx="styles.state" />
</template>
