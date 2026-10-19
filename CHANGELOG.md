# Changelog

## [0.2.4](https://github.com/kirana-style/kirana/compare/v0.2.3...v0.2.4) (2026-10-19)


### Performance

* compile each module once in a one-shot build ([#59](https://github.com/kirana-style/kirana/issues/59)) ([df6d014](https://github.com/kirana-style/kirana/commit/df6d014fae6cd5c85a032056b1322db09427aed3))
* compile modules in parallel in vite and rolldown builds ([#60](https://github.com/kirana-style/kirana/issues/60)) ([e2eb29a](https://github.com/kirana-style/kirana/commit/e2eb29a667bd563cee2e2cf20f51a5e1d46f8c0d))


### Documentation

* take the benchmarks of kirana 0.2.3 from kirana-lab ([#57](https://github.com/kirana-style/kirana/issues/57)) ([ab95357](https://github.com/kirana-style/kirana/commit/ab95357157fda97aad33007277c542118c89f5a9))

## [0.2.3](https://github.com/kirana-style/kirana/compare/v0.2.2...v0.2.3) (2026-10-19)


### Features

* opt-in dense class names for production builds ([#56](https://github.com/kirana-style/kirana/issues/56)) ([8de7aa1](https://github.com/kirana-style/kirana/commit/8de7aa1860a3e2d090d46dd8ef7fd5ba74a03c83))
* **site:** show the lab's scale curve on the benchmarks page ([#53](https://github.com/kirana-style/kirana/issues/53)) ([006313d](https://github.com/kirana-style/kirana/commit/006313d61bc0331059b30cfcf2ea6a31c0772ea2))
* **site:** the large-dom table, a homepage chart and visual habits ([#52](https://github.com/kirana-style/kirana/issues/52)) ([7af6734](https://github.com/kirana-style/kirana/commit/7af6734384f71add75ba12fb506aee11a24aa4d3))


### Bug fixes

* **compiler:** let bundlers drop recipe tables resolved at build time ([#55](https://github.com/kirana-style/kirana/issues/55)) ([1a2eb9b](https://github.com/kirana-style/kirana/commit/1a2eb9bd50c549165cd69fc911b15f3a37f40fc7))
* **release:** publish a package only once npm serves what it depends on ([#50](https://github.com/kirana-style/kirana/issues/50)) ([f52fc50](https://github.com/kirana-style/kirana/commit/f52fc50b5043826efbf87a867b2ef0d1aa9b2cae))


### Performance

* **core:** merge each combination of handles once at runtime ([#54](https://github.com/kirana-style/kirana/issues/54)) ([633486f](https://github.com/kirana-style/kirana/commit/633486f3d212ce2a132ccaac046fecf92516c518))

## [0.2.2](https://github.com/kirana-style/kirana/compare/v0.2.1...v0.2.2) (2026-10-16)


### Features

* **site:** show stylex's swc build beside its babel one ([#44](https://github.com/kirana-style/kirana/issues/44)) ([8d7c870](https://github.com/kirana-style/kirana/commit/8d7c870781c66ae9168774072e75c22772d92c40))


### Bug fixes

* **cli:** let doctor and init see a monorepo's shared setup ([#49](https://github.com/kirana-style/kirana/issues/49)) ([34d4e77](https://github.com/kirana-style/kirana/commit/34d4e774c300d817b591bc77f468fac701a353f3))
* **site:** fill the browser tables and add editors and skills to the ecosystem ([#48](https://github.com/kirana-style/kirana/issues/48)) ([16b83c0](https://github.com/kirana-style/kirana/commit/16b83c0dcf054dda5b2cb1d34e60b7a6c382a431))
* **site:** show only the benchmark targets the site names ([#43](https://github.com/kirana-style/kirana/issues/43)) ([7519e55](https://github.com/kirana-style/kirana/commit/7519e552dd9b65fbd81c2d8524614846e1529d1b))
* **vite:** keep a stylesheet change made while vite is still serving it ([#41](https://github.com/kirana-style/kirana/issues/41)) ([1225bf2](https://github.com/kirana-style/kirana/commit/1225bf28e5f10915626c7c9ed0d3502a9c87cdb9))
* **zed:** find the project's kirana-style through package.json ([#47](https://github.com/kirana-style/kirana/issues/47)) ([5bcbe16](https://github.com/kirana-style/kirana/commit/5bcbe16050fea8f60f5ea538c9b924aa8b3bb966))


### Documentation

* take the benchmarks of kirana 0.2.1 from kirana-lab ([#46](https://github.com/kirana-style/kirana/issues/46)) ([0d8b91b](https://github.com/kirana-style/kirana/commit/0d8b91b99027cd494a68d145a6dd651941aeed23))

## [0.2.1](https://github.com/kirana-style/kirana/compare/v0.2.0...v0.2.1) (2026-10-16)


### Features

* deno in kirana-style init and doctor, and doctor finds kirana-style ([#33](https://github.com/kirana-style/kirana/issues/33)) ([3730d82](https://github.com/kirana-style/kirana/commit/3730d827815164ab32e22f09ad739e0b92502ad3))
* **site:** mobile scenes, release changelog, blog and roadmap redesign ([#34](https://github.com/kirana-style/kirana/issues/34)) ([f9330a8](https://github.com/kirana-style/kirana/commit/f9330a8b8788847609bfcd6b5ea2b795ffbc86f9))
* **site:** read every benchmark number from kirana-lab's runs ([#39](https://github.com/kirana-style/kirana/issues/39)) ([718f253](https://github.com/kirana-style/kirana/commit/718f253dd8ef64d95f3299c2256463458283ec20))


### Bug fixes

* compile the scales preset from node_modules without listing it ([#37](https://github.com/kirana-style/kirana/issues/37)) ([12d8b67](https://github.com/kirana-style/kirana/commit/12d8b67f4fc9359a9534af68ea10f51c0a2a637d))
* let the dev example check look again after the page reloads ([#31](https://github.com/kirana-style/kirana/issues/31)) ([8d21bfd](https://github.com/kirana-style/kirana/commit/8d21bfd39d8b95327f346e1bc38ed2e433be1879))
* pin vitest 4 in the qwik example, inside qwik's peer range ([#36](https://github.com/kirana-style/kirana/issues/36)) ([5317eed](https://github.com/kirana-style/kirana/commit/5317eed4f0293b2befe64bbfda00b18601b3d24b))

## [0.2.0](https://github.com/kirana-style/kirana/compare/v0.1.0...v0.2.0) (2026-10-15)


### ⚠ BREAKING CHANGES

* one command name, kirana-style ([#29](https://github.com/kirana-style/kirana/issues/29))

### Features

* **editor:** real editor output on the site, open vsx trusted publishing ([#21](https://github.com/kirana-style/kirana/issues/21)) ([350fa4e](https://github.com/kirana-style/kirana/commit/350fa4ec0d8054a082d6c7dcdae2b5be53f8d98a))
* one command name, kirana-style ([#29](https://github.com/kirana-style/kirana/issues/29)) ([b3f3154](https://github.com/kirana-style/kirana/commit/b3f3154662589dd1bd43fd0ff2341acf4f3df628))
* **site:** paper, ink, scenery and type for one identity ([#27](https://github.com/kirana-style/kirana/issues/27)) ([5da3c6f](https://github.com/kirana-style/kirana/commit/5da3c6f0f1c8cbfdb450b36a6609a3ab4b20e358))
* **site:** reorganise the homepage, product pages and docs ([#28](https://github.com/kirana-style/kirana/issues/28)) ([88b5209](https://github.com/kirana-style/kirana/commit/88b52093488b2aa0112b458ca04b836c83d03954))
* **site:** scenery gradients, logo downloads, pixel k, glass icons ([#25](https://github.com/kirana-style/kirana/issues/25)) ([2953dc1](https://github.com/kirana-style/kirana/commit/2953dc126f47b68257ebfdb33c61992984708c49))


### Bug fixes

* hold emnapi at 2.0.0-alpha.6, the wasi engine fails on the beta ([#26](https://github.com/kirana-style/kirana/issues/26)) ([8aa33e1](https://github.com/kirana-style/kirana/commit/8aa33e1dbccaefa15b87f6487ac0a346bbf6581a))
* settle the ember dev check, resolve code scanning findings ([#23](https://github.com/kirana-style/kirana/issues/23)) ([0c266c8](https://github.com/kirana-style/kirana/commit/0c266c8428c1453892beeeb5f98918cbc0eae6ff))
* **site:** keep syntax colours in the production build ([#22](https://github.com/kirana-style/kirana/issues/22)) ([621f2fc](https://github.com/kirana-style/kirana/commit/621f2fcf67dada773ca66110e295ab7ac5605f56))


### Documentation

* fix the extension's settings table ([#13](https://github.com/kirana-style/kirana/issues/13)) ([457e06d](https://github.com/kirana-style/kirana/commit/457e06d12f9e3b005e0820aab36faac5bf3f80b3))


### Dependencies

* bump the minor-and-patch group across 1 directory with 3 updates ([#19](https://github.com/kirana-style/kirana/issues/19)) ([7ea00ed](https://github.com/kirana-style/kirana/commit/7ea00edcc5cc02b9ab5e41b13f152ae344ea448f))
* emnapi 2.0.0-beta.1, minor and patch updates ([#24](https://github.com/kirana-style/kirana/issues/24)) ([a399fa7](https://github.com/kirana-style/kirana/commit/a399fa78e53dcfd7f41f249ccee1133809e66544))

## [0.1.0](https://github.com/kirana-style/kirana/compare/v0.1.0...v0.1.0) (2026-10-13)


### Features

* kirana goes public — write objects, read classes, ship css ([79732ed](https://github.com/kirana-style/kirana/commit/79732edd5cab419169ab74ad59e1c70053dfa57d))


### Dependencies

* bump the minor-and-patch group in /packages/kirana with 6 updates ([#10](https://github.com/kirana-style/kirana/issues/10)) ([0deaf9f](https://github.com/kirana-style/kirana/commit/0deaf9f3e75ebc377d764c294250bd2577d53844))
* bump the oxc group in /packages/kirana with 7 updates ([#9](https://github.com/kirana-style/kirana/issues/9)) ([a3ca94c](https://github.com/kirana-style/kirana/commit/a3ca94c170b2ca49c9691abf5ad48c3ef4ac8620))
