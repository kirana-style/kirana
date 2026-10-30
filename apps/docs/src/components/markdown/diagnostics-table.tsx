import { css } from "@kirana-style/core"

import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontFamily, fontSize } from "@workspace/ui/tokens/typography"

import { Icon } from "@workspace/ui/primitives/icon"
import { familyIcon } from "@/data/diagnostic-families"
import { DIAGNOSTICS } from "@/generated/diagnostics.gen"

const styles = {
  wrapper: css({ marginBlockEnd: spacing[6], overflowX: "auto" }),
  code: css({ fontFamily: fontFamily.mono, fontSize: fontSize.xs }),
  // The family's icon before the code, so the column says what kind of mistake it is.
  codeWithIcon: css({
    display: "inline-flex",
    alignItems: "center",
    gap: spacing[2],
  }),
  icon: css({ color: theme.mutedForeground }),
  name: css({ fontFamily: fontFamily.mono, fontSize: fontSize.sm }),
  family: css({ color: theme.mutedForeground }),
}

/** Every diagnostic the compiler can emit, or one family's, read from its own catalogue at build time. */
export function DiagnosticsTable({ family }: { family?: string }) {
  const rows = family
    ? DIAGNOSTICS.filter((entry) => entry.family === family)
    : DIAGNOSTICS

  return (
    <div sx={styles.wrapper}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Default</TableHead>
            {family ? null : <TableHead>Part</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => (
            <TableRow key={entry.code}>
              <TableCell sx={styles.code}>
                <span sx={styles.codeWithIcon}>
                  <Icon
                    icon={familyIcon(entry.family)}
                    size="1rem"
                    sx={styles.icon}
                    aria-hidden="true"
                  />
                  {entry.code}
                </span>
              </TableCell>
              <TableCell sx={styles.name}>{entry.name}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    entry.severity === "error" ? "destructive" : "secondary"
                  }
                >
                  {entry.severity}
                </Badge>
              </TableCell>
              {family ? null : (
                <TableCell sx={styles.family}>{entry.family}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
