defmodule Kirana.MergeTest do
  use ExUnit.Case, async: true

  alias Kirana.Merge

  @vectors "../../../fixtures/merge/vectors.json"
           |> Path.expand(__DIR__)
           |> File.read!()
           |> JSON.decode!()

  # KRN-TEST-003: the merge here matches the build-time merge, as the JavaScript runtime does.
  test "matches the build-time merge" do
    merge = Merge.new("k", 45, 111)
    atoms = &Enum.filter(&1, fn token -> String.contains?(token, "_") end)
    assert length(@vectors) > 200

    for {vector, index} <- Enum.with_index(@vectors) do
      merged = Merge.merge(merge, vector["inputs"])
      assert atoms.(merged) == vector["atoms"], "vector #{index}"
      assert Enum.reject(merged, &String.contains?(&1, "_")) == vector["markers"], "vector #{index}"
      dom = merge |> Merge.dom(vector["inputs"]) |> String.split(" ", trim: true)
      assert atoms.(dom) == vector["dom"], "vector #{index}"
    end
  end

  # The vectors' properties have short codes; these, from the runtime, reach a box family whose
  # longhands' codes need two characters and both letter cases.
  test "box families with long codes" do
    merge = Merge.new("k", 45, 111)
    assert Merge.dom(merge, ["kI_bbbb kF_cccc k3_dddd", "kE_aaaa"]) == "k3_dddd kE_aaaa"
    assert Merge.dom(merge, ["k1k_x k1l_y", "k1j_z"]) == "k1j_z"
    assert Merge.dom(merge, ["k1k_x", "k1j_"]) == ""
    assert Merge.dom(merge, ["k1y_x", "k1x_z"]) == "k1y_x k1x_z"
  end

  test "keeps foreign classes once and in order" do
    merge = Merge.new("app", 45, 111)

    assert Merge.dom(merge, ["card k3_bbbb app3_cccc", "card app3_aaaa"]) ==
             "card k3_bbbb app3_aaaa"
  end
end
