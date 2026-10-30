/**
 * The component registry's documents as TypeScript types, the shape `schema.ts` checks (D-107).
 */
import type {
  FILE_TYPES,
  FRAMEWORKS,
  ICON_LIBRARIES,
  ITEM_TYPES,
} from "./schema.ts"

export type Framework = (typeof FRAMEWORKS)[number]
export type IconLibrary = (typeof ICON_LIBRARIES)[number]
export type ItemType = (typeof ITEM_TYPES)[number]
export type FileType = (typeof FILE_TYPES)[number]

/** A file an item installs: under the project's alias for `type`, or a `file` at `target`. */
export type RegistryFile = {
  path: string
  type: FileType
  target?: string
  content: string
  /** `sha256-` and the base64 SHA-256 of `content`'s UTF-8 bytes. */
  hash: string
}

/** npm packages and the version ranges an item was built with. */
export type Packages = Record<string, string>

/** One base of one framework: its markup, and the packages and items only it needs. */
export type Base = {
  files: RegistryFile[]
  dependencies?: Packages
  registryDependencies?: string[]
}

/** One item (KRN-DX-021). */
export type Item = {
  $schema?: string
  name: string
  type: ItemType
  title?: string
  description?: string
  version: string
  kirana?: string
  registryDependencies?: string[]
  dependencies?: Packages
  axes?: string[]
  styles?: RegistryFile[]
  frameworks?: Partial<Record<Framework, Record<string, Base>>>
  files?: RegistryFile[]
  font?: Font
  design?: Design
  flattened?: Flattened
  setup?: Setup
  meta?: Record<string, unknown>
}

/** A font item's family and the stylesheet that loads it (KF-050). */
export type Font = { family: string; import: string }

/** One preset field, from bit 0: the axis it sets, its values in index order, and its width. */
export type PresetField = { axis: string; values: string[]; bits: number }

/** A design system's axes and preset layouts (D-110). */
export type Design = {
  axes: Record<
    string,
    { attribute: string; values: string[]; items?: Record<string, string> }
  >
  flatten?: string
  presets?: Record<string, PresetField[]>
}

/** Style modules flattened for each value of `axis` and each base (D-110). */
export type Flattened = {
  axis: string
  builds: Record<string, Record<string, RegistryFile[]>>
  /**
   * The files that read one other axis alone, built for each of its values (KF-080): each build
   * replaces the item's file of the same type and path.
   */
  axes?: Record<string, Record<string, RegistryFile[]>>
}

/** An installed module's export: `{ module: "@/registry/lib/kit/config", export: "kitConfig" }`. */
export type Export = { module: string; export: string }

/** A design system's wiring (D-109). */
export type Setup = {
  config?: Export
  stylesheets?: string[]
  document?: Export
}

/** An index entry: what `ui search` lists. */
export type IndexEntry = Pick<
  Item,
  "name" | "type" | "title" | "description" | "version"
> & { frameworks?: Partial<Record<Framework, string[]>> }

/** A registry's index (KRN-DX-022). */
export type Index = {
  $schema?: string
  name?: string
  homepage?: string
  items: IndexEntry[]
}

/** An installed item in the lockfile (KRN-DX-025). */
export type Locked = {
  registry: string
  version: string
  framework?: Framework
  base?: string
  design?: string
  /** Each installed file by its path: the registry's content hash, and what was written's. */
  files: Record<string, { source: string; written: string }>
}

/** `kirana-style.lock.json`. */
export type Lockfile = {
  $schema?: string
  lockfileVersion: 1
  items: Record<string, Locked>
}
