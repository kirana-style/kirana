# kirana-style

Kirana's command line: set a project up, check it, explain which declaration wins, describe the
design system as JSON, report what the stylesheet holds, build without a bundler, migrate from
Tailwind, StyleX, CSS Modules or styled-components and Emotion, install components, and serve your
editor.

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

For a coding agent or a CI job, the same answers come as data:

| Task                                         | Command                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| Every diagnostic, with its code and help     | `npx kirana-style check src --format json`                      |
| An annotation on each line of a pull request | `npx kirana-style check src --format github`                    |
| Which entry wins, for several questions      | `npx kirana-style trace <file>:<line> <property> --format json` |
| The tokens, themes and recipes that exist    | `npx kirana-style export`                                       |
| Atoms, bytes and the tokens nothing reads    | `npx kirana-style analyze src --json`                           |

For a shorter name, add `"kirana": "kirana-style"` to your `package.json` scripts, or
`alias kirana="npx kirana-style"` in your shell.

Every command: https://kirana.style/docs/tooling/cli
