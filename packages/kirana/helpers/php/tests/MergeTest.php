<?php

declare(strict_types=1);

namespace Kirana\Tests;

use Kirana\Merge;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** KRN-TEST-003: the merge here matches the build-time merge, as the JavaScript runtime does. */
final class MergeTest extends TestCase
{
    /** @return iterable<string, array{array{inputs: list<string>, markers: list<string>, atoms: list<string>, dom: list<string>}}> */
    public static function vectors(): iterable
    {
        $vectors = json_decode((string) file_get_contents(__DIR__ . '/../../../fixtures/merge/vectors.json'), true);
        foreach ($vectors as $index => $vector) {
            yield "vector {$index}" => [$vector];
        }
    }

    /** @param array{inputs: list<string>, markers: list<string>, atoms: list<string>, dom: list<string>} $vector */
    #[DataProvider('vectors')]
    public function testMatchesTheBuildTimeMerge(array $vector): void
    {
        $merge = new Merge('k', 45, 111);
        $merged = $merge->merge($vector['inputs']);
        $atoms = static fn (array $tokens) => array_values(array_filter($tokens, static fn ($token) => str_contains($token, '_')));
        self::assertSame($vector['atoms'], $atoms($merged));
        self::assertSame($vector['markers'], array_values(array_filter($merged, static fn ($token) => !str_contains($token, '_'))));
        self::assertSame($vector['dom'], $atoms(explode(' ', $merge->dom($vector['inputs']))));
    }

    /**
     * The vectors' properties have short codes; these, from the runtime, reach a box family whose
     * longhands' codes need two characters and both letter cases.
     */
    public function testBoxFamiliesWithLongCodes(): void
    {
        $merge = new Merge('k', 45, 111);
        self::assertSame('k3_dddd kE_aaaa', $merge->dom(['kI_bbbb kF_cccc k3_dddd', 'kE_aaaa']));
        self::assertSame('k1j_z', $merge->dom(['k1k_x k1l_y', 'k1j_z']));
        self::assertSame('', $merge->dom(['k1k_x', 'k1j_']));
        self::assertSame('k1y_x k1x_z', $merge->dom(['k1y_x', 'k1x_z']));
    }

    public function testKeepsForeignClassesAndAnotherPrefix(): void
    {
        $merge = new Merge('app', 45, 111);
        // Under another prefix `k3_bbbb` is a foreign class: kept, in order, once.
        self::assertSame('card k3_bbbb app3_aaaa', $merge->dom(['card k3_bbbb app3_cccc', 'card app3_aaaa']));
    }
}
