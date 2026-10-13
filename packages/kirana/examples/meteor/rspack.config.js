const { defineConfig } = require("@meteorjs/rspack")
const { KiranaPlugin } = require("@kirana-style/rspack")

// Meteor bundles app code with Rspack; Kirana's plugin goes in its configuration.
module.exports = defineConfig(() => ({ plugins: [new KiranaPlugin()] }))
