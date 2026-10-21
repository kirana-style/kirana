/**
 * `node --import remix/node-tsx --import @kirana-style/remix/node server.ts`: Kirana's `load` hook,
 * registered after `node-tsx`'s, so Node runs it first and it compiles what `node-tsx` returns.
 */
import { registerHooks } from "node:module"

import { kiranaLoader } from "./index.ts"

registerHooks({ load: kiranaLoader })
