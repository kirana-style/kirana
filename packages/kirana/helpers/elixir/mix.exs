defmodule Kirana.MixProject do
  use Mix.Project

  def project do
    [
      app: :kirana,
      version: "0.1.0", # x-release-please-version
      elixir: "~> 1.18",
      description: "Kirana for Phoenix templates: the class map reader and the kirana/1 helper.",
      package: [
        licenses: ["MIT"],
        links: %{
          "Website" => "https://kirana.style",
          "Source" => "https://github.com/kirana-style/kirana"
        }
      ],
      source_url: "https://github.com/kirana-style/kirana",
      homepage_url: "https://kirana.style",
      # ex_doc builds the documentation Hex publishes with the package; development only, so it
      # never becomes a dependency of an application that installs kirana.
      deps: [{:ex_doc, "~> 0.40", only: :dev, runtime: false}],
      docs: [main: "readme", extras: ["README.md"]],
      test_coverage: [summary: [threshold: 100]]
    ]
  end

  def application, do: []
end
