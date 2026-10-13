# frozen_string_literal: true

require_relative "test_helper"

class ClassMapTest < Minitest::Test
  def test_merges_named_handles_later_winning
    map = Kirana::ClassMap.new(MAP)
    assert_equal "k1x_bbbb k3_cccc", map.classes(:card, "card.active")
    assert_equal "k3_aaaa k1x_bbbb", map.classes(:card, nil, false, "")
    assert_equal "k1x_bbbb", map.classes(:card, :quiet)
    assert_equal "", map.classes
    assert map.key?("card.active")
    refute map.key?(:button)
  end

  def test_unknown_names_fail_loudly
    error = assert_raises(Kirana::ClassMap::UnknownStyle) { Kirana::ClassMap.new(MAP).classes(:button) }
    assert_equal 'kirana: no style named "button" in the class map', error.message
  end

  def test_without_rails_the_gem_is_the_class_map
    assert_nil Kirana.integrate(nil)
  end

  def test_another_version_is_rejected
    assert_raises(ArgumentError) { Kirana::ClassMap.new("version" => 2) }
    assert_equal "", Kirana::ClassMap.new("version" => 1).classes
  end

  def test_reads_the_file_and_reloads_it_when_it_changes
    Dir.mktmpdir do |dir|
      path = File.join(dir, "classes.json")
      Kirana.classes_path = path
      error = assert_raises(Errno::ENOENT) { Kirana.class_map }
      assert_includes error.message, "run `kirana dev` or `kirana build` first"
      File.write(path, JSON.generate(MAP))
      first = Kirana.class_map
      assert_same first, Kirana.class_map
      File.write(path, JSON.generate(MAP.merge("classes" => { "card" => "k3_dddd" })))
      File.utime(Time.now + 5, Time.now + 5, path)
      assert_equal "k3_dddd", Kirana.class_map.classes(:card)
    ensure
      Kirana.classes_path = nil
    end
    assert_equal "public/kirana/classes.json", Kirana.classes_path
  end
end
