require "rails"
require "action_controller/railtie"
require "action_view/railtie"

require "bundler/setup"
Bundler.require(*Rails.groups)

module KiranaExample
  class Application < Rails::Application
    config.load_defaults 8.1
    config.eager_load = false
    config.secret_key_base = "kirana-example-not-a-secret"
    config.hosts.clear
    config.logger = Logger.new($stdout)
    # The class map `kirana-style build` and `kirana-style dev` write (the default, spelled out).
    config.kirana.classes = Rails.root.join("public/kirana/classes.json")
  end
end
