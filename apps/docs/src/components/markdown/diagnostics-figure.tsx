/**
 * `<!-- ::diagnostics-figure -->`: a check over a project. Every file passes
 * but one, which turns red and carries the code the compiler reports for it — the same KRN1401 the homepage shows being raised.
 */
import { css } from "@kirana-style/core"
import {
  Alert02Icon,
  CommandLineIcon,
  FileCodeIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { accents } from "@workspace/docs-ui/accent.ts"
import { Icon } from "@workspace/ui/primitives/icon"
import { radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import { fontSize } from "@workspace/ui/tokens/typography"

import {
  At,
  Card,
  DANGER,
  Row,
  Scene,
  Stage,
  T,
  Tag,
  Tile,
} from "@/components/site/visuals"

const FILES = [
  { name: "button.tsx", code: null },
  { name: "card.tsx", code: null },
  { name: "menu.tsx", code: "KRN1401" },
  { name: "dialog.tsx", code: null },
] as const

const styles = {
  root: css({
    display: "grid",
    gap: spacing[3],
    marginBlock: spacing[6],
    gridTemplateColumns: "minmax(0, 1fr)",
  }),
  panel: css({
    height: "15rem",
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  badge: css({
    position: "absolute",
    insetBlockStart: "-9px",
    insetInlineEnd: "-9px",
    zIndex: 1,
    display: "grid",
    placeItems: "center",
    width: "1.375rem",
    height: "1.375rem",
    borderRadius: radius.full,
    backgroundColor: DANGER,
    color: "white",
    boxShadow: `0 0 0 2px ${theme.background}`,
  }),
  name: css({ flex: 1 }),
  caption: css({
    gridColumn: "1 / -1",
    fontSize: fontSize.sm,
    lineHeight: "1.6",
    color: theme.mutedForeground,
  }),
}

function Check() {
  return (
    <Stage danger>
      <Scene width={280} height={176} live={["M 58 88 H 116"]}>
        <At x={12} y={50}>
          <Tile icon={CommandLineIcon} size={48} variant="accent" />
        </At>
        <At x={69} y={50}>
          <div sx={css({ position: "relative" })}>
            <span sx={styles.badge}>
              <Icon icon={Alert02Icon} size="0.75rem" />
            </span>
            <Card width={164} danger>
              {FILES.map((file) => (
                <Row key={file.name} danger={file.code !== null}>
                  <Icon icon={FileCodeIcon} size="0.75rem" />
                  <span sx={styles.name}>
                    <T tone={file.code ? "danger" : undefined}>{file.name}</T>
                  </span>
                  {file.code ? (
                    <Tag tone="danger">{file.code}</Tag>
                  ) : (
                    <Tag tone="success" icon={Tick02Icon} />
                  )}
                </Row>
              ))}
            </Card>
          </div>
        </At>
      </Scene>
    </Stage>
  )
}

export function DiagnosticsFigure() {
  return (
    <figure
      sx={[accents.blue, styles.root]}
      aria-label="kirana check over a project: one file fails with KRN1401"
    >
      <div sx={styles.panel}>
        <Check />
      </div>
      <figcaption sx={styles.caption}>
        kirana check reads every module; a relation read without its anchor is
        an error with a stable code, in the file that has it.
      </figcaption>
    </figure>
  )
}
