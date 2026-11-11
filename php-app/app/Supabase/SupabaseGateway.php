<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

interface SupabaseGateway
{
    /** @return array<string,mixed> */
    public function signIn(string $email, string $password): array;

    /** @return array<string,mixed> */
    public function refreshSession(string $refreshToken): array;

    /** @return array<string,mixed> */
    public function verifyAccessToken(string $accessToken): array;

    public function signOut(string $accessToken): void;

    /** @return array<string,mixed>|null */
    public function findProfileByAuthUserId(string $authUserId): ?array;

    /** @return array<string,mixed> */
    public function updateCurrentUserPassword(string $accessToken, string $password): array;

    /** @return array<string,mixed> */
    public function completeProfileActivation(string $authUserId, string $status): array;

    public function databaseIsReachable(): bool;
}
