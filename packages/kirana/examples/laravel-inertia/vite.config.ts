import kirana from "@kirana-style/vite"
import react from "@vitejs/plugin-react"
import laravel from "laravel-vite-plugin"
import { defineConfig } from "vite"

// Kirana ahead of React, so pages reach React's compiler with `sx` already a class. Laravel's
// plugin builds into `public/build` and maps `@/` to `resources/js`, as tsconfig.json does.
export default defineConfig({
  plugins: [
    kirana(),
    laravel({ input: "resources/js/app.tsx", refresh: true }),
    react(),
  ],
})
