---
title: Quick start
description: Add Kirana to your project in three steps (install it, add the plugin, import the stylesheet), read from your framework's own guide.
section: start
order: 3
keywords: [quick start, getting started, setup, install, kirana init]
---

# Quick start

Pick your framework. The steps below are read from its guide, so they always match it.

<!-- ::install-explorer -->

Or let the command line set it up. In your project's root:

```console
$ npx kirana-style init
$ npx kirana-style doctor
```

`kirana init` recognises the framework, the bundler and the package manager, and shows every change
it would make as a diff; nothing is written until you say yes. `kirana doctor` then checks the
engine, the installed versions and the wiring. [Installation](/docs/start/installation) has the
details, including how to install while the packages are not on npm yet.

## Where to go next

- [Your first component](/docs/start/first-component): a button, and the CSS it compiles to.
- [Mental model](/docs/start/mental-model): the five ideas that make the rest predictable.
- [Every framework guide](/docs/frameworks/overview), with what `sx` compiles to in each.
