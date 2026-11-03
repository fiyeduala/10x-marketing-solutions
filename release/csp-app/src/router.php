<?php
declare(strict_types=1);

namespace Csp;

use Csp\Routes;

const ID = '([0-9a-fA-F-]{36})';
const CERT = '([0-9A-Za-z-]{12,30})';

/** @return array<int, array{0:string,1:string,2:callable}> */
function routes(): array
{
    return [
        ['GET', '#^config$#', 'Csp\Routes\get_public_config'],
        ['POST', '#^session$#', 'Csp\Routes\create_session'],
        ['DELETE', '#^session$#', 'Csp\Routes\sign_out'],
        ['GET', '#^me$#', 'Csp\Routes\get_me'],
        ['POST', '#^recover$#', 'Csp\Routes\recover'],
        ['POST', '#^attempts$#', 'Csp\Routes\start_attempt'],
        ['GET', '#^attempts/' . ID . '$#', 'Csp\Routes\get_attempt'],
        ['PUT', '#^attempts/' . ID . '/answers$#', 'Csp\Routes\save_answers'],
        ['POST', '#^attempts/' . ID . '/submit$#', 'Csp\Routes\submit_attempt'],
        ['POST', '#^payments/initialize$#', 'Csp\Routes\initialize_payment'],
        ['POST', '#^payments/verify$#', 'Csp\Routes\verify_payment'],
        ['POST', '#^paystack/webhook$#', 'Csp\Routes\paystack_webhook'],
        ['GET', '#^certificates/' . CERT . '$#', 'Csp\Routes\get_certificate'],
        ['GET', '#^certificates/' . CERT . '/pdf$#', 'Csp\Routes\get_certificate_pdf'],
        ['GET', '#^verify/' . CERT . '$#', 'Csp\Routes\verify_certificate'],
        ['POST', '#^admin/login$#', 'Csp\Routes\admin_login'],
        ['DELETE', '#^admin/session$#', 'Csp\Routes\admin_logout'],
        ['GET', '#^admin/me$#', 'Csp\Routes\admin_me'],
        ['GET', '#^admin/summary$#', 'Csp\Routes\admin_summary'],
        ['GET', '#^admin/attempts$#', 'Csp\Routes\admin_attempts'],
        ['GET', '#^admin/export\.csv$#', 'Csp\Routes\admin_export'],
        ['GET', '#^admin/audit$#', 'Csp\Routes\admin_audit'],
        ['PATCH', '#^admin/config$#', 'Csp\Routes\admin_update_config'],
        ['POST', '#^admin/certificates/' . CERT . '/revoke$#', 'Csp\Routes\admin_revoke'],
    ];
}

function handle(Request $req): Response
{
    try {
        $matches = array_values(array_filter(routes(), fn ($r) => preg_match($r[1], $req->path) === 1));
        if (!$matches) throw new HttpError(404, 'not_found', 'Not found.');
        $route = null;
        foreach ($matches as $r) if ($r[0] === $req->method) { $route = $r; break; }
        if ($route === null) {
            return json(['error' => ['code' => 'method_not_allowed', 'message' => 'Method not allowed.']], 405, [
                'Allow' => implode(', ', array_unique(array_column($matches, 0))),
            ]);
        }
        // The webhook is server-to-server and authenticated by its signature.
        if ($req->method !== 'GET' && $req->path !== 'paystack/webhook') $req->assertSameOrigin(safe_base_origin());
        preg_match($route[1], $req->path, $m);
        $req->params = array_slice($m, 1);
        return ($route[2])($req);
    } catch (HttpError $err) {
        return error_response($err);
    } catch (ConfigError $err) {
        error_log("[config] {$err->getMessage()}");
        return error_response(new HttpError(503, 'not_configured', 'This service is not available right now. Please try again later.'));
    } catch (\Throwable $err) {
        error_log("[api] {$req->method} {$req->path}: " . get_class($err) . ': ' . $err->getMessage());
        return error_response(new HttpError(500, 'server_error', 'Something went wrong on our side. Please try again.'));
    }
}

function safe_base_origin(): string
{
    try {
        $parts = parse_url(Env::appBaseUrl());
    } catch (ConfigError) {
        return '';
    }
    if (!isset($parts['scheme'], $parts['host'])) return '';
    return strtolower($parts['scheme']) . '://' . strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '');
}
