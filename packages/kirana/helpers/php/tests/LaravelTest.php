<?php

declare(strict_types=1);

namespace Kirana\Tests;

use Illuminate\Support\Facades\Blade;
use Kirana\ClassMap;
use Kirana\Laravel\KiranaServiceProvider;
use Orchestra\Testbench\TestCase;

final class LaravelTest extends TestCase
{
    private string $file;

    protected function setUp(): void
    {
        parent::setUp();
        $this->file = (string) tempnam(sys_get_temp_dir(), 'kirana');
        file_put_contents($this->file, json_encode(ClassMapTest::MAP));
        $this->app['config']->set('kirana.classes', $this->file);
    }

    protected function tearDown(): void
    {
        unlink($this->file);
        parent::tearDown();
    }

    protected function getPackageProviders($app): array
    {
        return [KiranaServiceProvider::class];
    }

    public function testTheBladeDirective(): void
    {
        $html = Blade::render('<div class="@kirana(\'card\', $active ? \'card.active\' : null)"></div>', ['active' => true]);
        self::assertSame('<div class="k1x_bbbb k3_cccc"></div>', $html);
        self::assertSame($this->app->make(ClassMap::class), $this->app->make(ClassMap::class));
    }

    public function testTheDefaultLocation(): void
    {
        $this->app['config']->set('kirana.classes', null);
        $this->app->forgetInstance(ClassMap::class);
        $this->expectExceptionMessage(public_path('kirana/classes.json'));
        $this->app->make(ClassMap::class);
    }
}
