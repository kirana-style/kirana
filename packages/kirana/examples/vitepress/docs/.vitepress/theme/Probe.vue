<script setup lang="ts">
import { css } from "@kirana-style/core"

// The probe the example runner reads back from the browser, used by `docs/index.md`.
const styles = {
  probe: css({
    color: "rgb(1, 2, 3)",
    paddingTop: "7px",
    backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
  }),
}
</script>

<template>
  <p data-probe="" :sx="styles.probe">Styled by Kirana.</p>
</template>
