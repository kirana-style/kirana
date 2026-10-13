# frozen_string_literal: true

require_relative "kirana/merge"
require_relative "kirana/class_map"

module Kirana
  # Loads the Railtie when Rails is present; without it the gem is the class map alone.
  def self.integrate(rails = defined?(::Rails::Railtie))
    require_relative "kirana/railtie" if rails
  end
end

Kirana.integrate
