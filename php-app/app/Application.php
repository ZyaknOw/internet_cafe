<?php
declare(strict_types=1);

namespace NetCafe;

use NetCafe\Http\HttpException;
use NetCafe\Http\Request;
use NetCafe\Http\Response;
use NetCafe\Http\Router;
use NetCafe\Security\AuthContextResolver;
use NetCafe\Security\Authorization;
use NetCafe\Security\SessionManager;
use NetCafe\Supabase\SupabaseException;
use NetCafe\Supabase\SupabaseGateway;
use NetCafe\Validation\Input;
use Throwable;

final class Application
{
    private Router $router;
    private AuthContextResolver $auth;

    public function __construct(
        private readonly Config $config,
        private readonly SupabaseGateway $supabase,
        private readonly SessionManager $sessions,
    ) {
        $this->router = new Router();
        $this->auth = new AuthContextResolver($sessions, $supabase);
        $this->routes();
    }

    public function handle(Request $request): Response
    {
        try {
            $this->assertOrigin($request);
            if ($request->method() === 'OPTIONS') {
                return $this->preflight($request)->withHeaders($this->corsHeaders($request) + $this->securityHeaders());
            }
            if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                if (!$this->sessions->validateCsrf($request->header('x-csrf-token'))) {
                    throw new HttpException(419, 'The request token is missing or expired. Refresh and try again.', 'csrf_failed');
                }
            }
            return $this->router->dispatch($request)->withHeaders($this->corsHeaders($request) + $this->securityHeaders());
        } catch (HttpException $exception) {
            return $this->error($exception->status, $exception->getMessage(), $exception->errorCode)
                ->withHeaders($this->corsHeaders($request) + $this->securityHeaders());
        } catch (SupabaseException $exception) {
            error_log('[php-app] Supabase failure; upstream status ' . $exception->httpStatus);
            $status = in_array($exception->httpStatus, [400, 401, 403], true) ? 401 : 503;
            return $this->error($status, $status === 401 ? 'Invalid email or password.' : 'A required service is temporarily unavailable.', $status === 401 ? 'authentication_failed' : 'service_unavailable')
                ->withHeaders($this->corsHeaders($request) + $this->securityHeaders());
        } catch (Throwable $exception) {
            error_log('[php-app] Unhandled request error: ' . get_class($exception));
            $message = $this->config->debug ? 'Internal server error: ' . $exception->getMessage() : 'An unexpected error occurred.';
            return $this->error(500, $message, 'internal_error')
                ->withHeaders($this->corsHeaders($request) + $this->securityHeaders());
        }
    }

    private function routes(): void
    {
        $this->router->add('GET', '/health', fn (): Response => Response::json(['ok' => true]));
        $this->router->add('GET', '/api/csrf', fn (): Response => Response::json(['csrfToken' => $this->sessions->csrfToken()]));
        $this->router->add('POST', '/api/auth/login', fn (Request $request): Response => $this->login($request));
        $this->router->add('POST', '/api/auth/logout', fn (): Response => $this->logout());
        $this->router->add('POST', '/api/auth/activate-profile', fn (Request $request): Response => $this->activateProfile($request));
        $this->router->add('POST', '/api/auth/complete-password-change', fn (Request $request): Response => $this->activateProfile($request));
        $this->router->add('GET', '/api/me', fn (): Response => $this->me());
        $this->router->add('GET', '/health/database', fn (): Response => $this->databaseHealth());
    }

    private function login(Request $request): Response
    {
        $body = $request->body();
        $email = Input::email($body, 'email');
        $password = $body['password'] ?? null;
        if (!is_string($password) || $password === '' || strlen($password) > 1024) {
            throw new HttpException(422, 'One or more fields are invalid.', 'validation_error');
        }
        try {
            $result = $this->supabase->signIn($email, $password);
        } catch (SupabaseException $exception) {
            if (in_array($exception->httpStatus, [400, 401, 403], true)) {
                throw new HttpException(401, 'Invalid email or password.', 'authentication_failed');
            }
            throw $exception;
        }
        $access = $result['access_token'] ?? null;
        $refresh = $result['refresh_token'] ?? null;
        if (!is_string($access) || !is_string($refresh)) {
            throw new HttpException(502, 'Authentication provider returned an incomplete session.', 'authentication_failed');
        }
        $authUser = $this->supabase->verifyAccessToken($access);
        $authId = $authUser['id'] ?? null;
        if (!is_string($authId) || $authId === '') {
            throw new HttpException(401, 'Invalid email or password.', 'authentication_failed');
        }
        $profile = $this->supabase->findProfileByAuthUserId($authId);
        $status = strtolower((string) ($profile['status'] ?? ''));
        $role = strtolower((string) ($profile['role'] ?? ''));
        if ($profile === null || (string) ($profile['auth_user_id'] ?? '') !== $authId || !in_array($status, ['active', 'approved'], true) || !in_array($role, ['admin', 'staff', 'customer'], true)) {
            throw new HttpException(403, 'This account is not approved for access.', 'account_unavailable');
        }
        $this->sessions->establish([
            'access_token' => $access,
            'refresh_token' => $refresh,
            'expires_in' => is_numeric($result['expires_in'] ?? null) ? (int) $result['expires_in'] : 3600,
        ]);
        return Response::json([
            'profile' => $profile,
            'csrfToken' => $this->sessions->csrfToken(),
            'mustChangePassword' => (bool) ($profile['must_change_password'] ?? false),
        ]);
    }

    private function logout(): Response
    {
        $tokens = $this->sessions->auth();
        if ($tokens !== null) {
            try {
                $this->supabase->signOut($tokens['access_token']);
            } catch (Throwable $exception) {
                error_log('[php-app] Supabase sign-out failed; local session will still be cleared.');
            }
        }
        $this->sessions->invalidate();
        return Response::json(['ok' => true, 'csrfToken' => $this->sessions->csrfToken()]);
    }

    private function me(): Response
    {
        $user = $this->auth->requireUser();
        return Response::json(['profile' => $user->profile]);
    }

    private function activateProfile(Request $request): Response
    {
        $user = $this->auth->requireUser();
        $password = $request->input('password');
        if (!is_string($password) || strlen($password) < 8 || strlen($password) > 128 || preg_match('/[\x00-\x1F\x7F]/', $password)) {
            throw new HttpException(422, 'One or more fields are invalid.', 'validation_error');
        }
        $status = strtolower((string) ($user->profile['status'] ?? ''));
        if (!in_array($status, ['approved', 'active'], true)) {
            throw new HttpException(403, 'This account is not approved for activation.', 'account_unavailable');
        }
        $this->supabase->updateCurrentUserPassword($user->accessToken, $password);
        $profile = $this->supabase->completeProfileActivation((string) $user->profile['auth_user_id'], 'active');
        return Response::json(['profile' => $profile, 'message' => 'Password updated successfully.']);
    }

    private function databaseHealth(): Response
    {
        $user = $this->auth->requireUser();
        if (strtolower((string) ($user->profile['status'] ?? '')) !== 'active') {
            throw new HttpException(403, 'An active account is required.', 'account_unavailable');
        }
        Authorization::requireRole($user, 'admin');
        try {
            $this->supabase->databaseIsReachable();
        } catch (SupabaseException $exception) {
            error_log('[php-app] Protected database health check failed; upstream status ' . $exception->httpStatus);
            return Response::json(['ok' => false, 'error' => 'Database is temporarily unavailable.'], 503);
        }
        return Response::json(['ok' => true, 'database' => 'account_profiles table reachable']);
    }

    private function assertOrigin(Request $request): void
    {
        $origin = $request->header('origin');
        if ($origin !== null && !in_array(rtrim($origin, '/'), array_map(static fn (string $value): string => rtrim($value, '/'), $this->config->allowedOrigins), true)) {
            throw new HttpException(403, 'Origin is not allowed.', 'origin_not_allowed');
        }
    }

    private function preflight(Request $request): Response
    {
        $method = strtoupper((string) $request->header('access-control-request-method'));
        $allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
        if (!in_array($method, $allowedMethods, true)) {
            throw new HttpException(405, 'Requested method is not allowed.', 'method_not_allowed');
        }
        $requestedHeaders = array_filter(array_map('trim', explode(',', strtolower((string) $request->header('access-control-request-headers')))));
        $allowedHeaders = ['content-type', 'x-csrf-token'];
        if (array_diff($requestedHeaders, $allowedHeaders) !== []) {
            throw new HttpException(403, 'Requested headers are not allowed.', 'headers_not_allowed');
        }
        return Response::empty(204, [
            'Access-Control-Allow-Methods' => implode(', ', $allowedMethods),
            'Access-Control-Allow-Headers' => 'Content-Type, X-CSRF-Token',
            'Access-Control-Max-Age' => '600',
        ]);
    }

    /** @return array<string,string> */
    private function corsHeaders(Request $request): array
    {
        $origin = $request->header('origin');
        if ($origin === null || !in_array(rtrim($origin, '/'), array_map(static fn (string $value): string => rtrim($value, '/'), $this->config->allowedOrigins), true)) {
            return [];
        }
        return [
            'Access-Control-Allow-Origin' => $origin,
            'Access-Control-Allow-Credentials' => 'true',
            'Vary' => 'Origin',
        ];
    }

    /** @return array<string,string> */
    private function securityHeaders(): array
    {
        return [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'same-origin',
            'Cache-Control' => 'no-store',
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
        ];
    }

    private function error(int $status, string $message, string $code): Response
    {
        return Response::json(['error' => $message, 'code' => $code], $status);
    }
}
