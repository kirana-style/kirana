import { Env } from "@adonisjs/core/env"

export default await Env.create(new URL("../", import.meta.url), {
  NODE_ENV: Env.schema.enum(["development", "production", "test"] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: "host" }),
  APP_URL: Env.schema.string({ format: "url", tld: false }),
  APP_NAME: Env.schema.string.optional(),
  APP_KEY: Env.schema.secret(),
  LOG_LEVEL: Env.schema.string(),
})
