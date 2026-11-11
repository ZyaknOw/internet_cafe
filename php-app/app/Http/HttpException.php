<?php
declare(strict_types=1);

namespace NetCafe\Http;

use RuntimeException;

final class HttpException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly string $errorCode = 'request_error',
    ) {
        parent::__construct($message);
    }
}
