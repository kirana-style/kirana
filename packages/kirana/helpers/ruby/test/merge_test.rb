# frozen_string_literal: true

require_relative "test_helper"

# KRN-TEST-003: the merge here matches the build-time merge, as the JavaScript runtime does.
class MergeTest < Minitest::Test
  VECTORS = JSON.parse(File.read(File.expand_path("../../../fixtures/merge/vectors.json", __dir__)))

  def test_matches_the_build_time_merge
    merge = Kirana::Merge.new("k", 45, 111)
    atoms = ->(tokens) { tokens.select { |token| token.include?("_") } }
    VECTORS.each_with_index do |vector, index|
      merged = merge.merge(vector["inputs"])
      assert_equal vector["atoms"], atoms.(merged), "vector #{index}"
      assert_equal vector["markers"], merged.reject { |token| token.include?("_") }, "vector #{index}"
      assert_equal vector["dom"], atoms.(merge.dom(vector["inputs"]).split(" ")), "vector #{index}"
    end
    assert_operator VECTORS.size, :>, 200
  end

  # The vectors' properties have short codes; these, from the runtime, reach a box family whose
  # longhands' codes need two characters and both letter cases.
  def test_box_families_with_long_codes
    merge = Kirana::Merge.new("k", 45, 111)
    assert_equal "k3_dddd kE_aaaa", merge.dom(["kI_bbbb kF_cccc k3_dddd", "kE_aaaa"])
    assert_equal "k1j_z", merge.dom(["k1k_x k1l_y", "k1j_z"])
    assert_equal "", merge.dom(["k1k_x", "k1j_"])
    assert_equal "k1y_x k1x_z", merge.dom(["k1y_x", "k1x_z"])
  end

  def test_keeps_foreign_classes_once_and_in_order
    merge = Kirana::Merge.new("app", 45, 111)
    assert_equal "card k3_bbbb app3_aaaa", merge.dom(["card k3_bbbb app3_cccc", "card app3_aaaa"])
    assert_equal "", merge.dom(["app_"])
  end
end
