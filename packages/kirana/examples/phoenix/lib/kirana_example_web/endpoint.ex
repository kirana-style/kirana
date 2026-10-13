defmodule KiranaExampleWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :kirana_example

  # `kirana build` and `kirana dev` write the stylesheet to `priv/static/kirana`.
  plug Plug.Static, at: "/", from: :kirana_example, only: ~w(kirana)
  plug KiranaExampleWeb.Router
end
