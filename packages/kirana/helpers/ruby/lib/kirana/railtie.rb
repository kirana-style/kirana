# frozen_string_literal: true

require "rails/railtie"

module Kirana
  # Rails: the `kirana` view helper in every view, and `config.kirana.classes` for where the class
  # map is (default `public/kirana/classes.json`).
  class Railtie < ::Rails::Railtie
    config.kirana = ActiveSupport::OrderedOptions.new

    initializer "kirana.helper" do |app|
      Kirana.classes_path = (app.config.kirana.classes || app.root.join("public/kirana/classes.json")).to_s
      ActiveSupport.on_load(:action_view) { include Kirana::Helper }
    end
  end
end
