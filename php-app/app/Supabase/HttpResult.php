<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

final class HttpResult
{
    /** @param array<string,string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $body,
        public readonly array $headers = [],
    ) {
    }
}
