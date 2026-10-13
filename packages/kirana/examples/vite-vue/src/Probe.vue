<script setup lang="ts">
import { css } from "@kirana-style/core"

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
}
const gap = `${document.title.length % 3}px`
const offset = css({ marginLeft: gap })
</script>

<template>
  <p data-probe="" class="probe" :sx="[styles.probe, offset]">
    Styled by Kirana.
  </p>
</template>
