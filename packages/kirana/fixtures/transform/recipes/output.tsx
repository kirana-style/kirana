import { runtime as __kirana_runtime } from "@kirana-style/core/internal";
const __k = __kirana_runtime("k", "className");


export const button = __k.recipe({"s": null, "b": ["k5O_Kh8G k50_W0yl"], "v": {"tone": {"primary": ["k50_4U33 k44_LB88"], "ghost": ["k44_FThQ"]}, "size": {"sm": ["k6V_Imrn"], "md": ["k6V_5QUl"]}, "disabled": {"true": ["k87_ufrO"], "false": [""]}}, "c": [[{"tone": "ghost", "size": "sm"}, ["k50_jWjM"]], [{"disabled": "true"}, ["k5J_Gcl3"]]], "d": {"tone": "primary", "size": "md"}})

export const card = __k.recipe({"s": ["root", "title"], "b": ["k5O_fqMV", "k6y_vXXk"], "v": {"size": {"sm": ["kJ_pnCg", ""], "md": ["kJ_iExv", "k6f_EOeu"]}}, "c": [], "d": {}})

export const plain = __k.recipe({"s": null, "b": [""], "v": {}, "c": [], "d": {}})

export function Button({ tone, disabled }: { tone: "primary" | "ghost"; disabled: boolean }) {
  const slots = {"root": "k5O_fqMV kJ_pnCg", "title": "k6y_vXXk"}
  return (
    <div className="k5O_fqMV kJ_pnCg">
      <button className="k5O_Kh8G k44_FThQ k6V_Imrn k50_jWjM" />
      <button className="k5O_Kh8G k50_4U33 k44_LB88 k6V_5QUl" />
      <button {...__k.sx([(button({ tone, disabled }))], [], [])} />
      <button className="k5O_Kh8G k50_4U33 k44_LB88 k6V_5QUl k87_ufrO k5J_Gcl3" />
      <h2 className="k6y_vXXk" />
      <p  />
    </div>
  )
}
export const errors = [
  undefined,
  undefined,
  __k.recipe({"s": ["root"], "b": [""], "v": {}, "c": [], "d": {}}),
  __k.recipe({"s": null, "b": [""], "v": {"tone": {"a": [""]}}, "c": [], "d": {"tone": "x"}}),
  undefined,
]
export function DynamicRecipe({ size }: { size: string }) {
  return undefined
}
