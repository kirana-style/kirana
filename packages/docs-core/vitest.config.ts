import { defineConfig } from "vite-plus"

// The floor sits at today's coverage so it can only rise; the remaining gaps are
// defensive branches in the generator (malformed nav groups, missing blog dirs).
export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["src/**"],
      thresholds: { statements: 92, branches: 80, functions: 92, lines: 94 },
    },
  },
})
