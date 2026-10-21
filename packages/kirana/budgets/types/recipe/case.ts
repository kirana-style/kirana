// A button and a slotted card, as a component library defines them: variants, compounds and
// defaults, then each one called.
import { recipe } from "@kirana-style/core"

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "0.5rem",
  },
  variants: {
    variant: {
      default: { backgroundColor: "black", color: "white" },
      outline: {
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "gainsboro",
      },
      ghost: {
        backgroundColor: { base: "transparent", ":hover": "whitesmoke" },
      },
      link: { textDecorationLine: { base: "none", ":hover": "underline" } },
    },
    size: {
      sm: { height: "2rem", paddingInline: "0.75rem" },
      md: { height: "2.25rem", paddingInline: "1rem" },
      lg: { height: "2.5rem", paddingInline: "1.5rem" },
      icon: { width: "2.25rem", height: "2.25rem" },
    },
    pill: { true: { borderRadius: "999px" }, false: {} },
  },
  compoundVariants: [
    { variant: "outline", size: "sm", css: { borderWidth: "1px" } },
    { variant: "ghost", pill: true, css: { paddingInline: "0.5rem" } },
  ],
  defaultVariants: { variant: "default", size: "md", pill: false },
})

export const card = recipe({
  slots: ["root", "header", "title", "body", "footer"],
  base: {
    root: { display: "flex", flexDirection: "column" },
    header: { padding: "1rem" },
    title: { fontWeight: 600 },
    body: { padding: "1rem" },
    footer: { display: "flex", justifyContent: "end" },
  },
  variants: {
    size: {
      sm: { root: { gap: "0.5rem" }, title: { fontSize: "0.875rem" } },
      md: { root: { gap: "1rem" }, title: { fontSize: "1rem" } },
    },
  },
  defaultVariants: { size: "md" },
})

export const primary = button({ variant: "default", size: "lg" })
export const pill = button({ variant: "ghost", pill: true })
export const plain = button()
export const parts = card({ size: "sm" })
export const titled = parts.title
