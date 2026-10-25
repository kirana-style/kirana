<script setup lang="ts">
import { css } from "@kirana-style/core"
import { useSx } from "@kirana-style/core/vue"

defineOptions({ inheritAttrs: false })
const { sx, attrs } = useSx()

const button = css({ height: "2rem" })
</script>

<template>
  <button v-bind="attrs" :sx="[button, sx]"><slot /></button>
</template>
