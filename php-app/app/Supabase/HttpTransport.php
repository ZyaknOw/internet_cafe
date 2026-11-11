<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

interface HttpTransport
{
    /** @param list<string> $headers */
    public function send(string $method, string $url, array $headers, ?string $body, int $timeoutSeconds): HttpResult;
}
