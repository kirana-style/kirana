# For LLMs
Source: https://site.kirana-style.workers.dev/docs/project/llms

# For LLMs

Every page of this site is also served as markdown, and the whole set is served
as two plain-text files. They come from the same parse as the pages you are
reading, in the same build, so they cannot drift.

Kirana is new enough that a model's training data does not contain it. Pointing
a coding agent at these files is the difference between it writing Kirana and it
writing something that looks like Tailwind.

## The endpoints

| URL               | What it is                                                                            |
| ----------------- | ------------------------------------------------------------------------------------- |
| `/llms.txt`       | The index: one line per page, with its description and a link to that page's markdown |
| `/llms-full.txt`  | Every page, in reading order, as one file                                             |
| `/docs/<path>.md` | One page as markdown, such as `/docs/styling/merging.md`                              |

`/docs/index.md` is the introduction. The markdown twin of a page carries its
title and canonical URL in a two-line header, then the page body exactly as it
was written.

## Which one to use

**`/llms.txt` first.** It is small, and it lets an agent choose the pages it
actually needs rather than spending its context on all of them.

**A single page** when you know the topic. Merging, precedence, conditions and
the API reference answer most questions on their own.

**`/llms-full.txt`** when you want the whole documentation in one context
window, or when you are building an index of your own.

> [!TIP] Start with these four
> `/docs/start/mental-model.md`, `/docs/styling/styles.md`,
> `/docs/styling/merging.md` and `/docs/reference/api.md` cover the parts an
> agent gets wrong without them: that styles are typed objects, that conditions
> live inside the value, and that a later style replaces entries rather than
> whole properties.

## Giving an agent the rules

The documentation explains Kirana; it does not, by itself, stop an agent
reaching for habits from other systems. The [agent skills](/docs/project/agent-skills)
do that part: install them, and the agent loads the rules, the
check-trace-report loop and the diagnostics reference by itself. The four rules worth stating outright in
your own prompt or project instructions:

- Styles are `css({ ... })` handles. There is no `cn` and no
  `class-variance-authority`, and no utility-class strings unless the project
  turns on the [scales preset's utilities](/docs/styling/utilities).
- Conditions go **inside the value**: `color: { base: a, ":hover": b }`, not a
  `:hover` key at the top level.
- Dark mode is a `light-dark()` pair on the token. There is no `dark:` variant
  and no second stylesheet.
- A later style **replaces the entries it names** and keeps the rest. To drop a
  property's other entries, write `{ "*": null, base: ... }`.

The compiler catches a condition written outside the value and a property that
does not exist as diagnostics with a code. The lint plugin catches two more:
`no-class-helpers` (in its strict config) reports `clsx` and the like joining
class strings, and `no-dark-variant` reports dark mode written as a
`prefers-color-scheme` query, which compiles. What the compiler checks, and what
it leaves alone, is [on its own page](/docs/styling/styles#what-the-compiler-checks);
the [diagnostics reference](/docs/tooling/diagnostics) lists every code, and it is
worth handing to an agent alongside the pages above.

## Machine-readable extras

- The diagnostics are also available as data on the
  [diagnostics page](/docs/tooling/diagnostics): code, message, and what to do
  about it.
- [`kirana-style export`](/docs/tooling/cli#kirana-style-export) prints your project's own
  design system (tokens, themes, recipes and relations, with where each is
  declared) as JSON, so an agent uses the names that exist.
- The [API reference](/docs/reference/api) is generated from the packages'
  type declarations, so its signatures are the real ones.
- [`kirana-style check --format json`](/docs/tooling/cli#kirana-style-check)
  gives each diagnostic as data, and
  [`kirana-style trace --format json`](/docs/tooling/cli#kirana-style-trace)
  says which entry wins for a property at a line, and why.
- [Kirana Play](https://play.kirana-style.workers.dev) compiles a project in your browser with a
  released engine, and [`/play`](/play) shows this site's curated examples with
  the CSS the compiler produced from them. To check an agent's change in its own
  project, run `kirana-style check` on it.
