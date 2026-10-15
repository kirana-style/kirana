# kirana-style

Kirana's command line, for a project that does not have Kirana yet:

```bash
npx kirana-style init      # detect the framework and bundler, show the changes, write them
npx kirana-style doctor    # check the setup
```

`init` adds `@kirana-style/compiler` to the project, and that package carries the `kirana`
command itself. From then on, run `npx kirana <command>`: `check`, `build`, `trace` and the rest.
This package only makes the first run possible under a name npm can give it, and runs the same
command.

The packages are `@kirana-style/core`, `@kirana-style/vite` and the rest of the scope. See
https://kirana.style/docs/start/quick-start.
