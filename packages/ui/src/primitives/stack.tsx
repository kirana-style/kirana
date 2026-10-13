import type { FlexProps } from "./flex"
import { Flex } from "./flex"

export type StackProps = Omit<FlexProps, "direction" | "inline"> & {
  /** `column` by default; `row` lays the stack out horizontally. */
  direction?: "row" | "column"
}

/** A Flex that stacks vertically by default. The workhorse layout primitive. */
export function Stack({ direction = "column", ...props }: StackProps) {
  return <Flex direction={direction} {...props} />
}
