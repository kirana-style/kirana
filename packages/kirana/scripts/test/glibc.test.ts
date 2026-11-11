import { describe, expect, it } from "vite-plus/test"

import { glibcGaps, staticTls } from "../glibc.ts"

/** Lines as `objdump -T` prints a Linux gnu engine's dynamic symbols. */
const LINES = [
  "0000000000000000      DF *UND*\t0000000000000000 (GLIBC_2.14) memcpy",
  "0000000000000000      DF *UND*\t0000000000000000  GLIBC_2.2.5 malloc",
  "0000000000000000      DF *UND*\t0000000000000000 (GCC_3.0)    _Unwind_Resume",
  "0000000000000000      D  *UND*\t0000000000000000              napi_wrap",
  "0000000000000000      D  *UND*\t0000000000000000              node_api_symbol_for",
  "0000000000000000  w   D  *UND*\t0000000000000000              statx",
  "0000000000000000  w   D  *UND*\t0000000000000000              __gmon_start__",
  "00000000004a2b10 g    DF .text\t0000000000000020  Base        napi_register_module_v1",
]

describe("glibc", () => {
  it("passes what glibc 2.17 and Node.js provide", () => {
    expect(glibcGaps(LINES.join("\n"))).toEqual([])
  })

  it("names a symbol past glibc 2.17 and a strong one with no version (KF-104)", () => {
    const gaps = glibcGaps(
      [
        ...LINES,
        "0000000000000000      DF *UND*\t0000000000000000 (GLIBC_2.38) __isoc23_strtoll",
        "0000000000000000      DF *UND*\t0000000000000000  GLIBC_2.17  clock_gettime",
        "0000000000000000      DF *UND*\t0000000000000000  GLIBC_2.18  __cxa_thread_atexit_impl",
        "0000000000000000      D  *UND*\t0000000000000000              __isoc23_strtol",
      ].join("\n")
    )
    expect(gaps).toEqual([
      "__isoc23_strtoll (GLIBC_2.38)",
      "__cxa_thread_atexit_impl (GLIBC_2.18)",
      "__isoc23_strtol (unversioned)",
    ])
  })

  it("finds an engine marked STATIC_TLS, as 0.4.0's and 0.4.1's were (KF-118)", () => {
    const dynamic = (flags: string) =>
      [
        "Dynamic section at offset 0xd66e60 contains 29 entries:",
        "  Tag        Type                         Name/Value",
        " 0x0000000000000001 (NEEDED)             Shared library: [libc.so.6]",
        ` 0x000000000000001e (FLAGS)              ${flags}`,
        " 0x000000006ffffffb (FLAGS_1)            Flags: NOW NODELETE",
      ].join("\n")
    expect(staticTls(dynamic("BIND_NOW STATIC_TLS"))).toBe(true)
    expect(staticTls(dynamic("BIND_NOW"))).toBe(false)
    expect(staticTls("")).toBe(false)
  })
})
