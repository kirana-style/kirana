<script lang="ts">
export const depth = 1
</script>

<script setup lang="ts">
import { css, relation } from "@kirana-style/core"

const folder = relation("tree-folder")
const label = css({
  color: { base: "black", [folder.within('[data-state="open"]')]: "red" },
})
</script>

<template>
  <li data-state="open" :sx="[folder.anchor]"><span :sx="label">—</span></li>
</template>
