/**
 * When a release asks npm again instead of stopping: a registry failure (0.3.1 stopped on an E503)
 * is retried, and one about the package or the credentials (E401, E403, E404, E422, EOTP) is not,
 * because asking again gives the same answer.
 */

/** Seconds to wait before each further attempt; one entry per retry. */
export const RETRY_DELAYS = [15, 30, 60, 120] as const

/** HTTP statuses that say the registry, not the request, failed. */
export function transientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

/** Whether `npm publish` failed for a transient reason, read from its stderr. */
export function transientNpmError(stderr: string): boolean {
  const code = /npm (?:error|ERR!) code (\S+)/.exec(stderr)?.[1]
  if (code === undefined) return false
  if (/^E\d{3}$/.test(code)) return transientStatus(Number(code.slice(1)))
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
    "ERR_SOCKET_TIMEOUT",
  ].includes(code)
}
