<?php
/**
 * Entry point for the assessment API. public_html/api/index.php includes this
 * file; everything here stays outside the web root.
 */
declare(strict_types=1);

namespace Csp;

const CSP_APP_DIR = __DIR__;

// Floats print as their shortest exact form (70.5, not 70.500000000000001).
ini_set('serialize_precision', '-1');
// Errors go to the server log, never into a response.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

if (!is_file(__DIR__ . '/vendor/autoload.php')) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":{"code":"not_configured","message":"This service is not available right now. Please try again later."}}';
    error_log('[config] csp-app/vendor is missing; run composer install or upload the release bundle');
    exit;
}
require __DIR__ . '/vendor/autoload.php';

foreach (['env', 'http', 'crypto', 'db', 'core', 'bank', 'auth', 'attempts', 'payments', 'certificate_pdf', 'router'] as $file) {
    require __DIR__ . "/src/{$file}.php";
}
foreach (['candidate', 'exam', 'payments', 'certificates', 'admin'] as $file) {
    require __DIR__ . "/src/routes/{$file}.php";
}

load_env_file(__DIR__ . '/.env');

function run(): void
{
    handle(new Request())->send();
}
