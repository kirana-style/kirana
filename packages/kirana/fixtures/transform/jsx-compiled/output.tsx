import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = /* @__PURE__ */ __kirana_runtime("k", "className");
// JSX compiled before Kirana sees the module, as Remix's asset server and node-tsx hand it over:
// the automatic runtime's calls, under any local name.

import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime"
import { jsxDEV } from "remix/component/jsx-dev-runtime"
import { jsx as notARuntime } from "./local"
import { Primitive, Namespace } from "headless"

const root = "k5O_23ai"
const empty = "k50*_"

function Card(props) {
  return _jsx("div", { ...props })
}

export function Elements(props) {
  return _jsxs("main", {
    children: [
      _jsx("div", { className: "k5O_23ai" }),
      _jsx("div", { className: "k5O_23ai", id: "quoted" }),
      _jsx("div", { className: undefined, id: "empty" }),
      _jsx("div", { ...__k.sx(["k5O_23ai"], [("a")], [({ color: "red" })]) }),
      _jsx("div", { "data-x": "1", ...__k.sx(["k5O_23ai"], [(props.className)], [(props.style)]) }),
      _jsx("div", { ...props, ...__k.sx(["k5O_23ai"], [(props)?.className, ("late")], [(props)?.style]) }),
      _jsx("svg", { className: "k5T_D9ur" }),
      jsxDEV("p", { className: "k5O_23ai", children: "dev" }, undefined, false, {}, this),
      _jsx(Card, { sx: root }),
      _jsx(Card, { sx: "padding-4" }),
      _jsx("div", { sx: "padding-4" }),
      _jsx(Primitive, { sx: root }),
      _jsx(Namespace.Root, { sx: root }),
      _jsx("div", { [props.key]: 1, className: "k5O_23ai" }),
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
