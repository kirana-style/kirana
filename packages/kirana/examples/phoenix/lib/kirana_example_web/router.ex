defmodule KiranaExampleWeb.Router do
  use Phoenix.Router, helpers: false

  pipeline :browser do
    plug :accepts, ["html"]
  end

  scope "/", KiranaExampleWeb do
    pipe_through :browser
    get "/", PageController, :home
  end
end
