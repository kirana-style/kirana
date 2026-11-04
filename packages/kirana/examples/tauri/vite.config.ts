import kirana from "@kirana-style/vite"
import { defineConfig } from "vite"

// What create-tauri-app sets: a fixed port Tauri waits for, no screen clearing over Rust's errors,
// and src-tauri left out of the watch. TAURI_DEV_HOST is set when developing on a phone.
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [kirana()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
