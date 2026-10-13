<?php

declare(strict_types=1);

namespace Kirana\Twig;

use Kirana\ClassMap;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * Twig (Symfony): `{{ kirana('card', active ? 'card.active') }}` prints the merged classes of the
 * named handles. Register it as a service with the class map's path, which Symfony's
 * autoconfiguration tags as a Twig extension:
 *
 *   Kirana\Twig\KiranaExtension:
 *       arguments: ['%kernel.project_dir%/public/kirana/classes.json']
 *
 * A path is read on first use, not when the container warms Twig up (`cache:clear` runs before
 * any `kirana build`).
 */
final class KiranaExtension extends AbstractExtension
{
    private ?ClassMap $loaded;

    public function __construct(private readonly ClassMap|string $map)
    {
        $this->loaded = $map instanceof ClassMap ? $map : null;
    }

    public function getFunctions(): array
    {
        return [new TwigFunction('kirana', $this->classes(...), ['is_variadic' => true])];
    }

    /** @param list<string|false|null> $names */
    public function classes(array $names = []): string
    {
        $this->loaded ??= ClassMap::fromFile((string) $this->map);
        return $this->loaded->classes(...$names);
    }
}
