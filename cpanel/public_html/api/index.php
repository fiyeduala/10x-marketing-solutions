<?php
// Every /api/v1/* request is rewritten here by .htaccess. The application
// itself lives in ../../csp-app, outside the web root.
declare(strict_types=1);

require dirname(__DIR__, 2) . '/csp-app/bootstrap.php';

\Csp\run();
