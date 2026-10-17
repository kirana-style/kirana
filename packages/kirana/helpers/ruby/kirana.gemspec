# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name = "kirana"
  spec.version = "0.2.3" # x-release-please-version
  spec.summary = "Kirana for Rails templates: the class map reader and the kirana view helper."
  spec.license = "MIT"
  spec.authors = ["The Kirana authors"]
  spec.homepage = "https://kirana.style"
  spec.required_ruby_version = ">= 3.3"
  spec.files = Dir["lib/**/*.rb"] + ["README.md", "LICENSE"]
  spec.require_paths = ["lib"]
  spec.metadata["rubygems_mfa_required"] = "true"
  spec.metadata["source_code_uri"] = "https://github.com/kirana-style/kirana/tree/main/packages/kirana/helpers/ruby"
  spec.metadata["bug_tracker_uri"] = "https://github.com/kirana-style/kirana/issues"
  spec.metadata["changelog_uri"] = "https://github.com/kirana-style/kirana/blob/main/CHANGELOG.md"
end
