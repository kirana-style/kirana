// Vite's asset URLs, for the brand logos (`brands/*.svg?url`).
declare module "*.svg?url" {
  const url: string
  export default url
}
