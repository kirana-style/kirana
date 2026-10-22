/**
 * Every `[component, part | undefined, state, selector]` in a vocabulary. A capitalised key is a
 * part; any other key is a state, whose value is a selector or an object of one selector per value.
 */
export function entries(vocabulary: Record<string, unknown>) {
  const out: [string, string | undefined, string, string][] = []
  const walk = (
    component: string,
    part: string | undefined,
    value: object,
    path: string[]
  ) => {
    for (const [key, inner] of Object.entries(value))
      if (typeof inner === "string")
        out.push([component, part, [...path, key].join("."), inner])
      else walk(component, part, inner as object, [...path, key])
  }
  for (const [component, value] of Object.entries(vocabulary)) {
    if (component === "exclusive") continue
    for (const [key, inner] of Object.entries(value as object))
      if (/^[A-Z]/.test(key)) walk(component, key, inner as object, [])
      else if (typeof inner === "string")
        out.push([component, undefined, key, inner])
      else walk(component, undefined, inner as object, [key])
  }
  return out
}

/** An attribute's presence or value, or React Aria's `:not([aria-valuenow])`. */
export const SELECTOR =
  /^(?:\[(?:data|aria)-[a-z]+(?:-[a-z]+)*(?:="[^"]+")?\]|:not\(\[aria-[a-z]+\]\))$/
