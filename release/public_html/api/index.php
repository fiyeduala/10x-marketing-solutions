<?php
// Every /api/v1/* request is rewritten here by .htaccess. The application
// itself lives in a csp-app folder outside the web root: normally next to
// the document root (~/csp-app for ~/public_html or ~/<addon-domain>), or
// further up for an addon domain inside public_html.
declare(strict_types=1);

$csp_dir = dirname(__DIR__);
while (($csp_parent = dirname($csp_dir)) !== $csp_dir) {
    $csp_dir = $csp_parent;
    if (is_file($csp_dir . '/csp-app/bootstrap.php')) {
        require $csp_dir . '/csp-app/bootstrap.php';
        \Csp\run();
        exit;
    }
}

http_response_code(500);
header('Content-Type: application/json');
echo '{"error":"server_misconfigured"}';
