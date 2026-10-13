import EmberApp from "ember-cli/lib/broccoli/ember-app.js"
import { compatBuild } from "@embroider/compat"

export default async function (defaults) {
  const { buildOnce } = await import("@embroider/vite")
  return compatBuild(new EmberApp(defaults, {}), buildOnce)
}
