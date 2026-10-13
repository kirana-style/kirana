# frozen_string_literal: true

module Kirana
  # Kirana's class merge, as the private runtime does it (`@kirana-style/core/internal`, D-018), for
  # templates that hold class strings from a class map (D-069).
  #
  # Kirana class names are `{prefix}{key}_{value}`: merging keeps the last class per key, a
  # `{prefix}{key}_` tombstone removes one key, `{prefix}{property}*_` removes every key of a
  # property, and `{prefix}{shorthand}/{codes}{scope}_` unfolds a shorthand atom into longhands.
  # Classes without the prefix pass through in order. Held to the runtime by
  # `fixtures/merge/vectors.json`.
  class Merge
    # `four`: property codes below it are four-longhand box families; `two`: codes from `four` below
    # it are two-longhand families.
    def initialize(prefix, four, two)
      @prefix = prefix
      @four = four
      @two = two
    end

    # Every class the strings merge to, in merge order, tombstones included.
    def merge(strings)
      classes = {}
      strings.each do |string|
        string.split(" ").each { |token| classes = add(classes, token) }
      end
      classes.values
    end

    # The classes an element receives: the merge without its tombstones.
    def dom(strings)
      merge(strings).reject { |token| token.end_with?("_") }.join(" ")
    end

    private

    def add(classes, token)
      finish = token.rindex("_")
      unless token.start_with?(@prefix) && finish
        classes[" #{token}"] = token
        return classes
      end
      key = token[@prefix.length...finish]
      head = key.split("-", 2).first.to_s
      remove_longhands(classes, key, head) if head.length < 3
      slash = key.index("/")
      if slash&.positive?
        classes = unfold(classes, key, slash)
      elsif key.end_with?("*")
        # A target's own `-xyz*` tombstone has the length of a condition key and must survive.
        base = key[0...-1]
        classes.delete_if { |existing, _| scoped?(existing, base, true) && !existing.end_with?("*") }
      end
      classes.delete(key)
      classes[key] = token
      classes
    end

    # A box family atom (or its tombstone) replaces its longhands, whose codes follow its own (D-045).
    def remove_longhands(classes, key, head)
      index = head.each_char.reduce(0) do |sum, digit|
        unit = digit.ord
        (sum * 62) + unit - (if unit > 96 then 87 elsif unit > 64 then 29 else 48 end)
      end
      size = if index < @four
        (index % 5).zero? ? 4 : 0
      else
        index < @two && ((index - @four) % 3).zero? ? 2 : 0
      end
      rest = key[head.length..]
      size.downto(1) { |offset| classes.delete(code(index + offset) + rest) }
    end

    # `{shorthand}/{kept codes}{target}{-conditions | *}`: replace earlier shorthand atoms by atoms of
    # the kept longhands in their place, reusing each atom's value (D-045).
    def unfold(earlier, key, slash)
      every = key.end_with?("*")
      tail = every ? key[(slash + 1)...-1] : key[(slash + 1)..]
      dash = tail.index("-")
      codes = dash ? tail[0...dash] : tail
      scope = dash ? tail[dash..] : ""
      shorthand = key[0...slash]
      classes = {}
      earlier.each do |existing, atom|
        if !atom.end_with?("_") && scoped?(existing, shorthand + scope, every)
          rest = existing[shorthand.length..]
          codes.split(".").each do |kept|
            kept += rest
            # A longhand entry after the atom (not copied yet) was written after it and keeps its
            # value; one before it is the atom's own tombstone or an earlier, broader atom's value.
            deleted = classes.key?(kept)
            classes.delete(kept)
            classes[kept] = @prefix + kept + atom[atom.rindex("_")..] if deleted || !earlier.key?(kept)
          end
        else
          classes[existing] = atom
        end
      end
      classes
    end

    # `key` is `base`, or — for every condition set — `base` plus `-` and a 4-character hash.
    def scoped?(key, base, every)
      key == base || (every && key.start_with?("#{base}-") && key.length == base.length + 5)
    end

    # A base-62 property code (`0-9a-zA-Z`) for an index, as class names spell them (D-037).
    def code(index)
      prefix = index > 61 ? code(index / 62) : ""
      index %= 62
      prefix + (if index < 10 then index + 48 elsif index < 36 then index + 87 else index + 29 end).chr
    end
  end
end
