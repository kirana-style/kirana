# For LLMs
Source: https://kirana.style/docs/project/llms

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
| `/docs/<path>.md` | One page as markdown — `/docs/styling/merging.md`                                     |

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

- Styles are `css({ ... })` handles. There is no `cn`, no
  `class-variance-authority`, and no utility-class strings.
- Conditions go **inside the value**: `color: { base: a, ":hover": b }`, not a
  `:hover` key at the top level.
- Dark mode is a `light-dark()` pair on the token. There is no `dark:` variant
  and no second stylesheet.
- A later style **replaces the entries it names** and keeps the rest. To drop a
  property's other entries, write `{ "*": null, base: ... }`.

Everything the compiler can catch, it catches: a mistake in any of these is a
diagnostic with a code, not a silently wrong style. The
[diagnostics reference](/docs/tooling/diagnostics) lists all of them, and it is
worth handing to an agent alongside the pages above.

## Machine-readable extras

- The diagnostics are also available as data on the
  [diagnostics page](/docs/tooling/diagnostics) — code, message, and what to do
  about it.
- [`kirana export`](/docs/tooling/cli#kirana-export) prints your project's own
  design system — tokens, themes, recipes and relations, with where each is
  declared — as JSON, so an agent uses the names that exist.
- The [API reference](/docs/reference/api) is generated from the packages'
  type declarations, so its signatures are the real ones.
- The [playground](/play) shows curated examples with the CSS, class names and
  diagnostics the real compiler produced from them at build time. It does not
  compile pasted source yet — that needs the WASM engine — so to check an agent's
  suggestion, run `kirana build` or `kirana check` on it.
