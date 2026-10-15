---
title: Agent skills
description: Two installable skills teach a coding agent to write Kirana and to migrate to it, with the rules that cause real bugs, the check, trace and report loop, and every diagnostic and lint rule.
section: project
order: 7
keywords:
  [
    agent skills,
    skills.sh,
    ai,
    agents,
    claude code,
    cursor,
    codex,
    coding agent,
    kirana export,
  ]
---

# Agent skills

A model's training data does not contain Kirana, so a coding agent left to itself
writes Tailwind or StyleX and calls it Kirana. The [plain-text docs](/docs/project/llms)
explain the system; the two skills in Kirana's repository tell an agent how to
work in it: what to check first, which mistakes compile and still render wrong,
and what to run when something does.

```bash
npx skills add kirana-style/kirana                 # both
npx skills add kirana-style/kirana --skill kirana  # one
```

The [`skills`](https://github.com/vercel-labs/skills) command installs them for
the agent you use (Claude Code, Cursor, Codex, OpenCode and the others it
supports), in your project or globally with `-g`, and `npx skills update` keeps
them current.

They live in the repository's `skills/` folder; until the repository is public,
point the command at a checkout instead (`npx skills add ./kirana`).

## What each one teaches

| Skill            | When the agent loads it                                                         | What it carries                                                                                          |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `kirana`         | the project imports `@kirana-style/core`, or a style compiles and renders wrong | the rules that cause real bugs, the loop below, where each new thing goes, and the habits to unlearn     |
| `kirana-migrate` | asked to port components or an app from Tailwind, shadcn/ui or StyleX           | the codemods and their reports, the traps in both directions, and how to prove the port renders the same |

Each skill is short (the rules and the workflow), and keeps the detail in
reference files the agent reads only when it needs them: the API, how `sx` is
spelled in each framework, the Tailwind and StyleX mappings, and two files
generated from the compiler's source on every build: every
[diagnostic](/docs/tooling/diagnostics) with what to do about it, and every
[lint rule](/docs/tooling/lint) with the linters that run it. A diagnostic added
to the compiler without a line saying what to do about it fails the build.

## The loop it follows

1. **Learn the project.** Run [`kirana export`](/docs/tooling/cli#kirana-export)
   for the tokens, themes, recipes and relations that exist, by their real names,
   then `kirana doctor`.
2. **Write the style**, with the rules: conditions inside the value, entries
   merge per condition, `sx` forwarded last, `styleProps` for installed
   components, colours as `light-dark()` pairs.
3. **`kirana check`**, and fix every error by its code.
4. **Lint**, with whichever of ESLint, Oxlint or Biome the project runs.
5. **`kirana trace file:line property`** when it compiles and looks wrong.
6. **`kirana doctor --report`** when it looks like a Kirana bug, and ask before
   filing it.

Every step answers from the compiler, so an agent that follows it checks its own
work instead of guessing whether a class string it remembered still exists.

## With llms.txt

The skills and the [plain-text docs](/docs/project/llms) do different jobs. A
skill is instructions an agent loads by itself when the task matches; `llms.txt`
is reference it reads when it needs to know more. The skills link to the
markdown pages instead of copying them, so the two never disagree.
