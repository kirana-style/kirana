# Changelog

## [0.3.5](https://github.com/kirana-style/kirana/compare/v0.3.4...v0.3.5) (2026-10-28)


### Features

* a part that anchors a relation can read its own kind beside it ([#163](https://github.com/kirana-style/kirana/issues/163)) ([71131ad](https://github.com/kirana-style/kirana/commit/71131adc72d053b547879b1ebaddbc4f22b012bc))
* add @kirana-style/compiler-browser, the engine in a browser page ([#155](https://github.com/kirana-style/kirana/issues/155)) ([566f300](https://github.com/kirana-style/kirana/commit/566f300bfe33f94f4c51399f1b199b0ae3915b64))
* angular parts merge sx through partSx beside SxDirective ([#167](https://github.com/kirana-style/kirana/issues/167)) ([0138926](https://github.com/kirana-style/kirana/commit/0138926c8249b337682b84f64d1587fb3e2d1740))
* font items, imported by ui add and installed by a preset ([#168](https://github.com/kirana-style/kirana/issues/168)) ([e6dc629](https://github.com/kirana-style/kirana/commit/e6dc62989b81038a6110eb731ccf4fc0b8325c12))
* own() claims an attribute for one component's style ([#169](https://github.com/kirana-style/kirana/issues/169)) ([52f6e52](https://github.com/kirana-style/kirana/commit/52f6e52bb3840521e3fc86ac6b1017aed6a6b8bb))
* style helpers evaluate object.entries, fromEntries and map ([#160](https://github.com/kirana-style/kirana/issues/160)) ([05421b8](https://github.com/kirana-style/kirana/commit/05421b8cccff73fdc0cf57aa288a2606b200eafd))


### Bug fixes

* a relation read compiles in a module that does not import kirana ([#159](https://github.com/kirana-style/kirana/issues/159)) ([cb073a4](https://github.com/kirana-style/kirana/commit/cb073a4aa5f1c5039ed2182a18118d8123d11851))
* an import no style reads is not reported unresolved or cyclic ([#148](https://github.com/kirana-style/kirana/issues/148)) ([40eff25](https://github.com/kirana-style/kirana/commit/40eff2516620feade8130c8a2cf74b3d1b45fd06))
* an import of a file created during a watch session resolves ([#164](https://github.com/kirana-style/kirana/issues/164)) ([afdb700](https://github.com/kirana-style/kirana/commit/afdb7007c9908f7c3f3036e6eaec9cb0d2ac197f))
* angular and ember peer @kirana-style/vite at the release's version ([#157](https://github.com/kirana-style/kirana/issues/157)) ([09d71db](https://github.com/kirana-style/kirana/commit/09d71db1124dc722e54fbcfee70f3a511cfceea4))
* props() and keyframes() are typed as they compile ([#158](https://github.com/kirana-style/kirana/issues/158)) ([b797caa](https://github.com/kirana-style/kirana/commit/b797caa8f040ffc0e0dccfb513b76ef0517e407b))
* removing a whole box removes its logical sides too ([#171](https://github.com/kirana-style/kirana/issues/171)) ([f838ff1](https://github.com/kirana-style/kirana/commit/f838ff1de7c7b31c0c576fcda3394fc27abd5cd5))
* ui init gives a javascript next.js app its tsconfig and typescript ([#149](https://github.com/kirana-style/kirana/issues/149)) ([6eee0fd](https://github.com/kirana-style/kirana/commit/6eee0fdda35deca7ad66721ff12b3791bfba228c))


### Performance

* a dev server and a watch build reuse unchanged transforms ([#170](https://github.com/kirana-style/kirana/issues/170)) ([3eac1cf](https://github.com/kirana-style/kirana/commit/3eac1cfb6a730fae900d6c81ed86b9b5833baf22))
* a style written out in full compiles once a session ([#166](https://github.com/kirana-style/kirana/issues/166)) ([ec84bd3](https://github.com/kirana-style/kirana/commit/ec84bd35af1068fbfe0a6aa52972b70ed2eff05f))
* dense names build the renaming's source map only when the build writes maps ([#161](https://github.com/kirana-style/kirana/issues/161)) ([a655efd](https://github.com/kirana-style/kirana/commit/a655efd0632b97c86190cca95c5ce7b73dd38a88))
* reading a preset's tokens no longer walks the whole preset ([#165](https://github.com/kirana-style/kirana/issues/165)) ([b92775d](https://github.com/kirana-style/kirana/commit/b92775d74d96b8f4b357616937ddc7921ac1c73a))
* the engine loader looks up the c library once per process ([#156](https://github.com/kirana-style/kirana/issues/156)) ([344a932](https://github.com/kirana-style/kirana/commit/344a932ed212900c6cdeb980d135d5c248fd93c2))
* the stylesheet is written from one atom index, not every module's atoms ([#162](https://github.com/kirana-style/kirana/issues/162)) ([6718147](https://github.com/kirana-style/kirana/commit/6718147b0bb444f3d63403047c726d31e823a517))


### Documentation

* take the benchmarks of kirana 0.3.4 from kirana-lab ([#153](https://github.com/kirana-style/kirana/issues/153)) ([f093aa7](https://github.com/kirana-style/kirana/commit/f093aa7a693e38fcc8d252f9e797c775e2321ca1))
* the roadmap lists the products planned beside the compiler ([#154](https://github.com/kirana-style/kirana/issues/154)) ([7806842](https://github.com/kirana-style/kirana/commit/7806842cbd7ebf67efa98131f3343891351df01c))


### Dependencies

* bump the minor-and-patch group with 4 updates ([#151](https://github.com/kirana-style/kirana/issues/151)) ([4bb63be](https://github.com/kirana-style/kirana/commit/4bb63be11279c059c28f33e120b6fc36af06da02))

## [0.3.4](https://github.com/kirana-style/kirana/compare/v0.3.3...v0.3.4) (2026-10-27)


### Features

* conditions.ownAttributes, attributes exclusiveAcross never takes for a library's ([#147](https://github.com/kirana-style/kirana/pull/147)) ([9785e20](https://github.com/kirana-style/kirana/commit/9785e20ab47efe9f38926dfa6b90ed26c207e2bf))
* npx @kirana-style/registry starts a project from nothing, and init leaves one that runs ui ([#139](https://github.com/kirana-style/kirana/pull/139)) ([1bc3ee1](https://github.com/kirana-style/kirana/commit/1bc3ee13b8a202a22dc21b7274f75def34f1caa1))
* relation(name, { optional: true }) for a reader installed without its anchor ([#146](https://github.com/kirana-style/kirana/pull/146)) ([248abd7](https://github.com/kirana-style/kirana/commit/248abd75e9747005037ecd5d3c30e218f4745132))


### Bug fixes

* ark ui's orientation keys name horizontal and vertical ([#145](https://github.com/kirana-style/kirana/pull/145)) ([81fcbd2](https://github.com/kirana-style/kirana/commit/81fcbd27210688393ff4c8f10af2df2824bd8063))
* kirana/diagnostics reads a vue script block under oxlint as its block module ([#136](https://github.com/kirana-style/kirana/pull/136)) ([ad833a2](https://github.com/kirana-style/kirana/commit/ad833a2f7f87db174d519ff83a369289202fd926))
* style helpers fold optional values, in, token comparisons and default parameters ([#144](https://github.com/kirana-style/kirana/pull/144)) ([bc8041c](https://github.com/kirana-style/kirana/commit/bc8041cd455a549b399bc23cf94981e3895dd24f))
* type-only imports close no import cycle, and a value cycle is reported ([#143](https://github.com/kirana-style/kirana/pull/143)) ([f7387b4](https://github.com/kirana-style/kirana/commit/f7387b4676000f293d856281e71f51df5308b618))
* unreachable-entry stays quiet for pairs exclusiveAcross declares ([#137](https://github.com/kirana-style/kirana/pull/137)) ([098ed99](https://github.com/kirana-style/kirana/commit/098ed995cce33e30a0de694365affd4a6dd0a99e))


### Documentation

* take the benchmarks of kirana 0.3.3 from kirana-lab ([#135](https://github.com/kirana-style/kirana/pull/135)) ([cb2f626](https://github.com/kirana-style/kirana/commit/cb2f626fe46cef83c32a49cc6f30008986c0636f))
* take the benchmarks of kirana 0.3.3 from kirana-lab ([#140](https://github.com/kirana-style/kirana/pull/140)) ([f501a26](https://github.com/kirana-style/kirana/commit/f501a264201a86b3ec79b05a6c8d101892df7623))


### Dependencies

* angular build 22.2.4, with its option schemas ([#138](https://github.com/kirana-style/kirana/pull/138)) ([2432806](https://github.com/kirana-style/kirana/commit/2432806c8b594e00413c99dea8da0809a450a82a))
* bump vscode-languageclient from 10.1.2 to 11.0.0 ([#133](https://github.com/kirana-style/kirana/pull/133)) ([32a0374](https://github.com/kirana-style/kirana/commit/32a0374579159b5dc1c05974a98feecf036dd041))

## [0.3.3](https://github.com/kirana-style/kirana/compare/v0.3.2...v0.3.3) (2026-10-25)


### Features

* a registry base names the items only it needs ([#128](https://github.com/kirana-style/kirana/pull/128)) ([dd557c1](https://github.com/kirana-style/kirana/commit/dd557c158d876a2f1d1ff8f6365a89e3bd42c553))
* add @kirana-style/registry with the registry format, schemas, and lockfile ([#118](https://github.com/kirana-style/kirana/pull/118)) ([abcf8bc](https://github.com/kirana-style/kirana/commit/abcf8bc81770850ea0eac4503468528cef747e9c))
* definitions say how each entry was written, with every token it reads ([#117](https://github.com/kirana-style/kirana/pull/117)) ([bcaaf2d](https://github.com/kirana-style/kirana/commit/bcaaf2d66afb4a4c29cb85d342444c28baaa7fc3))
* flattened builds at install, and kirana-style ui preset ([#130](https://github.com/kirana-style/kirana/pull/130)) ([06baff0](https://github.com/kirana-style/kirana/commit/06baff0f0a2164a50aa3d3fb1ace552ae2bb63d1))
* kirana-style ui init, add, outdated, diff, update and remove ([#129](https://github.com/kirana-style/kirana/pull/129)) ([2c870d3](https://github.com/kirana-style/kirana/commit/2c870d3af3af26b2065ee48781b1cd42b8fe2a3f))
* kirana-style ui reads registries: namespaces, urls and headers ([#119](https://github.com/kirana-style/kirana/pull/119)) ([28bd423](https://github.com/kirana-style/kirana/commit/28bd42345622a9a8d7d20b55a59c02eb75c0c88d))
* kirana-style ui view and search ([#126](https://github.com/kirana-style/kirana/pull/126)) ([8069462](https://github.com/kirana-style/kirana/commit/8069462910fcf853e1eb86e58f68c83f0921640b))
* parent() ranks with pseudo-classes, and entries no element can match are left out ([#115](https://github.com/kirana-style/kirana/pull/115)) ([1f7b39d](https://github.com/kirana-style/kirana/commit/1f7b39d24b5c62b69de4080e659d728cd6a49fd1))
* states for bits ui command and scroll area, ark ui field and fieldset ([#114](https://github.com/kirana-style/kirana/pull/114)) ([d3ac169](https://github.com/kirana-style/kirana/commit/d3ac169fcede53e72ff6899c1174c67770b40eca))


### Bug fixes

* kirana.config.ts loads as written in a commonjs package ([#127](https://github.com/kirana-style/kirana/pull/127)) ([e74902b](https://github.com/kirana-style/kirana/commit/e74902ba33509ea62b6d9b628642c8f91205b05f))
* relation-unused follows a relation's exported readers, and trace reads one line's sites ([#112](https://github.com/kirana-style/kirana/pull/112)) ([62f02f1](https://github.com/kirana-style/kirana/commit/62f02f17b24de94bd43cdfd6c42ec5c7cb2776b4))
* the wasi engine loads again, on emnapi 2.0.0-beta.2 ([#120](https://github.com/kirana-style/kirana/pull/120)) ([ab2936a](https://github.com/kirana-style/kirana/commit/ab2936a091b6c6cd7520a7aba21afff06c8a03cf))
* vue parts lint and type-check with usesx, and astro 7 prerenders compiled ([#113](https://github.com/kirana-style/kirana/pull/113)) ([2f193e2](https://github.com/kirana-style/kirana/commit/2f193e2b0baca4098a76c948d3d85db9a031a100))


### Documentation

* take the benchmarks of kirana 0.3.2 from kirana-lab ([#110](https://github.com/kirana-style/kirana/pull/110)) ([641a8d9](https://github.com/kirana-style/kirana/commit/641a8d9be61fe344e8d6463629ccd7a0f75e7c97))


### Dependencies

* bump string_wizard from 1.2.14 to 1.2.15 in /packages/kirana in the minor-and-patch group ([#124](https://github.com/kirana-style/kirana/pull/124)) ([5493e39](https://github.com/kirana-style/kirana/commit/5493e39806b475c4152a35c570bcfbdd21b704eb))
* oxc 0.155 with lone surrogates kept, and the week's updates ([#131](https://github.com/kirana-style/kirana/pull/131)) ([1d50743](https://github.com/kirana-style/kirana/commit/1d507438bfe9d1c1d9ba397619fc81e94792a627))
* update phpunit/phpunit requirement from ~13.3.0 to ~13.3.0 || ~13.4.0 in /packages/kirana/helpers/php ([#122](https://github.com/kirana-style/kirana/pull/122)) ([0b61a05](https://github.com/kirana-style/kirana/commit/0b61a05a10c745c9423f7672ccd19bbb4338fbf0))

## [0.3.2](https://github.com/kirana-style/kirana/compare/v0.3.1...v0.3.2) (2026-10-24)


### Features

* a library api for tools: trace as json, evaluated styles, tailwind lowering ([#101](https://github.com/kirana-style/kirana/pull/101)) ([6c2b245](https://github.com/kirana-style/kirana/commit/6c2b245e7d4254a23ff87c036cbdaefc0a0b7b9d))
* counter styles, two opt-in lint rules, and faster value checks ([#91](https://github.com/kirana-style/kirana/pull/91)) ([0d09464](https://github.com/kirana-style/kirana/commit/0d09464829c021dcd9fe8bf02725536b17f80af2))
* kirana-style ui for the component registry, and a ui config key ([#109](https://github.com/kirana-style/kirana/pull/109)) ([7db6754](https://github.com/kirana-style/kirana/commit/7db67548d35d386b73234e880bca8580e0d1aafc))
* rel.parent(), and a within read on an element that carries its anchor ([#106](https://github.com/kirana-style/kirana/pull/106)) ([6aa0f97](https://github.com/kirana-style/kirana/commit/6aa0f97c28de9d2ed655b4c5a03017247b12472b))
* spacing() and exclusiveAcross() for design systems on several libraries ([#104](https://github.com/kirana-style/kirana/pull/104)) ([ae628b4](https://github.com/kirana-style/kirana/commit/ae628b4980a0f93a35ea0cfd6a456d8e5fbdd2b0))
* states for reka ui, bits ui and angular primitives ([#107](https://github.com/kirana-style/kirana/pull/107)) ([6c730d1](https://github.com/kirana-style/kirana/commit/6c730d1f962f7d26d3fbc6c99a01c83db7b15195))
* the cli reads each path's own config, and says why one fails to load ([#102](https://github.com/kirana-style/kirana/pull/102)) ([43adc8d](https://github.com/kirana-style/kirana/commit/43adc8d58992422f52131627143597037dd12906))
* **vue:** components take sx with kirana's merge, and workspace sfcs hot-reload ([#105](https://github.com/kirana-style/kirana/pull/105)) ([72a5902](https://github.com/kirana-style/kirana/commit/72a590222ccaf06768decc87f6650cfbfc594256))
* warn on a state nested under select, and on translate beside a logical inset ([#103](https://github.com/kirana-style/kirana/pull/103)) ([8e47376](https://github.com/kirana-style/kirana/commit/8e47376440a56f6eb8c79aab1be6ec868d59dd56))


### Bug fixes

* keep compiled libraries out of every vite environment's pre-bundling ([#95](https://github.com/kirana-style/kirana/pull/95)) ([a6b3f42](https://github.com/kirana-style/kirana/commit/a6b3f425ae55c012d2943c8bf4628f285529e30c))
* report unreadable css() arguments, ship only used keyframes, round line heights up ([#98](https://github.com/kirana-style/kirana/pull/98)) ([061135c](https://github.com/kirana-style/kirana/commit/061135ce642f90600adc6db59b8f587500187879))
* retry npm publishes when the registry fails on its own ([#89](https://github.com/kirana-style/kirana/pull/89)) ([fe22251](https://github.com/kirana-style/kirana/commit/fe2225112530bd828336c69390e240e19fea880c))


### Documentation

* cloudflare workers guide, with an example served cold in ci ([#99](https://github.com/kirana-style/kirana/pull/99)) ([9cf6202](https://github.com/kirana-style/kirana/commit/9cf62023083ca60e0e4c225817b5adfa1724ffe2))
* take the benchmarks of kirana 0.3.1 from kirana-lab ([#93](https://github.com/kirana-style/kirana/pull/93)) ([159548c](https://github.com/kirana-style/kirana/commit/159548c8b729380163b195e6cbe4ec9cbb6d0544))

## [0.3.1](https://github.com/kirana-style/kirana/compare/v0.3.0...v0.3.1) (2026-10-22)


### Features

* exclusive states, and ark ui and react aria vocabularies ([#87](https://github.com/kirana-style/kirana/pull/87)) ([0cfe565](https://github.com/kirana-style/kirana/commit/0cfe565cc736743f88d815d77e6e31cf71097dfd))


### Bug fixes

* publish to npm without dist-tag, and three small fixes ([#86](https://github.com/kirana-style/kirana/pull/86)) ([947066c](https://github.com/kirana-style/kirana/commit/947066c201c4c51db6413a1733eb3166aec7b7df))


### Documentation

* resync the public specification ([#88](https://github.com/kirana-style/kirana/pull/88)) ([9ff3a88](https://github.com/kirana-style/kirana/commit/9ff3a883bbff82793ca0fef1f15b8dc184a5d965))
* take the benchmarks of kirana 0.3.0 from kirana-lab ([#83](https://github.com/kirana-style/kirana/pull/83)) ([a783d4f](https://github.com/kirana-style/kirana/commit/a783d4f9c282ed7bd9c1b7d7af6c492b150e38d2))
* the 0.3.0 post, two compare rows, what the benchmarks include ([#85](https://github.com/kirana-style/kirana/pull/85)) ([022b50f](https://github.com/kirana-style/kirana/commit/022b50f25b6d00616cb70b7d1cba234abe8b2ac3))

## [0.3.0](https://github.com/kirana-style/kirana/compare/v0.2.4...v0.3.0) (2026-10-21)


### ⚠ BREAKING CHANGES

* declare a variable token only where something uses it ([#62](https://github.com/kirana-style/kirana/pull/62))

### Features

* component states as condition keys, and values checked by grammar ([#82](https://github.com/kirana-style/kirana/pull/82)) ([2c034e7](https://github.com/kirana-style/kirana/commit/2c034e7b3c1e51f35a120c5af02934e3f3fa5b4e))
* declare a variable token only where something uses it ([#62](https://github.com/kirana-style/kirana/pull/62)) ([811fbdd](https://github.com/kirana-style/kirana/commit/811fbdd5d1276738306eb1e22cca6b5b3a77c92a))
* remix 3, with sx in compiled jsx ([#80](https://github.com/kirana-style/kirana/pull/80)) ([b6e9d12](https://github.com/kirana-style/kirana/commit/b6e9d1284d23e89e70ca7b82ef5eab2ca2378a74))
* **site:** a partners page, the theme in the footer, a new quick start ([#70](https://github.com/kirana-style/kirana/pull/70)) ([9f5552c](https://github.com/kirana-style/kirana/commit/9f5552c91801350ffe641f7482b1807096fed409))
* **site:** quick start pills, full chart comparisons, updated skills ([#72](https://github.com/kirana-style/kirana/pull/72)) ([abc2363](https://github.com/kirana-style/kirana/commit/abc23638a3e47a2daf8b3af89705bb67544dc879))
* **site:** what ci runs on, and a lighter quick start ([#79](https://github.com/kirana-style/kirana/pull/79)) ([5ef3c51](https://github.com/kirana-style/kirana/commit/5ef3c515b880c40fc4735954105b07ed7f4b3439))
* solidstart, vike, waku, vitepress, docusaurus and storybook ([#78](https://github.com/kirana-style/kirana/pull/78)) ([de928d2](https://github.com/kirana-style/kirana/commit/de928d2bb9438e5a02b529ed5aacc69456b32401))
* **ui:** charts on tanstack charts, with the benchmark and scale-curve charts ([#69](https://github.com/kirana-style/kirana/pull/69)) ([e33de7e](https://github.com/kirana-style/kirana/commit/e33de7e3fcb2d0ebe18c54cc2804a011782d47a1))


### Performance

* keep the stylesheet and project diagnostics until something changes ([#65](https://github.com/kirana-style/kirana/pull/65)) ([91b67fa](https://github.com/kirana-style/kirana/commit/91b67fa77f99e714a2485752291139c54900cfd0))
* order atoms within a conflict key so adjacent keys share rules ([#63](https://github.com/kirana-style/kirana/pull/63)) ([42be523](https://github.com/kirana-style/kirana/commit/42be5231df063e5f9cece88a705808515bc13076))
* **site:** load the homepage's chapters below the hero on their own ([#68](https://github.com/kirana-style/kirana/pull/68)) ([5ccf916](https://github.com/kirana-style/kirana/commit/5ccf916d00cb253616650e7146d5d75d8ffefb3b))
* **site:** no software webgl, repository numbers through the worker ([#67](https://github.com/kirana-style/kirana/pull/67)) ([db11850](https://github.com/kirana-style/kirana/commit/db1185057b9048cb7296082318768f5307a9ed2d))
* **site:** prerender pages, split shared chunks, two new scenes ([#66](https://github.com/kirana-style/kirana/pull/66)) ([8e5160e](https://github.com/kirana-style/kirana/commit/8e5160e271970859dddb844e0290005d3cdd797c))


### Dependencies

* bump the minor-and-patch group across 1 directory with 2 updates ([#75](https://github.com/kirana-style/kirana/pull/75)) ([bccbb0c](https://github.com/kirana-style/kirana/commit/bccbb0c42e50915943e53b8c0dc3fc623ad9d5fa))
* bump the minor-and-patch group with 16 updates ([#76](https://github.com/kirana-style/kirana/pull/76)) ([9f4df94](https://github.com/kirana-style/kirana/commit/9f4df947dda37e45e80231fd36203cc08399e903))
* bump the oxc group in /packages/kirana with 7 updates ([#74](https://github.com/kirana-style/kirana/pull/74)) ([7718a1c](https://github.com/kirana-style/kirana/commit/7718a1cc0acb57d6816146ded78b02853b16c928))
* vite-plus 1.3.0, and a licence check for javascript dependencies ([#77](https://github.com/kirana-style/kirana/pull/77)) ([1ab86c3](https://github.com/kirana-style/kirana/commit/1ab86c33205b58ce714a5e605d7f9f0a3c63a4aa))

## [0.2.4](https://github.com/kirana-style/kirana/compare/v0.2.3...v0.2.4) (2026-10-19)


### Performance

* compile each module once in a one-shot build ([#59](https://github.com/kirana-style/kirana/pull/59)) ([df6d014](https://github.com/kirana-style/kirana/commit/df6d014fae6cd5c85a032056b1322db09427aed3))
* compile modules in parallel in vite and rolldown builds ([#60](https://github.com/kirana-style/kirana/pull/60)) ([e2eb29a](https://github.com/kirana-style/kirana/commit/e2eb29a667bd563cee2e2cf20f51a5e1d46f8c0d))


### Documentation

* take the benchmarks of kirana 0.2.3 from kirana-lab ([#57](https://github.com/kirana-style/kirana/pull/57)) ([ab95357](https://github.com/kirana-style/kirana/commit/ab95357157fda97aad33007277c542118c89f5a9))

## [0.2.3](https://github.com/kirana-style/kirana/compare/v0.2.2...v0.2.3) (2026-10-19)


### Features

* opt-in dense class names for production builds ([#56](https://github.com/kirana-style/kirana/pull/56)) ([8de7aa1](https://github.com/kirana-style/kirana/commit/8de7aa1860a3e2d090d46dd8ef7fd5ba74a03c83))
* **site:** show the lab's scale curve on the benchmarks page ([#53](https://github.com/kirana-style/kirana/pull/53)) ([006313d](https://github.com/kirana-style/kirana/commit/006313d61bc0331059b30cfcf2ea6a31c0772ea2))
* **site:** the large-dom table, a homepage chart and visual habits ([#52](https://github.com/kirana-style/kirana/pull/52)) ([7af6734](https://github.com/kirana-style/kirana/commit/7af6734384f71add75ba12fb506aee11a24aa4d3))


### Bug fixes

* **compiler:** let bundlers drop recipe tables resolved at build time ([#55](https://github.com/kirana-style/kirana/pull/55)) ([1a2eb9b](https://github.com/kirana-style/kirana/commit/1a2eb9bd50c549165cd69fc911b15f3a37f40fc7))
* **release:** publish a package only once npm serves what it depends on ([#50](https://github.com/kirana-style/kirana/pull/50)) ([f52fc50](https://github.com/kirana-style/kirana/commit/f52fc50b5043826efbf87a867b2ef0d1aa9b2cae))


### Performance

* **core:** merge each combination of handles once at runtime ([#54](https://github.com/kirana-style/kirana/pull/54)) ([633486f](https://github.com/kirana-style/kirana/commit/633486f3d212ce2a132ccaac046fecf92516c518))

## [0.2.2](https://github.com/kirana-style/kirana/compare/v0.2.1...v0.2.2) (2026-10-16)


### Features

* **site:** show stylex's swc build beside its babel one ([#44](https://github.com/kirana-style/kirana/pull/44)) ([8d7c870](https://github.com/kirana-style/kirana/commit/8d7c870781c66ae9168774072e75c22772d92c40))


### Bug fixes

* **cli:** let doctor and init see a monorepo's shared setup ([#49](https://github.com/kirana-style/kirana/pull/49)) ([34d4e77](https://github.com/kirana-style/kirana/commit/34d4e774c300d817b591bc77f468fac701a353f3))
* **site:** fill the browser tables and add editors and skills to the ecosystem ([#48](https://github.com/kirana-style/kirana/pull/48)) ([16b83c0](https://github.com/kirana-style/kirana/commit/16b83c0dcf054dda5b2cb1d34e60b7a6c382a431))
* **site:** show only the benchmark targets the site names ([#43](https://github.com/kirana-style/kirana/pull/43)) ([7519e55](https://github.com/kirana-style/kirana/commit/7519e552dd9b65fbd81c2d8524614846e1529d1b))
* **vite:** keep a stylesheet change made while vite is still serving it ([#41](https://github.com/kirana-style/kirana/pull/41)) ([1225bf2](https://github.com/kirana-style/kirana/commit/1225bf28e5f10915626c7c9ed0d3502a9c87cdb9))
* **zed:** find the project's kirana-style through package.json ([#47](https://github.com/kirana-style/kirana/pull/47)) ([5bcbe16](https://github.com/kirana-style/kirana/commit/5bcbe16050fea8f60f5ea538c9b924aa8b3bb966))


### Documentation

* take the benchmarks of kirana 0.2.1 from kirana-lab ([#46](https://github.com/kirana-style/kirana/pull/46)) ([0d8b91b](https://github.com/kirana-style/kirana/commit/0d8b91b99027cd494a68d145a6dd651941aeed23))

## [0.2.1](https://github.com/kirana-style/kirana/compare/v0.2.0...v0.2.1) (2026-10-16)


### Features

* deno in kirana-style init and doctor, and doctor finds kirana-style ([#33](https://github.com/kirana-style/kirana/pull/33)) ([3730d82](https://github.com/kirana-style/kirana/commit/3730d827815164ab32e22f09ad739e0b92502ad3))
* **site:** mobile scenes, release changelog, blog and roadmap redesign ([#34](https://github.com/kirana-style/kirana/pull/34)) ([f9330a8](https://github.com/kirana-style/kirana/commit/f9330a8b8788847609bfcd6b5ea2b795ffbc86f9))
* **site:** read every benchmark number from kirana-lab's runs ([#39](https://github.com/kirana-style/kirana/pull/39)) ([718f253](https://github.com/kirana-style/kirana/commit/718f253dd8ef64d95f3299c2256463458283ec20))


### Bug fixes

* compile the scales preset from node_modules without listing it ([#37](https://github.com/kirana-style/kirana/pull/37)) ([12d8b67](https://github.com/kirana-style/kirana/commit/12d8b67f4fc9359a9534af68ea10f51c0a2a637d))
* let the dev example check look again after the page reloads ([#31](https://github.com/kirana-style/kirana/pull/31)) ([8d21bfd](https://github.com/kirana-style/kirana/commit/8d21bfd39d8b95327f346e1bc38ed2e433be1879))
* pin vitest 4 in the qwik example, inside qwik's peer range ([#36](https://github.com/kirana-style/kirana/pull/36)) ([5317eed](https://github.com/kirana-style/kirana/commit/5317eed4f0293b2befe64bbfda00b18601b3d24b))

## [0.2.0](https://github.com/kirana-style/kirana/compare/v0.1.0...v0.2.0) (2026-10-15)


### ⚠ BREAKING CHANGES

* one command name, kirana-style ([#29](https://github.com/kirana-style/kirana/pull/29))

### Features

* **editor:** real editor output on the site, open vsx trusted publishing ([#21](https://github.com/kirana-style/kirana/pull/21)) ([350fa4e](https://github.com/kirana-style/kirana/commit/350fa4ec0d8054a082d6c7dcdae2b5be53f8d98a))
* one command name, kirana-style ([#29](https://github.com/kirana-style/kirana/pull/29)) ([b3f3154](https://github.com/kirana-style/kirana/commit/b3f3154662589dd1bd43fd0ff2341acf4f3df628))
* **site:** paper, ink, scenery and type for one identity ([#27](https://github.com/kirana-style/kirana/pull/27)) ([5da3c6f](https://github.com/kirana-style/kirana/commit/5da3c6f0f1c8cbfdb450b36a6609a3ab4b20e358))
* **site:** reorganise the homepage, product pages and docs ([#28](https://github.com/kirana-style/kirana/pull/28)) ([88b5209](https://github.com/kirana-style/kirana/commit/88b52093488b2aa0112b458ca04b836c83d03954))
* **site:** scenery gradients, logo downloads, pixel k, glass icons ([#25](https://github.com/kirana-style/kirana/pull/25)) ([2953dc1](https://github.com/kirana-style/kirana/commit/2953dc126f47b68257ebfdb33c61992984708c49))


### Bug fixes

* hold emnapi at 2.0.0-alpha.6, the wasi engine fails on the beta ([#26](https://github.com/kirana-style/kirana/pull/26)) ([8aa33e1](https://github.com/kirana-style/kirana/commit/8aa33e1dbccaefa15b87f6487ac0a346bbf6581a))
* settle the ember dev check, resolve code scanning findings ([#23](https://github.com/kirana-style/kirana/pull/23)) ([0c266c8](https://github.com/kirana-style/kirana/commit/0c266c8428c1453892beeeb5f98918cbc0eae6ff))
* **site:** keep syntax colours in the production build ([#22](https://github.com/kirana-style/kirana/pull/22)) ([621f2fc](https://github.com/kirana-style/kirana/commit/621f2fcf67dada773ca66110e295ab7ac5605f56))


### Documentation

* fix the extension's settings table ([#13](https://github.com/kirana-style/kirana/pull/13)) ([457e06d](https://github.com/kirana-style/kirana/commit/457e06d12f9e3b005e0820aab36faac5bf3f80b3))


### Dependencies

* bump the minor-and-patch group across 1 directory with 3 updates ([#19](https://github.com/kirana-style/kirana/pull/19)) ([7ea00ed](https://github.com/kirana-style/kirana/commit/7ea00edcc5cc02b9ab5e41b13f152ae344ea448f))
* emnapi 2.0.0-beta.1, minor and patch updates ([#24](https://github.com/kirana-style/kirana/pull/24)) ([a399fa7](https://github.com/kirana-style/kirana/commit/a399fa78e53dcfd7f41f249ccee1133809e66544))

## [0.1.0](https://github.com/kirana-style/kirana/compare/v0.1.0...v0.1.0) (2026-10-13)


### Features

* kirana goes public — write objects, read classes, ship css ([79732ed](https://github.com/kirana-style/kirana/commit/79732edd5cab419169ab74ad59e1c70053dfa57d))


### Dependencies

* bump the minor-and-patch group in /packages/kirana with 6 updates ([#10](https://github.com/kirana-style/kirana/pull/10)) ([0deaf9f](https://github.com/kirana-style/kirana/commit/0deaf9f3e75ebc377d764c294250bd2577d53844))
* bump the oxc group in /packages/kirana with 7 updates ([#9](https://github.com/kirana-style/kirana/pull/9)) ([a3ca94c](https://github.com/kirana-style/kirana/commit/a3ca94c170b2ca49c9691abf5ad48c3ef4ac8620))
