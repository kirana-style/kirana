# Choose a bundler
Source: https://kirana.style/docs/integrations/bundlers

# Choose a bundler

Every adapter does the same small job: it hands modules that carry styles to the
compiler, and puts the finished stylesheet where the bundler expects it. None of
them interprets a style, so the atoms, the class names and the stylesheet are
byte-for-byte the same whichever bundler built them.

- [Vite](/docs/integrations/vite): The build tool most frameworks run on, with hot style updates.
- [Rolldown](/docs/integrations/rolldown): The Rust bundler under Vite, on its own.
- [webpack](/docs/integrations/webpack): A pre loader for sx and a plugin that writes the stylesheet.
- [Rspack and Rsbuild](/docs/integrations/rspack): The fast Rust-based web bundler, and its build tool.
- [Parcel](/docs/integrations/parcel): The zero-configuration build tool for the web.
- [Bun](/docs/integrations/bun): Bun's bundler and its dev server, from one plugin.
- [esbuild](/docs/integrations/esbuild): An extremely fast bundler, in watch and serve modes too.
- [PostCSS](/docs/integrations/postcss): The project's stylesheet wherever @kirana; stands.
- [Jest](/docs/integrations/jest): A transformer, so tests see the class names you ship.
- [Storybook](/docs/integrations/storybook): Stories built with your project's Vite config, styled as the app is.

## Development servers


Every host updates the stylesheet while you work. Vite, webpack, Rspack, Rsbuild
and Next.js send it as a CSS hot update; Bun and esbuild as their reload. Each is
checked on every change: the dev server starts, a style is edited, and the page
must show it.

## Same styles on every host

Kirana's adapters only hand modules to one compiler and put its stylesheet where
the bundler expects it, so the same source gives the same CSS whichever bundler
builds it. CI checks exactly that: one React example, built with every bundler,
must produce the same set of classes as with Vite.
