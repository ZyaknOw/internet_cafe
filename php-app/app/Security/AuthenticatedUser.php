<?php
declare(strict_types=1);

namespace NetCafe\Security;

final class AuthenticatedUser
{
    /** @param array<string,mixed> $authUser @param array<string,mixed> $profile */
    public function __construct(
        public readonly array $authUser,
        public readonly array $profile,
        public readonly string $accessToken,
    ) {
    }

    public function role(): string
    {
        return strtolower((string) ($this->profile['role'] ?? ''));
    }
}
