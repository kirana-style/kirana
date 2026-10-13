defmodule Kirana do
  @moduledoc """
  Kirana for Phoenix templates (D-069). Import `kirana/1` in your app's `html_helpers`:

      import Kirana, only: [kirana: 1]

  and name the handles your style modules export:

      <div class={kirana(["card", @active && "card.active"])}>

  The class map is read from `config :kirana, classes: "priv/static/kirana/classes.json"` (the
  default), and read again whenever `kirana dev` rewrites it.
  """

  @doc "The merged classes of the named handles, from the configured class map."
  def kirana(names), do: Kirana.ClassMap.classes(class_map(), names)

  @doc "Where the class map is: `config :kirana, :classes`."
  def path, do: Application.get_env(:kirana, :classes, "priv/static/kirana/classes.json")

  @doc "The class map at `path`, read again when the file changes."
  def class_map(path \\ path()) do
    stamp =
      case File.stat(path, time: :posix) do
        {:ok, stat} -> {stat.mtime, stat.size}
        {:error, _} -> nil
      end

    case :persistent_term.get({__MODULE__, path}, nil) do
      {^stamp, map} when stamp != nil ->
        map

      _ ->
        map = Kirana.ClassMap.from_file(path)
        :persistent_term.put({__MODULE__, path}, {stamp, map})
        map
    end
  end
end
