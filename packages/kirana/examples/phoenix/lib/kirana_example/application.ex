defmodule KiranaExample.Application do
  use Application

  @impl true
  def start(_type, _args) do
    Supervisor.start_link([KiranaExampleWeb.Endpoint],
      strategy: :one_for_one,
      name: KiranaExample.Supervisor
    )
  end
end
