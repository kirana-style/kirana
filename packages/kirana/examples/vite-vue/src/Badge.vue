<script setup lang="ts">
import { css } from "@kirana-style/core"
import { useSx } from "@kirana-style/core/vue"

/**
 * A component that takes its caller's `:sx`: the caller's styles go last in the root's own, so they
 * win property by property instead of sitting beside the badge's own classes.
 */
defineOptions({ inheritAttrs: false })
const { sx, attrs } = useSx()

const badge = css({ display: "inline-block", paddingInline: "4px" })
</script>

<template>
  <span v-bind="attrs" :sx="[badge, sx]"><slot /></span>
</template>
