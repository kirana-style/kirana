<?php

declare(strict_types=1);

namespace Kirana\Laravel;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Kirana\ClassMap;

/**
 * Laravel: the class map as a singleton (read from `config('kirana.classes')`, by default
 * `public/kirana/classes.json`), and the Blade directive `@kirana('card', 'button.primary')`, which
 * prints the merged classes. Discovered automatically through `extra.laravel` in composer.json.
 */
final class KiranaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            ClassMap::class,
            fn ($app) => ClassMap::fromFile($app['config']->get('kirana.classes') ?? public_path('kirana/classes.json')),
        );
    }

    public function boot(): void
    {
        Blade::directive(
            'kirana',
            static fn (string $expression) => "<?php echo e(app(\\Kirana\\ClassMap::class)->classes({$expression})); ?>",
        );
    }
}
