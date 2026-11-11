<?php
declare(strict_types=1);

namespace NetCafe\Security;

use NetCafe\Http\HttpException;

final class Authorization
{
    public static function requireRole(AuthenticatedUser $user, string ...$roles): void
    {
        if (!in_array($user->role(), $roles, true)) {
            throw new HttpException(403, 'You do not have permission to access this resource.', 'forbidden');
        }
    }
}
