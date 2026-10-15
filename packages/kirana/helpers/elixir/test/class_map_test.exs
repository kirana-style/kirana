defmodule Kirana.ClassMapTest do
  use ExUnit.Case

  alias Kirana.ClassMap

  test "merges named handles, later winning" do
    map = ClassMap.new(Kirana.Fixtures.map())
    assert ClassMap.classes(map, [:card, "card.active"]) == "k1x_bbbb k3_cccc"
    assert ClassMap.classes(map, ["card", nil, false, ""]) == "k3_aaaa k1x_bbbb"
    assert ClassMap.classes(map, ["card", "quiet"]) == "k1x_bbbb"
    assert ClassMap.classes(map, "card.active") == "k3_cccc"
    assert ClassMap.classes(map, []) == ""
    assert ClassMap.has?(map, :card)
    refute ClassMap.has?(map, "button")
  end

  test "unknown names fail loudly" do
    assert_raise ClassMap.UnknownStyleError,
                 ~s(kirana: no style named "button" in the class map),
                 fn ->
                   ClassMap.classes(ClassMap.new(Kirana.Fixtures.map()), ["button"])
                 end
  end

  test "another version is rejected, and an empty map has defaults" do
    assert_raise ArgumentError, fn -> ClassMap.new(%{"version" => 2}) end
    assert ClassMap.classes(ClassMap.new(%{"version" => 1}), []) == ""
  end

  test "kirana/1 reads the configured file, and again when it changes" do
    dir = Path.join(System.tmp_dir!(), "kirana-#{System.unique_integer([:positive])}")
    File.mkdir_p!(dir)
    path = Path.join(dir, "classes.json")
    Application.put_env(:kirana, :classes, path)

    assert_raise File.Error, ~r/run `kirana-style dev` or `kirana-style build` first/, fn ->
      Kirana.kirana(["card"])
    end

    File.write!(path, JSON.encode!(Kirana.Fixtures.map()))
    assert Kirana.kirana(["card", "card.active"]) == "k1x_bbbb k3_cccc"
    assert Kirana.class_map() === Kirana.class_map()

    File.write!(path, JSON.encode!(put_in(Kirana.Fixtures.map(), ["classes", "card"], "k3_dddd")))
    File.touch!(path, System.os_time(:second) + 5)
    assert Kirana.kirana(["card"]) == "k3_dddd"
  after
    Application.delete_env(:kirana, :classes)
  end

  test "the default location" do
    assert Kirana.path() == "priv/static/kirana/classes.json"
  end
end
