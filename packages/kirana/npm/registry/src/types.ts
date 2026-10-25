/**
 * The component registry's documents as TypeScript types, the shape `schema.ts` checks (D-107).
 */
import type { FILE_TYPES, FRAMEWORKS, ITEM_TYPES } from "./schema.ts"

export type Framework = (typeof FRAMEWORKS)[number]
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
  meta?: Record<string, unknown>
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
