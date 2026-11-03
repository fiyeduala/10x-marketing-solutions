<?php
/**
 * Prints the SQL that sets (or changes) an administrator's password.
 *
 *   php tools/admin-password.php someone@example.com
 *
 * The password is read from the keyboard (not the command line, so it does
 * not end up in shell history) and only its hash is printed. Run the printed
 * SQL in phpMyAdmin. The email must already be on the admin_users list;
 * changing the password signs out every existing admin session.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$email = strtolower(trim($argv[1] ?? ''));
if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', $email)) {
    fwrite(STDERR, "Usage: php tools/admin-password.php <admin email>\n");
    exit(1);
}

function read_secret(string $prompt): string
{
    fwrite(STDERR, $prompt);
    $hidden = DIRECTORY_SEPARATOR === '/' && stream_isatty(STDIN);
    if ($hidden) shell_exec('stty -echo');
    $line = fgets(STDIN);
    if ($hidden) {
        shell_exec('stty echo');
        fwrite(STDERR, "\n");
    }
    return rtrim((string) $line, "\r\n");
}

$password = read_secret('New password (at least 12 characters): ');
if (strlen($password) < 12) {
    fwrite(STDERR, "The password must be at least 12 characters.\n");
    exit(1);
}
if (stream_isatty(STDIN) && read_secret('Repeat the password: ') !== $password) {
    fwrite(STDERR, "The passwords do not match.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$quote = fn (string $s) => "'" . str_replace(["\\", "'"], ["\\\\", "''"], $s) . "'";
echo "UPDATE admin_users SET password_hash = {$quote($hash)}, password_changed_at = UTC_TIMESTAMP(3) WHERE email = {$quote($email)};\n";
