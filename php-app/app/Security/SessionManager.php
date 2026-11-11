<?php
declare(strict_types=1);

namespace NetCafe\Security;

final class SessionManager
{
    private const AUTH_KEY = 'supabase_auth';
    private const CSRF_KEY = 'csrf_token';

    public function __construct(private readonly SessionStore $store)
    {
    }

    /** @return array{access_token:string,refresh_token:string,expires_at:int}|null */
    public function auth(): ?array
    {
        $auth = $this->store->get(self::AUTH_KEY);
        if (!is_array($auth) || !is_string($auth['access_token'] ?? null) || !is_string($auth['refresh_token'] ?? null)) {
            return null;
        }
        return [
            'access_token' => $auth['access_token'],
            'refresh_token' => $auth['refresh_token'],
            'expires_at' => (int) ($auth['expires_at'] ?? 0),
        ];
    }

    /** @param array{access_token:string,refresh_token:string,expires_in?:int,expires_at?:int} $tokens */
    public function establish(array $tokens): void
    {
        $this->store->regenerate();
        $this->store->set(self::AUTH_KEY, [
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at' => (int) ($tokens['expires_at'] ?? time() + (int) ($tokens['expires_in'] ?? 3600)),
        ]);
        $this->store->set(self::CSRF_KEY, bin2hex(random_bytes(32)));
    }

    /** @param array{access_token:string,refresh_token:string,expires_in?:int,expires_at?:int} $tokens */
    public function replaceTokens(array $tokens): void
    {
        $this->store->set(self::AUTH_KEY, [
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at' => (int) ($tokens['expires_at'] ?? time() + (int) ($tokens['expires_in'] ?? 3600)),
        ]);
    }

    public function csrfToken(): string
    {
        $token = $this->store->get(self::CSRF_KEY);
        if (!is_string($token) || strlen($token) !== 64) {
            $token = bin2hex(random_bytes(32));
            $this->store->set(self::CSRF_KEY, $token);
        }
        return $token;
    }

    public function validateCsrf(?string $candidate): bool
    {
        return is_string($candidate) && $candidate !== '' && hash_equals($this->csrfToken(), $candidate);
    }

    public function invalidate(): void
    {
        $this->store->clear();
        $this->store->regenerate();
        $this->csrfToken();
    }
}
