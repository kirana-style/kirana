defmodule Kirana.ClassMap do
  @moduledoc """
  A class map (D-069): the class string of every handle a server app's style modules export, by
  name, as `kirana-style build` and `kirana-style dev` write it. `classes/2` merges named handles the way `sx`
  merges them, later ones winning.
  """

  defstruct [:classes, :merge]

  defmodule UnknownStyleError do
    defexception [:message]
  end

  @doc "A class map from its decoded JSON."
  def new(%{"version" => 1} = map) do
    families = Map.get(map, "families", %{})

    %__MODULE__{
      classes: Map.get(map, "classes", %{}),
      merge:
        Kirana.Merge.new(
          Map.get(map, "prefix", "k"),
          Map.get(families, "four", 0),
          Map.get(families, "two", 0)
        )
    }
  end

  def new(_map) do
    raise ArgumentError,
          "kirana: this class map was written by another version of Kirana; rebuild it"
  end

  @doc "Reads the class map `kirana-style build` or `kirana-style dev` wrote."
  def from_file(path) do
    case File.read(path) do
      {:ok, text} ->
        text |> JSON.decode!() |> new()

      {:error, _} ->
        raise File.Error,
          reason: :enoent,
          action: "read the class map (run `kirana-style dev` or `kirana-style build` first)",
          path: path
    end
  end

  @doc """
  The classes of the named handles, merged: `classes(map, ["card", @active && "card.active"])`.
  Falsy names are skipped, so a condition can leave one out.
  """
  def classes(%__MODULE__{} = map, names) do
    strings =
      for name <- List.wrap(names), name not in [nil, false, ""] do
        Map.get(map.classes, to_string(name)) ||
          raise UnknownStyleError, "kirana: no style named \"#{name}\" in the class map"
      end

    Kirana.Merge.dom(map.merge, strings)
  end

  @doc "Whether the map has a handle by this name."
  def has?(%__MODULE__{} = map, name), do: Map.has_key?(map.classes, to_string(name))
end
