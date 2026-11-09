<?php

namespace App\Http\Middleware;

use Inertia\Middleware;

/** Inertia's middleware, as `php artisan inertia:middleware` writes it: pages render into `app.blade.php`. */
class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';
}
