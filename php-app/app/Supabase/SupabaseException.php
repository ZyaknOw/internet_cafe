<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

use RuntimeException;

final class SupabaseException extends RuntimeException
{
    public function __construct(public readonly int $httpStatus, string $message = 'Supabase request failed.')
    {
        parent::__construct($message);
    }
}
