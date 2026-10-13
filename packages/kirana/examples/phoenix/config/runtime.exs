import Config

config :kirana_example, KiranaExampleWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]
