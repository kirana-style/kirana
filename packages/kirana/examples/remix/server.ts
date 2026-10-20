import * as http from "node:http"
import { createRequestListener } from "remix/node-fetch-server"

import { router } from "./app/router.ts"

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const server = http.createServer(createRequestListener(router.fetch))
server.listen(port, "127.0.0.1", () => {
  console.log(`Server listening on http://127.0.0.1:${port}`)
})

process.on("SIGTERM", () => {
  server.close(() => process.exit(0))
  server.closeAllConnections()
})
