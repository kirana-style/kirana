// JSX compiled before Kirana sees the module, as Remix's asset server and node-tsx hand it over:
// the automatic runtime's calls, under any local name.
import { css } from "@kirana-style/core"
import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime"
import { jsxDEV } from "remix/component/jsx-dev-runtime"
import { jsx as notARuntime } from "./local"
import { Primitive, Namespace } from "headless"

const root = css({ display: "flex" })
const empty = css({ color: null })

function Card(props) {
  return _jsx("div", { ...props })
}

export function Elements(props) {
  return _jsxs("main", {
    children: [
      _jsx("div", { sx: root }),
      _jsx("div", { "sx": root, id: "quoted" }),
      _jsx("div", { sx: empty, id: "empty" }),
      _jsx("div", { className: "a", sx: root, style: { color: "red" } }),
      _jsx("div", { className: props.className, sx: root, style: props.style, "data-x": "1" }),
      _jsx("div", { ...props, sx: root, className: "late" }),
      _jsx("svg", { sx: css({ fill: "red" }) }),
      jsxDEV("p", { sx: root, children: "dev" }, undefined, false, {}, this),
      _jsx(Card, { sx: root }),
      _jsx(Card, { sx: "padding-4" }),
      _jsx("div", { sx: "padding-4" }),
      _jsx(Primitive, { sx: root }),
      _jsx(Namespace.Root, { sx: root }),
      _jsx("div", { [props.key]: 1, sx: root }),
      _jsx("div", { className: "only" }),
      _jsx("div"),
      _jsx("div", props),
      _jsx(props.as, { sx: root }),
      _jsx(props.pick(), { sx: root }),
      _jsx(props.pick().Root, { sx: root }),
      notARuntime("div", { sx: root }),
    ],
  })
}
