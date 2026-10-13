import Config

config :kirana_example, KiranaExampleWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  http: [ip: {127, 0, 0, 1}],
  server: true,
  secret_key_base: String.duplicate("kirana-example-not-a-secret-", 3),
  render_errors: [formats: [html: KiranaExampleWeb.ErrorHTML], layout: false]

# The class map `kirana build` and `kirana dev` write (the default, spelled out).
config :kirana, classes: "priv/static/kirana/classes.json"

config :phoenix, :json_library, Jason
