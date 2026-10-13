import { lazy, Suspense } from "react"
import { css } from "@kirana-style/core"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { alpha, radius, theme } from "@workspace/ui/theme/semantic"
import { spacing } from "@workspace/ui/tokens/spacing"
import {
  fontFamily,
  fontSize,
  lineHeight,
} from "@workspace/ui/tokens/typography"

import { EXAMPLES } from "@/generated/examples.gen"

const modules = import.meta.glob<{ default: React.ComponentType }>(
  "../../examples/*.tsx"
)

const previews: Record<string, React.ComponentType> = Object.fromEntries(
  Object.entries(modules).map(([path, load]) => [path, lazy(load)])
)

const styles = {
  // The code block's frame: a muted card holding the tabs, and one rounded
  // panel inside it for whatever the chosen tab shows.
  root: css({
    marginBlockEnd: spacing[6],
    borderRadius: "1.125rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: alpha.muted50,
    padding: "3px",
  }),
  tabs: css({ gap: 0 }),
  bar: css({
    overflowX: "auto",
    paddingInline: spacing[2],
    paddingBlock: spacing[1],
    scrollbarWidth: "none",
  }),
  panel: css({
    overflow: "hidden",
    borderRadius: "0.875rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    backgroundColor: theme.background,
  }),
  preview: css({
    display: "flex",
    minHeight: "9rem",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[8],
  }),
  pane: css({ overflow: "auto", maxHeight: "26rem", scrollbarWidth: "thin" }),
  code: css({
    margin: 0,
    paddingInline: spacing[4],
    paddingBlock: spacing["3.5"],
    fontFamily: fontFamily.mono,
    fontSize: "0.8125rem",
    lineHeight: "1.6",
    tabSize: 2,
  }),
  classes: css({
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[2],
    padding: spacing[4],
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
  }),
  className: css({
    borderRadius: radius.sm,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: theme.border,
    paddingInline: spacing[2],
    paddingBlock: "0.125rem",
    color: theme.mutedForeground,
  }),
  note: css({
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: theme.border,
    paddingInline: spacing[4],
    paddingBlock: spacing[2],
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    color: theme.mutedForeground,
  }),
}

/** An example's component, running; loaded on demand. */
export function ExamplePreview({ name }: { name: string }) {
  const Preview = previews[`../../examples/${name}.tsx`]
  if (!Preview) return <p>no example named {JSON.stringify(name)}</p>
  return (
    <Suspense fallback={<Skeleton />}>
      <Preview />
    </Suspense>
  )
}

/**
 * A documentation example: the component running, its source, and the CSS the
 * compiler produced from that exact file.
 *
 * Nothing here is written by hand. The source is the file; the CSS and the class
 * list come from `scripts/generate-examples.ts`, which runs the compiler.
 */
export function Example({ name }: { name: string }) {
  const example = EXAMPLES[name]
  if (!example) return <p>no example named {JSON.stringify(name)}</p>

  return (
    <div sx={styles.root} data-slot="example">
      <Tabs defaultValue="preview" sx={styles.tabs}>
        <div sx={styles.bar}>
          <TabsList variant="line">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="css">CSS</TabsTrigger>
            <TabsTrigger value="classes">
              Classes ({example.classNames.length})
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="preview">
          <div sx={styles.panel}>
            <div sx={styles.preview}>
              <ExamplePreview name={name} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="source">
          <div sx={styles.panel}>
            <div sx={styles.pane}>
              <pre sx={styles.code} data-slot="code-block-source">
                <code
                  dangerouslySetInnerHTML={{ __html: example.sourceHtml }}
                />
              </pre>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="css">
          <div sx={styles.panel}>
            <div sx={styles.pane}>
              <pre sx={styles.code} data-slot="code-block-source">
                <code dangerouslySetInnerHTML={{ __html: example.cssHtml }} />
              </pre>
            </div>
            <p sx={styles.note}>
              Compiled from the file above by the compiler in this repository.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="classes">
          <div sx={styles.panel}>
            <div sx={styles.classes}>
              {example.classNames.map((className) => (
                <span key={className} sx={styles.className}>
                  .{className}
                </span>
              ))}
            </div>
            <p sx={styles.note}>
              One class per declaration. Names are hashed from the property and
              the value, so two modules that write the same declaration share a
              class.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
