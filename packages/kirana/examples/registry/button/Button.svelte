<script lang="ts">
  import type { Snippet } from "svelte"

  import { IconPlaceholder } from "@/registry/lib/kit/icon-placeholder"
  import { button } from "@/registry/ui/button.styles"

  let { children }: { children?: Snippet } = $props()
</script>

<button data-registry-probe="" sx={button.root}>
  <IconPlaceholder
    lucide="CheckIcon"
    tabler="IconCheck"
    hugeicons="Tick02Icon"
    phosphor="CheckIcon"
    remixicon="RiCheckLine"
  />
  {@render children?.()}
</button>
