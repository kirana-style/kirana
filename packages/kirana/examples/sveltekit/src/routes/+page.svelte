<script lang="ts">
  import { css } from "@kirana-style/core"

  /**
   * The probe the example runner reads back from the browser, rendered on the server at build time
   * and hydrated in the browser.
   */
  const styles = {
    probe: css({
      color: "rgb(1, 2, 3)",
      paddingTop: "7px",
      backgroundColor: { base: "rgb(250, 250, 250)", ":hover": "rgb(4, 5, 6)" },
    }),
  }
  const offset = css({ marginLeft: "1px" })
</script>

<p data-probe="" class="probe" sx={[styles.probe, offset]}>Styled by Kirana.</p>
