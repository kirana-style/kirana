import { css } from "@kirana-style/core"
import { Spinner } from "@workspace/ui/components/spinner"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"

const styles = {
  row: css({
    display: "flex",
    minHeight: spacing["80"],
    alignItems: "center",
    justifyContent: "center",
    color: theme.mutedForeground,
  }),
  spinner: css({
    width: spacing["6"],
    height: spacing["6"],
  }),
}

export function PageLoading() {
  return (
    <div sx={styles.row}>
      <Spinner sx={styles.spinner} />
    </div>
  )
}
