# frozen_string_literal: true

require "simplecov"
SimpleCov.start do
  enable_coverage :branch
  minimum_coverage line: 100, branch: 100
  skip "/test/"
end

# Rails first, so `kirana` loads its Railtie.
require "rails"
require "action_controller/railtie"
require "kirana"
require "minitest/autorun"
require "tmpdir"

MAP = {
  "version" => 1,
  "prefix" => "k",
  "families" => { "four" => 45, "two" => 111 },
  "classes" => { "card" => "k3_aaaa k1x_bbbb", "card.active" => "k3_cccc", "quiet" => "k3_" }
}.freeze
