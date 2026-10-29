import type { Project, ProjectOptions } from "./project.ts"

export type {
  Diagnostic,
  Language,
  LanguageMessage,
  Position,
  Project,
  ProjectOptions,
  Transformed,
} from "./project.ts"
export { positionOf } from "./project.ts"
export { engineJson as configJson } from "@kirana-style/compiler/engine-json"

/** Opens a project in the engine's in-memory file system. */
export declare function createProject(options?: ProjectOptions): Project
