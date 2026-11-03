<?php
declare(strict_types=1);

namespace Csp;

use PDO;

final class Db
{
    private static ?PDO $pdo = null;

    /** The one connection for this request, in UTC. */
    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        $host = env_require('DB_HOST');
        $port = env_read('DB_PORT') ?? '3306';
        $name = env_require('DB_NAME');
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        self::$pdo = new PDO($dsn, env_require('DB_USER'), env_read('DB_PASSWORD') ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        self::$pdo->exec("SET time_zone = '+00:00'");
        return self::$pdo;
    }

    /** @param array<int|string, mixed> $params */
    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        foreach (array_values($params) as $i => $value) {
            $type = match (true) {
                is_int($value) => PDO::PARAM_INT,
                is_bool($value) => PDO::PARAM_BOOL,
                $value === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $stmt->bindValue($i + 1, is_bool($value) ? (int) $value : $value, is_bool($value) ? PDO::PARAM_INT : $type);
        }
        $stmt->execute();
        return $stmt;
    }

    /** @return array<string, mixed>|null */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @return list<array<string, mixed>> */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    /** Rows changed by an UPDATE/DELETE. */
    public static function exec(string $sql, array $params = []): int
    {
        return self::run($sql, $params)->rowCount();
    }

    /**
     * Runs $fn in a transaction and returns its result. Rolls back on any
     * exception and rethrows it.
     * @template T
     * @param callable(): T $fn
     * @return T
     */
    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }
}

/** True when $e is a duplicate-key violation, optionally on a named index. */
function is_duplicate(\Throwable $e, ?string $index = null): bool
{
    if (!$e instanceof \PDOException) return false;
    $driverCode = $e->errorInfo[1] ?? null;
    if ($driverCode !== 1062) return false;
    return $index === null || str_contains($e->getMessage(), $index);
}

/** Decodes a JSON column into a PHP array (maps and lists alike). */
function json_col(mixed $value): array
{
    if ($value === null || $value === '') return [];
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}
