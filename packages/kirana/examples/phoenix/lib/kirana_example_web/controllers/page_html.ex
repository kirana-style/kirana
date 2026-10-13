defmodule KiranaExampleWeb.PageHTML do
  use Phoenix.Component
  import Kirana, only: [kirana: 1]

  embed_templates "page_html/*"
end
