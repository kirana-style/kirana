<?php

declare(strict_types=1);

namespace Kirana\Tests;

use Kirana\ClassMap;
use Kirana\Twig\KiranaExtension;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

final class TwigTest extends TestCase
{
    public function testTheKiranaFunction(): void
    {
        $twig = new Environment(new ArrayLoader([
            'page' => '<div class="{{ kirana(\'card\', active ? \'card.active\') }}"></div>',
        ]));
        $twig->addExtension(new KiranaExtension(new ClassMap(ClassMapTest::MAP)));
        self::assertSame('<div class="k1x_bbbb k3_cccc"></div>', $twig->render('page', ['active' => true]));
        self::assertSame('<div class="k3_aaaa k1x_bbbb"></div>', $twig->render('page', ['active' => false]));
        self::assertSame('', (new KiranaExtension(new ClassMap(ClassMapTest::MAP)))->classes());
    }

    public function testAPathIsReadOnFirstUse(): void
    {
        $file = sys_get_temp_dir() . '/kirana-' . uniqid() . '.json';
        // Built before the class map exists, as `cache:clear` warms Twig before any build.
        $extension = new KiranaExtension($file);
        file_put_contents($file, json_encode(ClassMapTest::MAP));
        self::assertSame('k3_cccc', $extension->classes(['card.active']));
        unlink($file);
        // Read once: the request keeps the map it read.
        self::assertSame('k3_cccc', $extension->classes(['card.active']));
    }
}
