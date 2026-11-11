<?php
declare(strict_types=1);

namespace NetCafe\Security;

use NetCafe\Config;
use RuntimeException;

final class NativeSessionStore implements SessionStore
{
    public static function start(Config $config): self
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return new self();
        }
        if (headers_sent()) {
            throw new RuntimeException('Session cannot start after response output.');
        }

        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        session_name('netcafe_session');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $config->sessionCookieSecure,
            'httponly' => true,
            'samesite' => $config->sessionCookieSameSite,
        ]);
        if (!session_start()) {
            throw new RuntimeException('Could not start the session.');
        }
        return new self();
    }

    public function get(string $key): mixed
    {
        return $_SESSION[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public function clear(): void
    {
        $_SESSION = [];
    }

    public function regenerate(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE && !session_regenerate_id(true)) {
            throw new RuntimeException('Could not rotate the session identifier.');
        }
    }
}
