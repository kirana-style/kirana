// Vite's asset URLs, for the brand logos (`brands/*.svg?url`, and a brand's own `*.png?url`).
declare module "*.svg?url" {
  const url: string
  export default url
}

declare module "*.png?url" {
  const url: string
  export default url
}
