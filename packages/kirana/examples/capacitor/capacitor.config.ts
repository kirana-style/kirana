import type { CapacitorConfig } from "@capacitor/cli"

// The native projects load the web app Vite builds into dist.
const config: CapacitorConfig = {
  appId: "style.kirana.example.capacitor",
  appName: "Kirana on Capacitor",
  webDir: "dist",
}

export default config
