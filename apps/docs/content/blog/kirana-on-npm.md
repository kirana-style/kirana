---
title: Kirana 0.2.0 is on npm
summary: Every package published from CI with provenance, one command name, the editor extension on both marketplaces, and what to expect on the first day.
date: 2026-10-15
author: Kirana team
tags: [announcement, release]
cover: https://images.unsplash.com/photo-1615800098779-1be32e60cca3?w=1600&q=80&auto=format&fit=crop
coverAlt: White paper, close up
---

Until this week, trying Kirana meant packing tarballs from the repository. That
step is gone. Version 0.2.0 is on npm, and a new project starts with one line:

```console
$ npx kirana-style@latest init --install
```

`init` reads your project and works out its framework, bundler and package
manager. It writes the configuration file, adds the adapter to your bundler's
config, and with `--install` installs the packages that combination needs.
Without it, `init` prints the install command instead. When it is done, it
prints the command that checks the setup.

## One command name

The command is `kirana-style`, everywhere: in a terminal, in `package.json`
scripts, and in what the editor extensions start. The package that carries it
is `kirana-style` too, so the name you install is the name you type.

```console
$ npx kirana-style check
$ npx kirana-style build
$ npx kirana-style doctor
```

Once it is a dependency, the package manager runs it: `pnpm exec kirana-style`,
`yarn kirana-style`, `bunx kirana-style`.

## Where it is published

Every package is published from CI by the release workflow, and none from a
laptop:

- **npm**: the core library, the compiler, the command line, an adapter for
  each framework and bundler, the scales preset, the lint plugins, and the
  native engine for eight platforms plus a WebAssembly build for everywhere
  else. Each tarball carries a provenance statement that ties it to the commit
  and the workflow run that built it.
- **RubyGems, Hex and Packagist**: the template helpers for Rails, Phoenix,
  Laravel and Symfony.
- **The VS Code Marketplace and Open VSX**: the editor extension, so VS Code,
  Cursor, Windsurf and the other VS Code builds install it from their own
  extension view.

After each release, the same workflow asks every registry for the new version,
so a target that quietly did not publish fails the run instead of being found
by a user.

## The first day of a release

Yarn and Deno hold back a version for its first 24 hours, a guard against
packages that are published by mistake or by someone else. On the day of a
release, `yarn dlx kirana-style@latest` and Deno install the version before
it. npm, pnpm and Bun install the new one straight away.

If you need the new version on its first day with Yarn, set
`YARN_NPM_MINIMAL_AGE_GATE=0` for that one command. The
[installation guide](/docs/start/installation) has the details for each
package manager.

## What a 0.x version means

Kirana follows semantic versioning. Before 1.0, a minor version may change the
API, and its release notes say how to move. A patch version only fixes. The
[changelog](/changelog) lists every version and what came with it, and
[what works today](/docs/project/status) says what is finished and what is not.

The next patch adds Deno to `init`, so a project with a `deno.lock` gets
`deno add npm:…` instead of npm's command, and every hint the command prints
names the runner for your package manager.

## Try it

Pick your framework on the [quick start](/docs/start/quick-start), or run `init`
in a project you already have. If something does not work the way a page says
it should, an issue with the output of `kirana-style doctor --report` is the
fastest way to get it fixed.
