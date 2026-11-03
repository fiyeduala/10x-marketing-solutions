<?php
// Local development only: `php -S localhost:8787 cpanel/dev-router.php`.
// Stands in for Apache + .htaccess so `npm run dev` (which proxies /api to
// port 8787) talks to the PHP API. Never deploy this file.
declare(strict_types=1);

$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!preg_match('#^/api/v1(/|$)#', $path)) {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo "The dev router only serves /api/v1.\n";
    return true;
}
// Apache's rewrite supplies ?__path=; here api_path() reads REQUEST_URI.
require __DIR__ . '/csp-app/bootstrap.php';
\Csp\run();
