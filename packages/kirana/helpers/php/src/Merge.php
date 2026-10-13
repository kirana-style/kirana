<?php

declare(strict_types=1);

namespace Kirana;

/**
 * Kirana's class merge, as the private runtime does it (`@kirana-style/core/internal`, D-018), for
 * templates that hold class strings from a class map (D-069).
 *
 * Kirana class names are `{prefix}{key}_{value}`: merging keeps the last class per key, a
 * `{prefix}{key}_` tombstone removes one key, `{prefix}{property}*_` removes every key of a
 * property, and `{prefix}{shorthand}/{codes}{scope}_` unfolds a shorthand atom into longhands.
 * Classes without the prefix pass through in order. Held to the runtime by
 * `fixtures/merge/vectors.json`.
 */
final class Merge
{
    /**
     * @param string $prefix The class-name prefix (`names.prefix`).
     * @param int $four Property codes below this are four-longhand box families.
     * @param int $two Codes from `$four` below this are two-longhand families.
     */
    public function __construct(
        private readonly string $prefix,
        private readonly int $four,
        private readonly int $two,
    ) {
    }

    /**
     * Every class the strings merge to, in merge order, tombstones included.
     *
     * @param list<string> $strings
     * @return list<string>
     */
    public function merge(array $strings): array
    {
        // Keys carry a `#`, so PHP never turns a numeric one (`4`) into an integer.
        $classes = [];
        foreach ($strings as $string) {
            foreach (explode(' ', $string) as $token) {
                if ($token !== '') {
                    $classes = $this->add($classes, $token);
                }
            }
        }
        return array_values($classes);
    }

    /**
     * The classes an element receives: the merge without its tombstones.
     *
     * @param list<string> $strings
     */
    public function dom(array $strings): string
    {
        $kept = array_filter($this->merge($strings), static fn (string $token) => !str_ends_with($token, '_'));
        return implode(' ', $kept);
    }

    /**
     * @param array<string, string> $classes
     * @return array<string, string>
     */
    private function add(array $classes, string $token): array
    {
        $end = strrpos($token, '_');
        if (!str_starts_with($token, $this->prefix) || $end === false) {
            $classes['# ' . $token] = $token;
            return $classes;
        }
        $key = substr($token, strlen($this->prefix), $end - strlen($this->prefix));
        $head = explode('-', $key)[0];
        if (strlen($head) < 3) {
            // A box family atom (or its tombstone) replaces its longhands, whose codes follow its
            // own (D-045).
            $index = 0;
            foreach (str_split($head) as $digit) {
                $unit = ord($digit);
                $index = $index * 62 + $unit - ($unit > 96 ? 87 : ($unit > 64 ? 29 : 48));
            }
            $size = $index < $this->four
                ? ($index % 5 !== 0 ? 0 : 4)
                : ($index < $this->two && ($index - $this->four) % 3 === 0 ? 2 : 0);
            $rest = substr($key, strlen($head));
            while ($size > 0) {
                unset($classes['#' . self::code($index + $size) . $rest]);
                $size--;
            }
        }
        $slash = strpos($key, '/');
        if ($slash !== false && $slash > 0) {
            // `{shorthand}/{kept codes}{target}{-conditions | *}`: replace earlier shorthand atoms by
            // atoms of the kept longhands in their place, reusing each atom's value (D-045).
            $every = str_ends_with($key, '*');
            $tail = substr($key, $slash + 1, $every ? -1 : null);
            $dash = strpos($tail, '-');
            $codes = $dash === false ? $tail : substr($tail, 0, $dash);
            $scope = $dash === false ? '' : substr($tail, $dash);
            $shorthand = substr($key, 0, $slash);
            $earlier = $classes;
            $classes = [];
            foreach ($earlier as $existing => $atom) {
                $existing = substr($existing, 1);
                if (!str_ends_with($atom, '_') && self::scoped($existing, $shorthand . $scope, $every)) {
                    $rest = substr($existing, strlen($shorthand));
                    foreach (explode('.', $codes) as $kept) {
                        $kept .= $rest;
                        // A longhand entry after the atom (not copied yet) was written after it and
                        // keeps its value; one before it is the atom's own tombstone or an earlier,
                        // broader atom's value.
                        $deleted = array_key_exists('#' . $kept, $classes);
                        unset($classes['#' . $kept]);
                        if ($deleted || !array_key_exists('#' . $kept, $earlier)) {
                            $classes['#' . $kept] = $this->prefix . $kept . substr($atom, strrpos($atom, '_'));
                        }
                    }
                } else {
                    $classes['#' . $existing] = $atom;
                }
            }
        } elseif (str_ends_with($key, '*')) {
            // A target's own `-xyz*` tombstone has the length of a condition key and must survive.
            $base = substr($key, 0, -1);
            foreach (array_keys($classes) as $existing) {
                $name = substr((string) $existing, 1);
                if (self::scoped($name, $base, true) && !str_ends_with($name, '*')) {
                    unset($classes[$existing]);
                }
            }
        }
        unset($classes['#' . $key]);
        $classes['#' . $key] = $token;
        return $classes;
    }

    /** `$key` is `$base`, or — for every condition set — `$base` plus `-` and a 4-character hash. */
    private static function scoped(string $key, string $base, bool $every): bool
    {
        return $key === $base
            || ($every && str_starts_with($key, $base . '-') && strlen($key) === strlen($base) + 5);
    }

    /** A base-62 property code (`0-9a-zA-Z`) for an index, as class names spell them (D-037). */
    private static function code(int $index): string
    {
        $prefix = $index > 61 ? self::code(intdiv($index, 62)) : '';
        $index %= 62;
        return $prefix . chr($index < 10 ? $index + 48 : ($index < 36 ? $index + 87 : $index + 29));
    }
}
