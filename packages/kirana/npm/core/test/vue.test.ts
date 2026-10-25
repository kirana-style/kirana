import { createSSRApp, defineComponent, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { describe, expect, it } from "vite-plus/test"

import { runtime } from "../src/internal.ts"
import { useSx } from "../src/vue.js"

/** What a compiled template's `:sx` calls: the private runtime, created with `class`. */
const k = runtime("k", "class")

/** A button whose own height and background a caller's `:sx` may override. */
const Button = defineComponent({
  inheritAttrs: false,
  setup(_, { slots }) {
    const { sx, attrs } = useSx()
    return () =>
      h(
        "button",
        // What a compiled `:sx` passes: a handle is its class string at runtime.
        {
          ...attrs.value,
          ...k.sx(
            [["k6V_5QUl k44_XvQd", sx.value as unknown as string]],
            [],
            []
          ),
        },
        slots.default?.()
      )
  },
})

const render = (props: Record<string, unknown>) =>
  renderToString(createSSRApp({ render: () => h(Button, props, () => "Go") }))

describe("useSx (KF-019)", () => {
  it("merges a caller's sx over the component's own, property by property", async () => {
    // The caller's height and background, as its `:sx` compiles: one class per property.
    const html = await render({
      class: "k6V_JlMz k44_4UKn",
      "aria-label": "Go",
      style: { "--kv1": "2px" },
    })
    expect(html).toContain('class="k6V_JlMz k44_4UKn"')
    expect(html).not.toContain("k6V_5QUl")
    expect(html).toContain('aria-label="Go"')
    expect(html).toContain("--kv1:2px")
  })

  it("keeps the component's own styles without a caller's, and a foreign class beside them", async () => {
    expect(await render({})).toContain('class="k6V_5QUl k44_XvQd"')
    expect(await render({ class: ["legacy", { active: true }] })).toContain(
      'class="k6V_5QUl k44_XvQd legacy active"'
    )
  })
})
