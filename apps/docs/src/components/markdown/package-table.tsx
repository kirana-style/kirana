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

import { PACKAGES } from "@/generated/packages.gen"

const styles = {
  wrapper: css({ marginBlockEnd: spacing[6], overflowX: "auto" }),
  name: css({ fontFamily: fontFamily.mono, fontSize: fontSize.sm }),
  description: css({ color: theme.mutedForeground }),
}

/**
 * The packages, their versions and whether they are published — read from each
 * `package.json` at build time, so the site cannot claim to be on npm before it is.
 */
export function PackageTable() {
  return (
    <div sx={styles.wrapper}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Package</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>On npm</TableHead>
            <TableHead>What it is</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PACKAGES.map((entry) => (
            <TableRow key={entry.name}>
              <TableCell sx={styles.name}>{entry.name}</TableCell>
              <TableCell sx={styles.name}>{entry.version}</TableCell>
              <TableCell>
                <Badge variant={entry.published ? "default" : "secondary"}>
                  {entry.published ? "published" : "not yet"}
                </Badge>
              </TableCell>
              <TableCell sx={styles.description}>{entry.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
