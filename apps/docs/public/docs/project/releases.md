# Releases and upgrading
Source: https://kirana.style/docs/project/releases

# Releases and upgrading

## Today

Every package is **0.1.0**, and none is published. There is nothing to upgrade
from yet, and no changelog — the record of what changed is the implementation
tracker in the repository, written per sprint.

<!-- ::packages -->

## How versions will work

**One version for everything.** The compiler, the adapters, the CLI, the language
server and the packages release together at the same number. A diagnostic touches
the engine, the lint rules, the editor and the documentation at once, so a version
where those disagree would be a version that lies.

**Pre-1.0 means the API can move.** Minor versions may change behaviour before
1.0. Every such change gets an entry saying what moved and what to do — the same
way the specification's decision log records why a decision was superseded.

**After 1.0**, semantic versioning: a breaking change means a major.

## What counts as breaking

- Removing or renaming an export, or changing what it returns.
- Changing which style wins — the ladder, merge semantics, layer order.
- Changing a diagnostic's meaning. (Codes and names are stable once released;
  a code may gain a better message, never a different subject.)
- Changing generated class names in a way that breaks a shared page, other than
  through the configured prefix.

What is _not_ breaking: new diagnostics, new API, better messages, smaller output.

## When you upgrade

1. Read the release note for behaviour changes.
2. `kirana check` — new diagnostics surface here first, and a new warning is
   usually a real problem that was invisible before.
3. Build, and diff the stylesheet. Output is deterministic, so a diff is
   meaningful: it shows exactly which declarations changed.
4. If the project has a visual baseline, compare computed styles rather than
   screenshots. [Conformance](/docs/advanced/conformance) explains the method.
