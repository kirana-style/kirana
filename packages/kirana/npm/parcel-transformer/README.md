# @kirana-style/parcel-transformer

Kirana for Parcel (D-070): a transformer that compiles styles in scripts. The stylesheet comes from
`@kirana-style/postcss`, where a stylesheet says `@kirana;`.

```json
// .parcelrc
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.{js,mjs,jsx,ts,tsx}": ["@kirana-style/parcel-transformer", "..."]
  }
}
```

```json
// .postcssrc
{ "plugins": { "@kirana-style/postcss": {} } }
```
