# kirana-style

Kirana's command line: set a project up, check it, build without a bundler, explain which
declaration wins, migrate from Tailwind or StyleX, and serve your editor.

Run it without installing anything, as `npx shadcn@latest` works:

```bash
npx kirana-style@latest init      # detect the framework and bundler, show the changes, write them
```

| Package manager | First run                             |
| --------------- | ------------------------------------- |
| npm             | `npx kirana-style@latest init`        |
| pnpm            | `pnpm dlx kirana-style@latest init`   |
| Yarn            | `yarn dlx kirana-style@latest init`   |
| Bun             | `bunx --bun kirana-style@latest init` |

`init` adds `kirana-style` to your dev dependencies, so every later command runs the version your
project pins:

```bash
npx kirana-style doctor                          # check the setup
npx kirana-style check src                       # diagnostics; exits 1 on errors
npx kirana-style trace src/card.tsx:12 padding   # which declaration wins, and why
```

For a shorter name, add `"kirana": "kirana-style"` to your `package.json` scripts, or
`alias kirana="npx kirana-style"` in your shell.

Every command: https://kirana.style/docs/tooling/cli
