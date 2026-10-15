/**
 * The milestones, in one place: the roadmap page's overview draws them (`<!-- ::roadmap -->`) and
 * the markdown twin writes them as a table. Each milestone's detail is the page's own section.
 */
export type MilestoneStatus = "Done" | "Next" | "Planned"

export type Milestone = {
  id: string
  name: string
  status: MilestoneStatus
  /** What it delivered, or will, in a line. */
  line: string
  /** The page's section for it. */
  anchor: string
}

export const MILESTONES: readonly Milestone[] = [
  {
    id: "M0",
    name: "Foundations",
    status: "Done",
    line: "The IR, the cascade ladder, the CSS writer",
    anchor: "m0-foundations",
  },
  {
    id: "M1",
    name: "Feasibility slice",
    status: "Done",
    line: "Vite, React, tokens and themes, the first conformance runs",
    anchor: "m1-feasibility-slice",
  },
  {
    id: "M2",
    name: "Recipes and dynamic styles",
    status: "Done",
    line: "recipe(), dynamic values, hot updates, the StyleX codemod",
    anchor: "m2-recipes-and-dynamic-styles",
  },
  {
    id: "M3",
    name: "Developer experience",
    status: "Done",
    line: "The language server, the editors, lint and the CLI",
    anchor: "m3-developer-experience",
  },
  {
    id: "M4",
    name: "Ecosystem",
    status: "Done",
    line: "Every bundler and framework, published to npm",
    anchor: "m4-ecosystem",
  },
  {
    id: "M5",
    name: "Utility surface",
    status: "Done",
    line: "Utility strings, the scales preset, the Tailwind codemod",
    anchor: "m5-utility-surface",
  },
  {
    id: "M6",
    name: "1.0",
    status: "Next",
    line: "API freeze, a public benchmark, a security review",
    anchor: "m6-1-0",
  },
]

/** The overview as the markdown twin writes it. */
export function roadmapMarkdown(): string {
  return [
    "| Milestone | Status | What it covers |",
    "| --- | --- | --- |",
    ...MILESTONES.map(
      (milestone) =>
        `| ${milestone.id}: ${milestone.name} | ${milestone.status} | ${milestone.line} |`
    ),
  ].join("\n")
}
