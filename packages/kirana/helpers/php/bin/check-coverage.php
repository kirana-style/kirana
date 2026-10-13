<?php

declare(strict_types=1);

// Fails unless every line and method of the package is covered: PHPUnit reports coverage but has no
// threshold of its own. Branch coverage is not gated; see design-notes/class-maps.md.

$metrics = simplexml_load_file($argv[1] ?? 'coverage.xml')->project->metrics;
$missing = [];
foreach (['statements' => 'coveredstatements', 'methods' => 'coveredmethods'] as $total => $covered) {
    if ((int) $metrics[$total] !== (int) $metrics[$covered]) {
        $missing[] = "{$metrics[$covered]} of {$metrics[$total]} {$total}";
    }
}
if ($missing !== []) {
    fwrite(STDERR, 'coverage below 100 %: ' . implode(', ', $missing) . " covered\n");
    exit(1);
}
echo "coverage: 100 % of lines and methods\n";
