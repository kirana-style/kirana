<?php

declare(strict_types=1);

namespace Kirana;

/**
 * A class map (D-069): the class string of every handle a server app's style modules export, by
 * name, as `kirana build` and `kirana dev` write it. `classes()` merges named handles the way `sx`
 * merges them, later ones winning.
 */
final class ClassMap
{
    /** @var array<string, string> */
    private readonly array $classes;

    private readonly Merge $merge;

    /** @param array{version?: int, prefix?: string, families?: array{four?: int, two?: int}, classes?: array<string, string>} $map */
    public function __construct(array $map)
    {
        if (($map['version'] ?? null) !== 1) {
            throw new \InvalidArgumentException('kirana: this class map was written by another version of Kirana; rebuild it');
        }
        $this->classes = $map['classes'] ?? [];
        $this->merge = new Merge($map['prefix'] ?? 'k', $map['families']['four'] ?? 0, $map['families']['two'] ?? 0);
    }

    /** Reads the class map `kirana build` or `kirana dev` wrote. */
    public static function fromFile(string $path): self
    {
        $text = is_file($path) ? file_get_contents($path) : false;
        if ($text === false) {
            throw new \RuntimeException("kirana: no class map at {$path}; run `kirana dev` or `kirana build` first");
        }
        return new self(json_decode($text, true, flags: JSON_THROW_ON_ERROR));
    }

    /**
     * The classes of the named handles, merged: `classes('card', $active ? 'card.active' : null)`.
     * Falsy names are skipped, so a condition can leave one out.
     */
    public function classes(string|false|null ...$names): string
    {
        $strings = [];
        foreach ($names as $name) {
            if ($name === null || $name === false || $name === '') {
                continue;
            }
            $strings[] = $this->classes[$name]
                ?? throw new \InvalidArgumentException("kirana: no style named \"{$name}\" in the class map");
        }
        return $this->merge->dom($strings);
    }

    /** Whether the map has a handle by this name. */
    public function has(string $name): bool
    {
        return isset($this->classes[$name]);
    }
}
