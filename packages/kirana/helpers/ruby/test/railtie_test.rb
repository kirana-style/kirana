# frozen_string_literal: true

require_relative "test_helper"

class RailtieTest < Minitest::Test
  def test_the_view_helper_in_a_rails_app
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, "classes.json"), JSON.generate(MAP))
      app = Class.new(Rails::Application) do
        config.root = dir
        config.eager_load = false
        config.logger = Logger.new(nil)
        config.secret_key_base = "test"
        config.kirana.classes = File.join(dir, "classes.json")
      end
      app.initialize!
      html = ApplicationController.render(inline: %(<div class="<%= kirana :card, "card.active" %>"></div>))
      assert_equal %(<div class="k1x_bbbb k3_cccc"></div>), html
      # Without a setting, the class map is in `public/kirana`.
      app.config.kirana.classes = nil
      Kirana::Railtie.initializers.find { |initializer| initializer.name == "kirana.helper" }.run(app)
      assert_equal File.join(dir, "public/kirana/classes.json"), Kirana.classes_path
    ensure
      Kirana.classes_path = nil
    end
  end
end

class ApplicationController < ActionController::Base; end
