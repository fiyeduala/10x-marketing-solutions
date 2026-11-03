<?php
declare(strict_types=1);

namespace Csp\Routes;

use Csp\Db;
use Csp\Env;
use Csp\HttpError;
use Csp\Request;
use Csp\Response;
use function Csp\{audit, iso, json, normalise_certificate_number, num, rate_limit, render_certificate_pdf, require_candidate};

const CERT_COLUMNS = 'id, certificate_number, candidate_id, certificate_title, recipient_name, score_percentage, issued_at, revoked_at';

function verify_url(string $certificateNumber): string
{
    return Env::appBaseUrl() . '/verify-certificate/' . $certificateNumber;
}

function own_certificate(Request $req, string $candidateId): array
{
    $number = normalise_certificate_number($req->params[0] ?? '');
    $cert = $number === null ? null : Db::one('SELECT ' . CERT_COLUMNS . ' FROM issued_certificates WHERE certificate_number = ? AND candidate_id = ?', [$number, $candidateId]);
    if (!$cert) throw new HttpError(404, 'not_found', 'That certificate was not found.');
    return $cert;
}

/** The owner's certificate details (JSON). */
function get_certificate(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    $cert = own_certificate($req, $candidate['id']);
    return json([
        'certificate' => [
            'number' => $cert['certificate_number'],
            'title' => $cert['certificate_title'],
            'recipientName' => $cert['recipient_name'],
            'scorePercentage' => num($cert['score_percentage']),
            'issuedAt' => iso($cert['issued_at']),
            'revoked' => $cert['revoked_at'] !== null,
            'verifyUrl' => verify_url($cert['certificate_number']),
        ],
    ]);
}

/** The owner's PDF. Revoked certificates cannot be downloaded. */
function get_certificate_pdf(Request $req): Response
{
    $candidate = require_candidate($req)['candidate'];
    rate_limit('pdf', $req->ip, 30, 600);
    $cert = own_certificate($req, $candidate['id']);
    if ($cert['revoked_at'] !== null) throw new HttpError(410, 'revoked', 'This certificate has been revoked.');

    $bytes = render_certificate_pdf([
        'certificateNumber' => $cert['certificate_number'],
        'recipientName' => $cert['recipient_name'],
        'certificateTitle' => $cert['certificate_title'],
        'scorePercentage' => (float) $cert['score_percentage'],
        'issuedAt' => iso($cert['issued_at']),
        'verifyUrl' => verify_url($cert['certificate_number']),
    ]);
    audit('certificate.downloaded', ['candidateId' => $candidate['id'], 'certificateId' => $cert['id'], 'ipHash' => $req->ipHash()]);
    return new Response(200, $bytes, [
        'Content-Type' => 'application/pdf',
        'Content-Disposition' => "attachment; filename=\"{$cert['certificate_number']}.pdf\"",
        'Cache-Control' => 'no-store, max-age=0',
        'X-Content-Type-Options' => 'nosniff',
        'X-Robots-Tag' => 'noindex, nofollow',
    ]);
}

/** Public check used by employers. Shows only what the certificate itself shows. */
function verify_certificate(Request $req): Response
{
    rate_limit('verify', $req->ip, 60, 600);
    $number = normalise_certificate_number(rawurldecode($req->params[0] ?? ''));
    if ($number === null) return json(['status' => 'not_found']);
    $cert = Db::one('SELECT certificate_number, certificate_title, recipient_name, issued_at, revoked_at FROM issued_certificates WHERE certificate_number = ?', [$number]);
    if (!$cert) return json(['status' => 'not_found', 'number' => $number]);
    return json([
        'status' => $cert['revoked_at'] !== null ? 'revoked' : 'valid',
        'certificate' => [
            'number' => $cert['certificate_number'],
            'title' => $cert['certificate_title'],
            'recipientName' => $cert['recipient_name'],
            'issuedAt' => iso($cert['issued_at']),
            'issuer' => '10X Marketing Solutions',
            'revokedAt' => iso($cert['revoked_at']),
        ],
    ]);
}
