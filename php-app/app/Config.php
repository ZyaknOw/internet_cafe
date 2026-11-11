<?php
declare(strict_types=1);

namespace NetCafe;

use InvalidArgumentException;

final class Config
{
    /** @param list<string> $allowedOrigins */
    public function __construct(
        public readonly string $appEnv = 'local',
        public readonly bool $debug = false,
        public readonly string $appBaseUrl = 'http://127.0.0.1:8080',
        public readonly array $allowedOrigins = ['http://127.0.0.1:8080'],
        public readonly bool $sessionCookieSecure = false,
        public readonly string $sessionCookieSameSite = 'Lax',
        public readonly string $supabaseUrl = '',
        public readonly string $supabasePublishableKey = '',
        public readonly string $supabaseSecretKey = '',
        public readonly int $supabaseTimeoutSeconds = 12,
    ) {
        if (!in_array($this->sessionCookieSameSite, ['Lax', 'Strict', 'None'], true)) {
            throw new InvalidArgumentException('SESSION_COOKIE_SAMESITE must be Lax, Strict, or None.');
        }
        if ($this->sessionCookieSameSite === 'None' && !$this->sessionCookieSecure) {
            throw new InvalidArgumentException('SameSite=None requires a Secure session cookie.');
        }
        if ($this->appEnv === 'production' && !$this->sessionCookieSecure) {
            throw new InvalidArgumentException('Production sessions require Secure cookies.');
        }
        if ($this->supabaseTimeoutSeconds < 2 || $this->supabaseTimeoutSeconds > 30) {
            throw new InvalidArgumentException('SUPABASE_TIMEOUT_SECONDS must be between 2 and 30.');
        }
        foreach ($this->allowedOrigins as $origin) {
            if (!self::isOrigin($origin)) {
                throw new InvalidArgumentException('APP_ALLOWED_ORIGINS must contain origins only (scheme and host).');
            }
            if ($this->appEnv === 'production' && strtolower((string) parse_url($origin, PHP_URL_SCHEME)) !== 'https') {
                throw new InvalidArgumentException('Production APP_ALLOWED_ORIGINS must use HTTPS.');
            }
        }
        if ($this->supabaseUrl !== '') {
            $scheme = strtolower((string) parse_url($this->supabaseUrl, PHP_URL_SCHEME));
            $host = (string) parse_url($this->supabaseUrl, PHP_URL_HOST);
            $isLocal = in_array($host, ['localhost', '127.0.0.1'], true);
            $supabaseParts = parse_url($this->supabaseUrl);
            if (!filter_var($this->supabaseUrl, FILTER_VALIDATE_URL)
                || ($scheme !== 'https' && !($isLocal && $scheme === 'http'))
                || !is_array($supabaseParts)
                || isset($supabaseParts['user'])
                || isset($supabaseParts['pass'])
                || isset($supabaseParts['query'])
                || isset($supabaseParts['fragment'])
                || (isset($supabaseParts['path']) && !in_array($supabaseParts['path'], ['', '/'], true))) {
                throw new InvalidArgumentException('SUPABASE_URL must use HTTPS (HTTP is allowed only for localhost).');
            }
        }
    }

    public static function fromEnvironment(string $projectRoot): self
    {
        $values = self::readEnvironment($projectRoot);
        $appEnv = self::value($values, 'APP_ENV', 'local');
        $baseUrl = rtrim(self::value($values, 'APP_BASE_URL', 'http://127.0.0.1:8080'), '/');
        $originValue = self::value($values, 'APP_ALLOWED_ORIGINS', $baseUrl);
        $allowedOrigins = array_values(array_unique(array_filter(array_map('trim', explode(',', $originValue)))));
        if ($allowedOrigins === []) {
            throw new InvalidArgumentException('At least one APP_ALLOWED_ORIGINS origin is required.');
        }

        return new self(
            appEnv: $appEnv,
            debug: filter_var(self::value($values, 'APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN),
            appBaseUrl: $baseUrl,
            allowedOrigins: $allowedOrigins,
            sessionCookieSecure: filter_var(self::value($values, 'SESSION_COOKIE_SECURE', $appEnv === 'production' ? 'true' : 'false'), FILTER_VALIDATE_BOOLEAN),
            sessionCookieSameSite: self::value($values, 'SESSION_COOKIE_SAMESITE', 'Lax'),
            supabaseUrl: rtrim(self::value($values, 'SUPABASE_URL', ''), '/'),
            supabasePublishableKey: self::value($values, 'SUPABASE_PUBLISHABLE_KEY', ''),
            supabaseSecretKey: self::value($values, 'SUPABASE_SECRET_KEY', ''),
            supabaseTimeoutSeconds: (int) self::value($values, 'SUPABASE_TIMEOUT_SECONDS', '12'),
        );
    }

    public function hasSupabasePublicConfig(): bool
    {
        return $this->supabaseUrl !== '' && $this->supabasePublishableKey !== '';
    }

    public function hasSupabaseSecretConfig(): bool
    {
        return $this->hasSupabasePublicConfig() && $this->supabaseSecretKey !== '';
    }

    /** @return array<string,string> */
    private static function readEnvironment(string $projectRoot): array
    {
        $values = [];
        $configPath = self::processValue('APP_CONFIG_PATH') ?: rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '.env';
        $realPath = realpath($configPath);
        $publicPath = realpath(rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'public_html');
        if ($realPath !== false && $publicPath !== false && str_starts_with($realPath . DIRECTORY_SEPARATOR, $publicPath . DIRECTORY_SEPARATOR)) {
            throw new InvalidArgumentException('APP_CONFIG_PATH must be outside public_html.');
        }
        if (is_file($configPath) && is_readable($configPath)) {
            $lines = file($configPath, FILE_IGNORE_NEW_LINES);
            if ($lines === false) {
                throw new InvalidArgumentException('Could not read the private app configuration file.');
            }
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                if (!preg_match('/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/', $line, $match)) {
                    continue;
                }
                $key = $match[1];
                $value = trim($match[2]);
                if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
                    $value = substr($value, 1, -1);
                }
                if (self::processValue($key) === null) {
                    $values[$key] = $value;
                }
            }
        }
        return $values;
    }

    /** @param array<string,string> $values */
    private static function value(array $values, string $key, string $fallback): string
    {
        return self::processValue($key) ?? $values[$key] ?? $fallback;
    }

    private static function processValue(string $key): ?string
    {
        $value = getenv($key);
        if ($value === false && isset($_SERVER[$key]) && is_string($_SERVER[$key])) {
            $value = $_SERVER[$key];
        }
        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function isOrigin(string $origin): bool
    {
        if ($origin === 'null' || $origin === '*') {
            return false;
        }
        $parts = parse_url($origin);
        return is_array($parts)
            && isset($parts['scheme'], $parts['host'])
            && in_array(strtolower((string) $parts['scheme']), ['https', 'http'], true)
            && !isset($parts['user'])
            && !isset($parts['pass'])
            && !isset($parts['query'])
            && !isset($parts['fragment'])
            && (!isset($parts['path']) || $parts['path'] === '' || $parts['path'] === '/');
    }
}
