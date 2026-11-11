<?php
declare(strict_types=1);

namespace NetCafe\Security;

use NetCafe\Supabase\SupabaseException;
use NetCafe\Supabase\SupabaseGateway;

final class AuthContextResolver
{
    public function __construct(
        private readonly SessionManager $sessions,
        private readonly SupabaseGateway $supabase,
    ) {
    }

    public function requireUser(): AuthenticatedUser
    {
        $tokens = $this->sessions->auth();
        if ($tokens === null) {
            throw new \NetCafe\Http\HttpException(401, 'Please sign in.', 'unauthenticated');
        }
        $access = $tokens['access_token'];
        try {
            if ($tokens['expires_at'] > 0 && $tokens['expires_at'] <= time() + 30) {
                $tokens = $this->refresh($tokens['refresh_token']);
                $access = $tokens['access_token'];
            }
            try {
                $authUser = $this->supabase->verifyAccessToken($access);
            } catch (SupabaseException $exception) {
                if ($exception->httpStatus !== 401) {
                    throw $exception;
                }
                $tokens = $this->refresh($tokens['refresh_token']);
                $access = $tokens['access_token'];
                $authUser = $this->supabase->verifyAccessToken($access);
            }
        } catch (SupabaseException $exception) {
            if (in_array($exception->httpStatus, [400, 401, 403], true)) {
                $this->sessions->invalidate();
                throw new \NetCafe\Http\HttpException(401, 'Your session has expired. Please sign in again.', 'session_expired');
            }
            throw $exception;
        }
        $id = $authUser['id'] ?? null;
        if (!is_string($id) || $id === '') {
            $this->sessions->invalidate();
            throw new \NetCafe\Http\HttpException(401, 'Your session is invalid. Please sign in again.', 'session_invalid');
        }
        $profile = $this->supabase->findProfileByAuthUserId($id);
        if ($profile === null || (string) ($profile['auth_user_id'] ?? '') !== $id) {
            $this->sessions->invalidate();
            throw new \NetCafe\Http\HttpException(403, 'This account does not have an active profile.', 'profile_unavailable');
        }
        $status = strtolower((string) ($profile['status'] ?? ''));
        if (!in_array($status, ['active', 'approved'], true)) {
            $this->sessions->invalidate();
            throw new \NetCafe\Http\HttpException(403, 'This account is not approved for access.', 'account_unavailable');
        }
        $this->sessions->replaceTokens($tokens);
        return new AuthenticatedUser($authUser, $profile, $access);
    }

    /** @return array{access_token:string,refresh_token:string,expires_in?:int,expires_at?:int} */
    private function refresh(string $refreshToken): array
    {
        try {
            $tokens = $this->supabase->refreshSession($refreshToken);
        } catch (SupabaseException $exception) {
            if (in_array($exception->httpStatus, [400, 401, 403], true)) {
                $this->sessions->invalidate();
                throw new \NetCafe\Http\HttpException(401, 'Your session has expired. Please sign in again.', 'session_expired');
            }
            throw $exception;
        }
        if (!is_string($tokens['access_token'] ?? null) || !is_string($tokens['refresh_token'] ?? null)) {
            $this->sessions->invalidate();
            throw new \NetCafe\Http\HttpException(401, 'Your session has expired. Please sign in again.', 'session_expired');
        }
        $this->sessions->replaceTokens($tokens);
        return $tokens;
    }
}
