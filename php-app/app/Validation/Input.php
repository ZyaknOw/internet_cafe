<?php
declare(strict_types=1);

namespace NetCafe\Validation;

use NetCafe\Http\HttpException;

final class Input
{
    /** @param array<string,mixed> $body */
    public static function requiredString(array $body, string $key, int $min, int $max): string
    {
        $value = $body[$key] ?? null;
        if (!is_string($value)) {
            throw new HttpException(422, 'One or more fields are invalid.', 'validation_error');
        }
        $value = trim($value);
        $length = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
        if ($length < $min || $length > $max || str_contains($value, "\0")) {
            throw new HttpException(422, 'One or more fields are invalid.', 'validation_error');
        }
        return $value;
    }

    /** @param array<string,mixed> $body */
    public static function email(array $body, string $key): string
    {
        $email = self::requiredString($body, $key, 3, 254);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpException(422, 'One or more fields are invalid.', 'validation_error');
        }
        return $email;
    }
}
