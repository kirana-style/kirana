import { css } from "@kirana-style/core"
import Default, {
  Aliased,
  Block,
  Computed,
  Concise,
  Declared,
  FromGlobal,
  Host,
  Namespaced,
  NoRest,
  Overloaded,
  Pattern,
  Quoted,
  Reads,
  ThroughLocal,
  Trigger,
  Whole,
  WithSx,
} from "./components"

const root = css({ display: "block" })
export function App() {
  return (
    <>
      <Trigger sx={root} />
      <Block sx={root} />
      <Concise sx={root} />
      <Aliased sx={root} />
      <Reads sx={root} />
      <Quoted sx={root} />
      <Host sx={root} />
      <WithSx sx={root} />
      <Whole sx={root} />
      <Default sx={root} />
      <Computed sx={root} />
      <ThroughLocal sx={root} />
      <Namespaced sx={root} />
      <NoRest sx={root} />
      <FromGlobal sx={root} />
      <Pattern sx={root} />
      <Declared sx={root} />
      <Overloaded sx={root} />
      <Undeclared sx={root} />
    </>
  )
}
