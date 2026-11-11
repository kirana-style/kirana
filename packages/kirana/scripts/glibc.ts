/**
 * What a Linux engine needs from the C library that loads it. The gnu engines link against napi-rs's
 * glibc 2.17 toolchain so they load on any distribution from the last decade; a symbol that
 * toolchain's glibc lacks still links, since a shared object may leave symbols undefined, and fails
 * only when the engine loads. 0.4.0 shipped one: mimalloc's C, compiled against the runner's headers,
 * asked for `__isoc23_strtol`, which glibc defines from 2.38 (KF-104, read from `objdump -T`). Every
 * Linux engine is loaded with `dlopen`, which limits how it may keep thread-locals (KF-118, read from
 * `readelf -d`).
 */

/** The newest glibc the engines may need. */
export const GLIBC_FLOOR = "2.17"

/**
 * The symbols in `objdump -T` output that glibc 2.17 does not provide: any versioned past
 * `GLIBC_2.17`, and any strong undefined symbol with no version, apart from Node-API's, which the
 * Node.js process provides. A weak one (`statx`, `gettid`) is null where the libc lacks it: Rust's
 * standard library looks for those at run time.
 */
export function glibcGaps(objdump: string): string[] {
  const gaps: string[] = []
  for (const line of objdump.split("\n")) {
    const fields =
      /^[0-9a-f]+\s+(.*?)\*UND\*\s+[0-9a-f]+\s+(?:\(?([\w.]+?)\)?\s+)?(\S+)$/.exec(
        line.trim()
      )
    if (!fields) continue
    const [, flags = "", version, name = ""] = fields
    if (version?.startsWith("GLIBC_")) {
      if (newer(version.slice("GLIBC_".length), GLIBC_FLOOR))
        gaps.push(`${name} (${version})`)
    } else if (
      !version &&
      !/\bw\b/.test(flags) &&
      !/^(napi|node_api)_/.test(name)
    )
      gaps.push(`${name} (unversioned)`)
  }
  return gaps
}

/** Whether dotted version `a` is newer than `b`. */
function newer(a: string, b: string): boolean {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return difference > 0
  }
  return false
}

/**
 * Whether `readelf -d` output marks a shared object `STATIC_TLS` (KF-118): something in it reads a
 * thread-local with the initial-exec model, so the loader must place its whole TLS block at a fixed
 * offset. An engine is loaded with `dlopen`, after the process has started: musl cannot give a
 * library loaded then such an offset, and glibc fits its block in the reserve it keeps for them,
 * 1,664 bytes by default. 0.4.0's and 0.4.1's engines took 952 of them (mimalloc's initial-exec
 * thread-locals placing Rust's with them), and two engines in one process failed with "cannot
 * allocate memory in static TLS block".
 */
export function staticTls(dynamic: string): boolean {
  return /\(FLAGS\)\s.*\bSTATIC_TLS\b/.test(dynamic)
}
