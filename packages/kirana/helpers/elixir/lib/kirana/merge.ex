defmodule Kirana.Merge do
  @moduledoc """
  Kirana's class merge, as the private runtime does it (`@kirana-style/core/internal`, D-018), for
  templates that hold class strings from a class map (D-069).

  Kirana class names are `{prefix}{key}_{value}`: merging keeps the last class per key, a
  `{prefix}{key}_` tombstone removes one key, `{prefix}{property}*_` removes every key of a
  property, and `{prefix}{shorthand}/{codes}{scope}_` unfolds a shorthand atom into longhands.
  Classes without the prefix pass through in order. Held to the runtime by
  `fixtures/merge/vectors.json`.

  Entries are kept as `key => {order, class}`: a map with an insertion counter, since the merge
  relies on the order classes were last set in.
  """

  defstruct [:prefix, :four, :two]

  @doc "A merge for `prefix`, with the box family bounds a class map carries."
  def new(prefix, four, two), do: %__MODULE__{prefix: prefix, four: four, two: two}

  @doc "Every class the strings merge to, in merge order, tombstones included."
  def merge(%__MODULE__{} = merge, strings) do
    strings
    |> Enum.flat_map(&String.split(&1, " ", trim: true))
    |> Enum.reduce({%{}, 0}, &add(merge, &1, &2))
    |> elem(0)
    |> ordered()
  end

  @doc "The classes an element receives: the merge without its tombstones."
  def dom(%__MODULE__{} = merge, strings) do
    merge |> merge(strings) |> Enum.reject(&String.ends_with?(&1, "_")) |> Enum.join(" ")
  end

  defp ordered(classes) do
    classes
    |> Enum.sort_by(fn {_, {order, _}} -> order end)
    |> Enum.map(fn {_, {_, token}} -> token end)
  end

  # Setting a key that is already there keeps its place, as a JavaScript `Map` does; a key that
  # must move is deleted first.
  defp put({classes, next}, key, token) do
    case classes do
      %{^key => {order, _}} -> {Map.put(classes, key, {order, token}), next}
      _ -> {Map.put(classes, key, {next, token}), next + 1}
    end
  end

  defp add(merge, token, {classes, next}) do
    case :binary.matches(token, "_") do
      matches when matches != [] ->
        if String.starts_with?(token, merge.prefix),
          do: add_atom(merge, token, elem(List.last(matches), 0), {classes, next}),
          else: put({classes, next}, " " <> token, token)

      [] ->
        put({classes, next}, " " <> token, token)
    end
  end

  defp add_atom(merge, token, finish, state) do
    prefix = byte_size(merge.prefix)
    key = binary_part(token, prefix, finish - prefix)
    [head | _] = String.split(key, "-")
    state = if byte_size(head) < 3, do: remove_longhands(merge, state, key, head), else: state

    state =
      case :binary.match(key, "/") do
        {slash, _} when slash > 0 ->
          unfold(merge, state, key, slash)

        _ ->
          if String.ends_with?(key, "*"), do: remove_property(state, key), else: state
      end

    {classes, next} = state
    put({Map.delete(classes, key), next}, key, token)
  end

  # A box family atom (or its tombstone) replaces its longhands, whose codes follow its own (D-045).
  defp remove_longhands(merge, {classes, next}, key, head) do
    index =
      head
      |> String.to_charlist()
      |> Enum.reduce(0, fn unit, sum ->
        sum * 62 + unit -
          cond do
            unit > 96 -> 87
            unit > 64 -> 29
            true -> 48
          end
      end)

    size =
      cond do
        index < merge.four -> if rem(index, 5) == 0, do: 4, else: 0
        index < merge.two and rem(index - merge.four, 3) == 0 -> 2
        true -> 0
      end

    rest = binary_part(key, byte_size(head), byte_size(key) - byte_size(head))
    classes = Enum.reduce(size..1//-1, classes, &Map.delete(&2, code(index + &1) <> rest))
    {classes, next}
  end

  # `{shorthand}/{kept codes}{target}{-conditions | *}`: replace earlier shorthand atoms by atoms of
  # the kept longhands in their place, reusing each atom's value (D-045).
  defp unfold(merge, {earlier, next}, key, slash) do
    every = String.ends_with?(key, "*")
    tail = binary_part(key, slash + 1, byte_size(key) - slash - 1 - if(every, do: 1, else: 0))

    {codes, scope} =
      case :binary.match(tail, "-") do
        {dash, _} -> {binary_part(tail, 0, dash), binary_part(tail, dash, byte_size(tail) - dash)}
        :nomatch -> {tail, ""}
      end

    shorthand = binary_part(key, 0, slash)

    earlier
    |> Enum.sort_by(fn {_, {order, _}} -> order end)
    |> Enum.reduce({%{}, next}, fn {existing, {_, atom}}, state ->
      if not String.ends_with?(atom, "_") and scoped?(existing, shorthand <> scope, every) do
        rest =
          binary_part(existing, byte_size(shorthand), byte_size(existing) - byte_size(shorthand))

        value = binary_part(atom, last_underscore(atom), byte_size(atom) - last_underscore(atom))

        codes
        |> String.split(".")
        |> Enum.reduce(state, fn kept, {classes, next} ->
          kept = kept <> rest
          # A longhand entry after the atom (not copied yet) was written after it and keeps its
          # value; one before it is the atom's own tombstone or an earlier, broader atom's value.
          if Map.has_key?(classes, kept) or not Map.has_key?(earlier, kept),
            do: put({Map.delete(classes, kept), next}, kept, merge.prefix <> kept <> value),
            else: {classes, next}
        end)
      else
        put(state, existing, atom)
      end
    end)
  end

  # A target's own `-xyz*` tombstone has the length of a condition key and must survive.
  defp remove_property({classes, next}, key) do
    base = binary_part(key, 0, byte_size(key) - 1)

    classes =
      Map.reject(classes, fn {existing, _} ->
        scoped?(existing, base, true) and not String.ends_with?(existing, "*")
      end)

    {classes, next}
  end

  defp last_underscore(atom), do: elem(List.last(:binary.matches(atom, "_")), 0)

  # `key` is `base`, or — for every condition set — `base` plus `-` and a 4-character hash.
  defp scoped?(key, base, every) do
    key == base or
      (every and String.starts_with?(key, base <> "-") and byte_size(key) == byte_size(base) + 5)
  end

  # A base-62 property code (`0-9a-zA-Z`) for an index, as class names spell them (D-037).
  defp code(index) do
    prefix = if index > 61, do: code(div(index, 62)), else: ""
    index = rem(index, 62)

    unit =
      cond do
        index < 10 -> index + 48
        index < 36 -> index + 87
        true -> index + 29
      end

    prefix <> <<unit>>
  end
end
