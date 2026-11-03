<script lang="ts">
  import { css, relation } from "@kirana-style/core"

  const folder = relation("svelte-folder")
  const label = css({
    color: { base: "black", [folder.within('[data-state="open"]')]: "red" },
  })
</script>

<li data-state="open" sx={[folder.anchor]}><span sx={label}>—</span></li>
