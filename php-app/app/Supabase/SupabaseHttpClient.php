<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

use JsonException;
use NetCafe\Config;

final class SupabaseHttpClient implements SupabaseGateway
{
    public function __construct(
        private readonly Config $config,
        private readonly HttpTransport $transport,
    ) {
    }

    public function signIn(string $email, string $password): array
    {
        return $this->request('POST', '/auth/v1/token', 'publishable', ['grant_type' => 'password'], [
            'email' => $email,
            'password' => $password,
        ]);
    }

    public function refreshSession(string $refreshToken): array
    {
        return $this->request('POST', '/auth/v1/token', 'publishable', ['grant_type' => 'refresh_token'], [
            'refresh_token' => $refreshToken,
        ]);
    }

    public function verifyAccessToken(string $accessToken): array
    {
        return $this->request('GET', '/auth/v1/user', 'publishable', [], null, $accessToken);
    }

    public function signOut(string $accessToken): void
    {
        $this->request('POST', '/auth/v1/logout', 'publishable', [], null, $accessToken, true);
    }

    public function findProfileByAuthUserId(string $authUserId): ?array
    {
        $query = http_build_query([
            'select' => '*',
            'auth_user_id' => 'eq.' . $authUserId,
            'limit' => '1',
        ], '', '&', PHP_QUERY_RFC3986);
        $rows = $this->request('GET', '/rest/v1/account_profiles', 'secret', [], null, null, false, $query);
        if (!is_array($rows) || !isset($rows[0]) || !is_array($rows[0])) {
            return null;
        }
        return $rows[0];
    }

    public function updateCurrentUserPassword(string $accessToken, string $password): array
    {
        return $this->request('PUT', '/auth/v1/user', 'publishable', [], [
            'password' => $password,
            'data' => ['must_change_password' => false],
        ], $accessToken);
    }

    public function completeProfileActivation(string $authUserId, string $status): array
    {
        $query = http_build_query([
            'auth_user_id' => 'eq.' . $authUserId,
            'select' => '*',
        ], '', '&', PHP_QUERY_RFC3986);
        $rows = $this->request('PATCH', '/rest/v1/account_profiles', 'secret', [], [
            'status' => $status,
            'must_change_password' => false,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ], null, false, $query, ['Prefer: return=representation']);
        if (!is_array($rows) || !isset($rows[0]) || !is_array($rows[0])) {
            throw new SupabaseException(404, 'Account profile could not be updated.');
        }
        return $rows[0];
    }

    public function databaseIsReachable(): bool
    {
        $query = http_build_query(['select' => 'id', 'limit' => '1'], '', '&', PHP_QUERY_RFC3986);
        $this->request('GET', '/rest/v1/account_profiles', 'secret', [], null, null, false, $query);
        return true;
    }

    /**
     * New `sb_secret_*` keys are sent only as `apikey`. Legacy service_role JWTs
     * also need Authorization to retain their service_role database role.
     * @param array<string,string> $query
     * @param array<string,mixed>|null $payload
     * @param list<string> $extraHeaders
     */
    private function request(
        string $method,
        string $path,
        string $keyType,
        array $query = [],
        ?array $payload = null,
        ?string $userAccessToken = null,
        bool $allowEmpty = false,
        ?string $rawQuery = null,
        array $extraHeaders = [],
    ): array {
        $this->requireConfig($keyType);
        $key = $keyType === 'secret' ? $this->config->supabaseSecretKey : $this->config->supabasePublishableKey;
        $url = $this->config->supabaseUrl . $path;
        $queryString = $rawQuery ?? http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        if ($queryString !== '') {
            $url .= (str_contains($url, '?') ? '&' : '?') . $queryString;
        }

        $headers = [
            'Accept: application/json',
            'apikey: ' . $key,
        ];
        if ($userAccessToken !== null) {
            $headers[] = 'Authorization: Bearer ' . $userAccessToken;
        } elseif ($keyType === 'secret' && str_starts_with($key, 'eyJ')) {
            // Compatibility for the legacy JWT-form service_role key only.
            $headers[] = 'Authorization: Bearer ' . $key;
        }
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
        }
        foreach ($extraHeaders as $header) {
            $headers[] = $header;
        }

        try {
            $body = $payload === null ? null : json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
        } catch (JsonException) {
            throw new SupabaseException(500, 'Could not encode the Supabase request.');
        }
        $result = $this->transport->send($method, $url, $headers, $body, $this->config->supabaseTimeoutSeconds);
        if ($result->status < 200 || $result->status >= 300) {
            throw new SupabaseException($result->status, 'Supabase request failed.');
        }
        if ($result->body === '') {
            if ($allowEmpty || $result->status === 204) {
                return [];
            }
            return [];
        }
        try {
            $decoded = json_decode($result->body, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new SupabaseException(502, 'Supabase returned an invalid response.');
        }
        if (!is_array($decoded)) {
            throw new SupabaseException(502, 'Supabase returned an invalid response.');
        }
        return $decoded;
    }

    private function requireConfig(string $keyType): void
    {
        $isConfigured = $keyType === 'secret' ? $this->config->hasSupabaseSecretConfig() : $this->config->hasSupabasePublicConfig();
        if (!$isConfigured) {
            throw new SupabaseException(503, 'Supabase is not configured.');
        }
    }
}
