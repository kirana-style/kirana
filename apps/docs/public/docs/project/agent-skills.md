# Agent skills
Source: https://site.kirana-style.workers.dev/docs/project/agent-skills

# Agent skills

A model's training data does not contain Kirana, so a coding agent left to itself
writes Tailwind or StyleX and calls it Kirana. The [plain-text docs](/docs/project/llms)
explain the system; the skills in Kirana's repository, `kirana`, `kirana-migrate` and `kirana-system`, tell an
agent how to work in it: what to check first, which mistakes compile and still
render wrong, and what to run when something does.

```bash
npx skills add kirana-style/kirana                 # all of them
npx skills add kirana-style/kirana --skill kirana  # one
```

The [`skills`](https://github.com/vercel-labs/skills) command installs them for
the agent you use (Claude Code, Cursor, Codex, OpenCode and the others it
supports), in your project or globally with `-g`, and `npx skills update` keeps
them current.

They live in the repository's `skills/` folder; to try a change to them before it
is merged, point the command at a checkout (`npx skills add ./kirana`).

## What each one teaches

| Skill            | When the agent loads it                                                                                                                   | What it carries                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kirana`         | the project imports `@kirana-style/core` or has a `kirana.config`, a style compiles and renders wrong, or components come from a registry | the rules that cause real bugs, what the compiler does not catch, the loop below, where each new thing goes (typed state keys included), installing from a registry and `ui mcp`, the habits to unlearn, and the family's other skills |
| `kirana-system`  | asked to build, restructure or publish a design system or component library on Kirana, or to write registry items                         | the layers of a system, the rules that cause real bugs when others consume it, the loops for building one, publishing an npm library and publishing a registry, and keeping installed copies current                                   |
| `kirana-migrate` | asked to port components or an app from Tailwind, shadcn/ui, StyleX, styled-components, Emotion or CSS Modules                            | the codemods and their reports, the traps in both directions, and how to prove the port renders the same                                                                                                                               |

Each skill is short (the rules and the workflow), and keeps the detail in
reference files the agent reads only when it needs them: the API, how `sx` is
spelled in each framework, the token kinds, the registry's documents and commands, the Tailwind, StyleX, styled-components and CSS Modules mappings, and two files
generated from the compiler's source on every build: every
[diagnostic](/docs/tooling/diagnostics) with what to do about it, and every
[lint rule](/docs/tooling/lint) with the linters that run it. A diagnostic added
to the compiler without a line saying what to do about it fails the build.

## The loop it follows

1. **Learn the project.** Run [`kirana-style export`](/docs/tooling/cli#kirana-style-export)
   for the tokens, themes, recipes and relations that exist, by their real names,
   then `kirana-style doctor`.
2. **Write the style**, with the rules: conditions inside the value, entries
   merge per condition, `sx` forwarded last, `styleProps` for installed
   components, a headless part's state by its typed key, colours as
   `light-dark()` pairs.
3. **`kirana-style check --format json`**, and fix every error by its code: each
   entry carries the code, the file with its line and column, and a `help` that,
   for a misspelt name, is the fix (the nearest property, condition, token,
   variant or keyword).
4. **Lint**, with whichever of Oxlint, ESLint or Biome the project runs.
5. **`kirana-style trace file:line property`** when it compiles and looks wrong,
   and the browser after it: `check` passing means every name exists and every
   value fits its property, not that the style is the one meant.
6. **`kirana-style doctor --report`** when it looks like a Kirana bug, and ask before
   filing it.

Every step answers from the compiler, so an agent that follows it checks its own
work instead of guessing whether a class string it remembered still exists.

## The family's skills

Kirana UI, Kirana UI Primitives and the agent bridge have skills of their own,
installed from their repository: `npx skills add kirana-style/kirana-ui`. The
`kirana` skill names them, and when a project needs each.

## With llms.txt

The skills and the [plain-text docs](/docs/project/llms) do different jobs. A
skill is instructions an agent loads by itself when the task matches; `llms.txt`
is reference it reads when it needs to know more. The skills link to the
markdown pages instead of copying them, so the two never disagree.
