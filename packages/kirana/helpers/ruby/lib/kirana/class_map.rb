# frozen_string_literal: true

require "json"

module Kirana
  # A class map (D-069): the class string of every handle a server app's style modules export, by
  # name, as `kirana build` and `kirana dev` write it. `classes` merges named handles the way `sx`
  # merges them, later ones winning.
  class ClassMap
    # A name the class map does not list.
    class UnknownStyle < KeyError; end

    def initialize(map)
      raise ArgumentError, "kirana: this class map was written by another version of Kirana; rebuild it" unless map["version"] == 1

      @classes = map.fetch("classes", {})
      families = map.fetch("families", {})
      @merge = Merge.new(map.fetch("prefix", "k"), families.fetch("four", 0), families.fetch("two", 0))
    end

    # Reads the class map `kirana build` or `kirana dev` wrote.
    def self.from_file(path)
      raise Errno::ENOENT, "kirana: no class map at #{path}; run `kirana dev` or `kirana build` first" unless File.file?(path)

      new(JSON.parse(File.read(path)))
    end

    # The classes of the named handles, merged: `classes(:card, active && "card.active")`. Falsy names
    # are skipped, so a condition can leave one out.
    def classes(*names)
      strings = names.reject { |name| !name || name.to_s.empty? }.map do |name|
        @classes.fetch(name.to_s) { raise UnknownStyle, "kirana: no style named \"#{name}\" in the class map" }
      end
      @merge.dom(strings)
    end

    # Whether the map has a handle by this name.
    def key?(name)
      @classes.key?(name.to_s)
    end
  end

  class << self
    # Where the class map is: set by the Railtie from `config.kirana.classes`.
    attr_writer :classes_path

    def classes_path
      @classes_path || "public/kirana/classes.json"
    end

    # The class map at `classes_path`, read again when the file changes (`kirana dev` rewrites it).
    def class_map
      stamp = File.file?(classes_path) && File.mtime(classes_path)
      @class_map = nil unless @stamp == stamp && @path == classes_path
      @stamp = stamp
      @path = classes_path
      @class_map ||= ClassMap.from_file(classes_path)
    end
  end

  # The view helper: `<div class="<%= kirana :card, active && "card.active" %>">`.
  module Helper
    def kirana(*names)
      Kirana.class_map.classes(*names)
    end
  end
end
