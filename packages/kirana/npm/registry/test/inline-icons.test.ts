import { describe, expect, it, vi } from "vite-plus/test"

import {
  ICON_DATA,
  dataUrl,
  fetchInlineIcons,
  hugeiconAliases,
  kebab,
  parseHugeicon,
  parseSvg,
  remixSymbol,
} from "../src/inline-icons.ts"

const LUCIDE_X = `<!-- @license lucide-static -->
<svg
  class="lucide lucide-x"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  viewBox="0 0 24 24"
>
  <path d="M18 6 6 18" />
  <path d="m6 6 12 12" />
</svg>
`

const HUGE_CANCEL = `const Cancel01Icon = [
  ["path", { d: "M19 5L5 19", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.5", key: "0" }]
];

export { Cancel01Icon as default };
`

const REMIX_SPRITE = `<svg><symbol viewBox="0 0 24 24" id="ri-close-line"><path d="M12 10"/></symbol><symbol id="ri-close-fill"><path d="M1 1"/></symbol></svg>`

const PHOSPHOR_X = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M205 194Z"/></svg>`

/** A `fetch` answering from a table of URLs; anything else is a 404. */
function served(
  table: Record<string, string>,
  seen: string[] = []
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    seen.push(url)
    const body = table[url]
    return body === undefined
      ? new Response("not found", { status: 404 })
      : new Response(body, { status: 200 })
  }) as typeof fetch
}

describe("KRN-DX-033 icons drawn inline from their library's data", () => {
  it("names files as the libraries do", () => {
    expect(kebab("RotateClockwise2")).toBe("rotate-clockwise-2")
    expect(kebab("ArrowDownSLine")).toBe("arrow-down-s-line")
    expect(kebab("Heading2")).toBe("heading-2")
    expect(kebab("UIElements")).toBe("ui-elements")
    expect(dataUrl("lucide", "Loader2Icon")).toBe(
      `https://cdn.jsdelivr.net/npm/${ICON_DATA.lucide}/icons/loader-2.svg`
    )
    expect(dataUrl("tabler", "IconChevronDown")).toMatch(
      /\/icons\/outline\/chevron-down\.svg$/
    )
    expect(dataUrl("tabler", "IconCircleCheckFilled")).toMatch(
      /\/icons\/filled\/circle-check\.svg$/
    )
    expect(dataUrl("hugeicons", "Cancel01Icon")).toMatch(
      /\/dist\/esm\/Cancel01Icon\.js$/
    )
    expect(dataUrl("phosphor", "CaretDownIcon")).toMatch(
      /\/assets\/regular\/caret-down\.svg$/
    )
    // A name Phosphor 2 renamed, kept by its packages.
    expect(dataUrl("phosphor", "ActivityIcon")).toMatch(
      /\/assets\/regular\/pulse\.svg$/
    )
  })

  it("reads an SVG's root attributes but its class, and its shapes on one line", () => {
    expect(parseSvg(LUCIDE_X)).toEqual({
      attributes: [
        ["xmlns", "http://www.w3.org/2000/svg"],
        ["width", "24"],
        ["viewBox", "0 0 24 24"],
      ],
      inner: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    })
    expect(() => parseSvg("<p>no</p>")).toThrow(
      "an icon's data is not an <svg>"
    )
  })

  it("draws a Hugeicons module as its packages do, with a stroke of 2", () => {
    expect(parseHugeicon(HUGE_CANCEL)).toEqual({
      attributes: [
        ["xmlns", "http://www.w3.org/2000/svg"],
        ["width", "24"],
        ["height", "24"],
        ["viewBox", "0 0 24 24"],
        ["fill", "none"],
      ],
      inner:
        '<path d="M19 5L5 19" stroke="currentColor" stroke-linecap="round" stroke-width="2" />',
    })
    expect(() => parseHugeicon("export {}")).toThrow(
      "an icon's data holds no shapes"
    )
  })

  it("finds a Remix Icon in the sprite, its view box or 24 by default", () => {
    expect(remixSymbol(REMIX_SPRITE, "RiCloseLine")?.inner).toBe(
      '<path d="M12 10"/>'
    )
    expect(remixSymbol(REMIX_SPRITE, "RiCloseFill")?.attributes).toContainEqual(
      ["viewBox", "0 0 24 24"]
    )
    expect(remixSymbol(REMIX_SPRITE, "RiMissing")).toBeUndefined()
  })

  it("reads Hugeicons' other names from its index", () => {
    const aliases = hugeiconAliases(
      "export { default as Search01FreeIcons, default as SearchIcon } from './Search01Icon.js';\n"
    )
    expect(aliases.get("SearchIcon")).toBe("Search01Icon")
    expect(aliases.get("Search01FreeIcons")).toBe("Search01Icon")
  })

  it("fetches each icon once, nothing when none is asked for", async () => {
    const seen: string[] = []
    expect(
      await fetchInlineIcons("lucide", [], { fetch: served({}, seen) })
    ).toEqual(new Map())
    expect(seen).toEqual([])
    const lucide = await fetchInlineIcons("lucide", ["XIcon"], {
      fetch: served({ [dataUrl("lucide", "XIcon")]: LUCIDE_X }),
    })
    expect(lucide.get("XIcon")?.inner).toContain("M18 6 6 18")
    // Phosphor's files leave the size to the page: its packages draw 1em.
    const phosphor = await fetchInlineIcons("phosphor", ["XIcon"], {
      fetch: served({ [dataUrl("phosphor", "XIcon")]: PHOSPHOR_X }),
    })
    expect(phosphor.get("XIcon")?.attributes.slice(0, 3)).toEqual([
      ["xmlns", "http://www.w3.org/2000/svg"],
      ["width", "1em"],
      ["height", "1em"],
    ])
  })

  it("reads Remix Icon from its sprite, once for every icon", async () => {
    const seen: string[] = []
    const sprite = `https://cdn.jsdelivr.net/npm/${ICON_DATA.remixicon}/fonts/remixicon.symbol.svg`
    const icons = await fetchInlineIcons(
      "remixicon",
      ["RiCloseLine", "RiCloseFill"],
      {
        fetch: served({ [sprite]: REMIX_SPRITE }, seen),
      }
    )
    expect([...icons.keys()]).toEqual(["RiCloseLine", "RiCloseFill"])
    expect(seen).toEqual([sprite])
    await expect(
      fetchInlineIcons("remixicon", ["RiMissing"], {
        fetch: served({ [sprite]: REMIX_SPRITE }),
      })
    ).rejects.toThrow(`Remix Icon ${ICON_DATA.remixicon} has no icon RiMissing`)
  })

  it("follows a Hugeicons name to its module through the index, read once", async () => {
    const index = `https://cdn.jsdelivr.net/npm/${ICON_DATA.hugeicons}/dist/esm/index.js`
    const seen: string[] = []
    const fetch = served(
      {
        [index]:
          "export { default as SearchIcon } from './Search01Icon.js';\nexport { default as HomeIcon } from './Home01Icon.js';\n",
        [dataUrl("hugeicons", "Search01Icon")]: HUGE_CANCEL,
        [dataUrl("hugeicons", "Home01Icon")]: HUGE_CANCEL,
        [dataUrl("hugeicons", "Cancel01Icon")]: HUGE_CANCEL,
      },
      seen
    )
    const icons = await fetchInlineIcons(
      "hugeicons",
      ["Cancel01Icon", "HomeIcon", "SearchIcon"],
      { fetch }
    )
    expect([...icons.keys()].sort()).toEqual([
      "Cancel01Icon",
      "HomeIcon",
      "SearchIcon",
    ])
    expect(seen.filter((url) => url === index)).toHaveLength(1)
    await expect(
      fetchInlineIcons("hugeicons", ["NoSuchIcon"], { fetch })
    ).rejects.toThrow(`Hugeicons ${ICON_DATA.hugeicons} has no icon NoSuchIcon`)
  })

  it("says what failed: a network error, an answer, a missing icon", async () => {
    await expect(
      fetchInlineIcons("lucide", ["XIcon"], {
        fetch: (async () => {
          throw new Error("offline")
        }) as typeof fetch,
      })
    ).rejects.toThrow(
      `${dataUrl("lucide", "XIcon")}: could not be fetched: offline`
    )
    await expect(
      fetchInlineIcons("tabler", ["IconX"], {
        fetch: (async () => new Response("", { status: 500 })) as typeof fetch,
      })
    ).rejects.toThrow(`${dataUrl("tabler", "IconX")}: answered 500`)
    await expect(
      fetchInlineIcons("lucide", ["XIcon"], { fetch: served({}) })
    ).rejects.toThrow(`${dataUrl("lucide", "XIcon")}: answered 404`)
  })

  it("uses the global fetch and its own timeout unless told otherwise", async () => {
    const stub = vi.fn(served({ [dataUrl("lucide", "XIcon")]: LUCIDE_X }))
    vi.stubGlobal("fetch", stub)
    try {
      expect((await fetchInlineIcons("lucide", ["XIcon"])).size).toBe(1)
      expect(stub).toHaveBeenCalledOnce()
      await fetchInlineIcons("lucide", ["XIcon"], { timeout: 5 })
      expect(stub).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
