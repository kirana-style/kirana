<script setup lang="ts">
import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
import { button } from "@/registry/ui/button.styles"
</script>

<template>
  <button data-registry-probe="" :sx="button.root">
    <IconPlaceholder
      lucide="CheckIcon"
      tabler="IconCheck"
      hugeicons="Tick02Icon"
      phosphor="CheckIcon"
      remixicon="RiCheckLine"
    />
    <slot />
  </button>
</template>
