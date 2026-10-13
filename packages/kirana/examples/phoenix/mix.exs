defmodule KiranaExample.MixProject do
  use Mix.Project

  def project do
    [
      app: :kirana_example,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [mod: {KiranaExample.Application, []}, extra_applications: [:logger]]
  end

  defp deps do
    [
      {:phoenix, "~> 1.8.15"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_live_view, "~> 1.2.0"},
      {:jason, "~> 1.2"},
      {:bandit, "~> 1.5"},
      # Kirana's template helper, from this repository until it is published.
      {:kirana, path: "{kirana}/helpers/elixir"}
    ]
  end
end
