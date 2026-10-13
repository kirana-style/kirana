import { ssgAdapter } from "@qwik.dev/router/adapters/ssg/vite"
import { extendConfig } from "@qwik.dev/router/vite"

import baseConfig from "../../vite.config.ts"

// Qwik's static-site adapter: the server build renders every route to HTML in `dist`.
export default extendConfig(baseConfig, () => ({
  build: { ssr: true, rolldownOptions: { input: ["@qwik-router-config"] } },
  plugins: [ssgAdapter({ origin: "http://127.0.0.1" })],
}))
