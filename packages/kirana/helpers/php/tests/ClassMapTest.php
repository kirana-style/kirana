<?php

declare(strict_types=1);

namespace Kirana\Tests;

use Kirana\ClassMap;
use PHPUnit\Framework\TestCase;

final class ClassMapTest extends TestCase
{
    public const MAP = [
        'version' => 1,
        'prefix' => 'k',
        'families' => ['four' => 45, 'two' => 111],
        'classes' => [
            'card' => 'k3_aaaa k1x_bbbb',
            'card.active' => 'k3_cccc',
            'quiet' => 'k3_',
        ],
    ];

    public function testMergesNamedHandlesLaterWinning(): void
    {
        $map = new ClassMap(self::MAP);
        self::assertSame('k1x_bbbb k3_cccc', $map->classes('card', 'card.active'));
        self::assertSame('k3_aaaa k1x_bbbb', $map->classes('card', null, false, ''));
        // A tombstone removes the property and never reaches the element.
        self::assertSame('k1x_bbbb', $map->classes('card', 'quiet'));
        self::assertSame('', $map->classes());
        self::assertTrue($map->has('card.active'));
        self::assertFalse($map->has('button'));
    }

    public function testUnknownNamesFailLoudly(): void
    {
        $this->expectExceptionMessage('kirana: no style named "button" in the class map');
        (new ClassMap(self::MAP))->classes('button');
    }

    public function testAnotherVersionIsRejected(): void
    {
        $this->expectExceptionMessage('written by another version of Kirana');
        new ClassMap(['version' => 2]);
    }

    public function testDefaultsForAnEmptyMap(): void
    {
        self::assertSame('', (new ClassMap(['version' => 1]))->classes());
    }

    public function testReadsTheFileKiranaWrote(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'kirana');
        file_put_contents($file, json_encode(self::MAP));
        self::assertSame('k3_cccc', ClassMap::fromFile($file)->classes('card.active'));
        unlink($file);
        $this->expectExceptionMessage('run `kirana dev` or `kirana build` first');
        ClassMap::fromFile($file);
    }
}
