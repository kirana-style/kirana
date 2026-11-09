<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
  <head>
    <meta charset="utf-8">
    <title inertia>Kirana on Laravel with Inertia</title>
    @viteReactRefresh
    @vite('resources/js/app.tsx')
    @inertiaHead
  </head>
  <body>
    {{-- Inertia renders the page here, in the browser: the probe is in resources/js/pages/Home.tsx. --}}
    @inertia
  </body>
</html>
