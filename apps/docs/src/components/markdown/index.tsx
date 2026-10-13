/**
 * What markdown renders as on this site: docs-ui's map, plus the pages' own
 * embeds (live examples and the generated reference tables).
 */
import { createMarkdownComponents } from "@workspace/docs-ui/markdown/index.tsx"
import type { CommentRegistry } from "@workspace/docs-ui/markdown/comment-component.tsx"

import { DocsShortcuts } from "./shortcuts"
import { DiagnosticsFigure } from "./diagnostics-figure"
import { DiagnosticsTable } from "./diagnostics-table"
import { Example } from "./example"
import {
  CodemodFigure,
  ConformanceFigure,
  DesignSystemFigure,
  LayersFigure,
  LibraryFigure,
  MergeFigure,
  RelationFigure,
  PipelineFigure,
  PrecedenceFigure,
  ConditionsFigure,
  DynamicFigure,
  ThemesFigure,
  ExternalFigure,
  TraceFigure,
  StylexFigure,
  LintFigure,
  ClassNameFigure,
} from "./figures"
import { EditorScene } from "@/components/home/editor"
import { SiteCodeBlock } from "@/components/site/editor-window"
import { FrameworkGrid, GuideGrid } from "./frameworks"
import { EditorGrid, LintRuleGrid, LinterGrid } from "./tooling"
import { PackageTable } from "./package-table"

export const markdownComponents = createMarkdownComponents(
  {
    example: Example as CommentRegistry[string],
    diagnostics: DiagnosticsTable as CommentRegistry[string],
    "diagnostics-figure": DiagnosticsFigure as CommentRegistry[string],
    packages: PackageTable as CommentRegistry[string],
    frameworks: FrameworkGrid as CommentRegistry[string],
    guides: GuideGrid as CommentRegistry[string],
    "figure-codemod": CodemodFigure as CommentRegistry[string],
    "figure-stylex": StylexFigure as CommentRegistry[string],
    "figure-conformance": ConformanceFigure as CommentRegistry[string],
    "figure-layers": LayersFigure as CommentRegistry[string],
    "figure-design-system": DesignSystemFigure as CommentRegistry[string],
    "figure-library": LibraryFigure as CommentRegistry[string],
    "figure-merge": MergeFigure as CommentRegistry[string],
    "figure-relation": RelationFigure as CommentRegistry[string],
    "docs-shortcuts": DocsShortcuts as CommentRegistry[string],
    "figure-pipeline": PipelineFigure as CommentRegistry[string],
    "figure-precedence": PrecedenceFigure as CommentRegistry[string],
    "figure-conditions": ConditionsFigure as CommentRegistry[string],
    "figure-dynamic": DynamicFigure as CommentRegistry[string],
    "figure-themes": ThemesFigure as CommentRegistry[string],
    "figure-external": ExternalFigure as CommentRegistry[string],
    "figure-trace": TraceFigure as CommentRegistry[string],
    "figure-lint": LintFigure as CommentRegistry[string],
    "figure-class-name": ClassNameFigure as CommentRegistry[string],
    editors: EditorGrid as CommentRegistry[string],
    linters: LinterGrid as CommentRegistry[string],
    "lint-rules": LintRuleGrid as CommentRegistry[string],
    "figure-editor": EditorScene as CommentRegistry[string],
  },
  SiteCodeBlock
)
