defmodule KiranaExampleWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def home(conn, _params), do: render(conn, :home, layout: false)
end
