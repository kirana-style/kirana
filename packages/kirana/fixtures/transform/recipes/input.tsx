import { css, recipe } from "@kirana-style/core"

export const button = recipe({
  base: { display: "inline-flex", color: "black" },
  variants: {
    tone: { primary: { color: "white", backgroundColor: "blue" }, ghost: css({ backgroundColor: "transparent" }) },
    size: { sm: { height: "1.75rem" }, md: { height: "2rem" } },
    disabled: { true: { opacity: 0.5 }, false: {} },
  },
  compoundVariants: [{ tone: "ghost", size: "sm", css: { color: "gray" } }, { disabled: true, css: { cursor: "not-allowed" } }],
  defaultVariants: { tone: "primary", size: "md" },
})

export const card = recipe({
  slots: ["root", "title"],
  base: { root: { display: "grid" }, title: { fontWeight: 600 } },
  variants: { size: { sm: { root: { gap: "0.5rem" } }, md: { root: { gap: "1rem" }, title: { fontSize: "1rem" } } } },
})

export const plain = recipe({})

export function Button({ tone, disabled }: { tone: "primary" | "ghost"; disabled: boolean }) {
  const slots = card({ size: "sm" })
  return (
    <div sx={slots.root}>
      <button sx={button({ tone: "ghost", size: "sm" })} />
      <button sx={button()} />
      <button sx={button({ tone, disabled })} />
      <button sx={button({ disabled: true, size: undefined })} />
      <h2 sx={slots.title} />
      <p sx={plain()} />
    </div>
  )
}
export const errors = [
  button({ tone: "loud" }),
  button({ shape: "round" }),
  recipe({ slots: ["root"], base: { head: {} } }),
  recipe({ defaultVariants: { tone: "x" }, variants: { tone: { a: {} } } }),
  recipe("x"),
]
export function DynamicRecipe({ size }: { size: string }) {
  return recipe({ base: { width: size } })
}
