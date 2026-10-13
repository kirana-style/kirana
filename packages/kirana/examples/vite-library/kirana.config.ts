import { defineConfig } from "@kirana-style/core/config"

// `acme-ui` is installed from npm with its styles uncompiled; this app compiles them with its own.
export default defineConfig({ libraries: ["acme-ui"] })
