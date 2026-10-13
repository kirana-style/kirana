import { Menu, Popup } from "menu-lib"

// Forward `sx` unread into the installed package: reported where they receive `sx`.
export function Trigger({ ...props }) {
  return <Menu.Sub.Trigger {...props} />
}
export const Block = ({ ...props }) => {
  return <Popup {...props} />
}
export const Concise = ({ ...props }) => <Popup {...props} />
const Named = function ({ ...rest }) {
  return <Menu.Item {...rest} />
}
export { Named as Aliased }

// Read `sx`, or never hand props on: not reported. `Host` is reported: a host element compiles
// only a written `sx` attribute.
export function Reads({ sx, ...props }) {
  return <Menu.Trigger {...props} data-sx={String(sx)} />
}
export function Quoted({ "sx": sx, ...props }) {
  return <Popup {...props} data-sx={String(sx)} />
}
export function Host({ ...props }) {
  return <div {...props} />
}
export function WithSx({ sx, ...props }) {
  return <form {...props} sx={sx} />
}
export function Whole(props) {
  return <Popup {...props} />
}
export function Unspread({ ...props }) {
  return <Popup data-count={Object.keys(props).length} />
}
export function Nested({ ...props }) {
  return <Menu.Trigger {...props.inner} />
}
export const value = 1
export const Identity = Popup
export class Legacy {}
function Default({ ...props }) {
  return <this.part {...props} />
}
export { Default as default }
export function Computed({ ["s" + "x"]: sx, ...props }) {
  return <Popup {...props} data-sx={String(sx)} />
}
const Local = Popup
export function ThroughLocal({ ...props }) {
  return <Local {...props} />
}
export function Namespaced({ ...props }) {
  return <svg:rect {...props} />
}

// Not reported: no rest props, an undeclared component, or no function to analyse.
export function NoRest({ label }) {
  return <Popup data-label={label} />
}
export function FromGlobal({ ...props }) {
  return <GlobalComponent {...props} />
}
export const { Pattern } = { Pattern: Popup }
export declare const Declared: typeof Popup

// An overload signature has no body; the implementation after it is reported.
export function Overloaded(props: { open: boolean }): JSX.Element
export function Overloaded({ ...props }) {
  return <Popup {...props} />
}
