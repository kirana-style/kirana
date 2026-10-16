/**
 * An icon for each family the compiler groups its diagnostics in, so a reader finds a family by
 * its picture before its name. The families themselves come from the compiler's catalogue
 * (`generated/diagnostics.gen.ts`); one it adds later shows the fallback until it is named here.
 */
import {
  AlertCircleIcon,
  BracketsIcon,
  ColorsIcon,
  FlashIcon,
  FunctionIcon,
  GitBranchIcon,
  Layers01Icon,
  Link01Icon,
  PencilEdit01Icon,
  Settings02Icon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons"

import type { IconProps } from "@workspace/ui/primitives/icon"

const ICONS: Record<string, IconProps["icon"]> = {
  Parsing: BracketsIcon,
  Evaluation: FunctionIcon,
  "Properties and values": SlidersHorizontalIcon,
  Conditions: GitBranchIcon,
  Relations: Link01Icon,
  Tokens: ColorsIcon,
  "Dynamic styles": FlashIcon,
  Authoring: PencilEdit01Icon,
  Recipes: Layers01Icon,
  Configuration: Settings02Icon,
}

export const familyIcon = (family: string): IconProps["icon"] =>
  ICONS[family] ?? AlertCircleIcon
