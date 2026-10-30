/*
 * Layout choices (the page width, the collapsed sidebar) live in localStorage, read as external
 * stores: the server renders the default, the client switches after hydration, and a change in
 * one tab reaches the others through the storage event. The layout and the width toggle read the
 * same stores.
 */
function preference(key: string) {
  const event = key
  return {
    read() {
      try {
        return localStorage.getItem(key) === "1"
      } catch {
        return false
      }
    },
    write(value: boolean) {
      try {
        localStorage.setItem(key, value ? "1" : "0")
      } catch {}
      window.dispatchEvent(new Event(event))
    },
    subscribe(onChange: () => void) {
      window.addEventListener("storage", onChange)
      window.addEventListener(event, onChange)
      return () => {
        window.removeEventListener("storage", onChange)
        window.removeEventListener(event, onChange)
      }
    },
  }
}

/** Whether the docs page drops its reading width and fills the column. */
export const widePreference = preference("docs-ui:wide")
/** Whether the docs sidebar is folded to a rail of the tabs' icons. */
export const collapsedPreference = preference("docs-ui:sidebar-collapsed")
