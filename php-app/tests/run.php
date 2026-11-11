<?php
declare(strict_types=1);

use NetCafe\Application;
use NetCafe\Config;
use NetCafe\Http\Request;
use NetCafe\Http\Response;
use NetCafe\Http\Router;
use NetCafe\Security\ArraySessionStore;
use NetCafe\Security\SessionManager;
use NetCafe\Supabase\HttpResult;
use NetCafe\Supabase\HttpTransport;
use NetCafe\Supabase\SupabaseGateway;
use NetCafe\Supabase\SupabaseHttpClient;

require dirname(__DIR__) . '/bootstrap.php';

final class FakeGateway implements SupabaseGateway
{
    public int $verifyCount = 0;
    public int $refreshCount = 0;
    public int $signOutCount = 0;
    public int $passwordUpdates = 0;
    public int $activationUpdates = 0;
    public bool $databaseReachable = true;
    /** @var array<string,mixed>|null */
    public ?array $profile = null;

    public function signIn(string $email, string $password): array
    {
        if ($email !== 'admin@example.test' || $password !== 'test-pass') {
            throw new \NetCafe\Supabase\SupabaseException(400, 'bad login');
        }
        return ['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600];
    }
    public function refreshSession(string $refreshToken): array
    {
        $this->refreshCount++;
        return ['access_token' => 'token-refreshed', 'refresh_token' => 'refresh-2', 'expires_in' => 3600];
    }
    public function verifyAccessToken(string $accessToken): array
    {
        $this->verifyCount++;
        return ['id' => 'auth-admin-id', 'email' => 'admin@example.test'];
    }
    public function signOut(string $accessToken): void { $this->signOutCount++; }
    public function findProfileByAuthUserId(string $authUserId): ?array { return $this->profile; }
    public function updateCurrentUserPassword(string $accessToken, string $password): array
    {
        $this->passwordUpdates++;
        return ['id' => 'auth-admin-id'];
    }
    public function completeProfileActivation(string $authUserId, string $status): array
    {
        $this->activationUpdates++;
        $this->profile['status'] = $status;
        $this->profile['must_change_password'] = false;
        return $this->profile ?? [];
    }
    public function databaseIsReachable(): bool
    {
        if (!$this->databaseReachable) {
            throw new \NetCafe\Supabase\SupabaseException(503, 'unavailable');
        }
        return true;
    }
}

final class CaptureTransport implements HttpTransport
{
    /** @var list<array{method:string,url:string,headers:list<string>,body:?string}> */
    public array $calls = [];
    public function send(string $method, string $url, array $headers, ?string $body, int $timeoutSeconds): HttpResult
    {
        $this->calls[] = compact('method', 'url', 'headers', 'body');
        return new HttpResult(200, '[{"id":"profile-1"}]');
    }
}

final class TestRunner
{
    private int $passed = 0;
    private int $failed = 0;
    public function test(string $name, callable $test): void
    {
        try {
            $test();
            $this->passed++;
            echo "PASS  {$name}\n";
        } catch (Throwable $exception) {
            $this->failed++;
            echo 'FAIL  ' . $name . ': ' . $exception->getMessage() . "\n";
        }
    }
    public function same(mixed $expected, mixed $actual, string $message = 'Values differ'): void
    {
        if ($expected !== $actual) {
            throw new RuntimeException($message . '; expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
        }
    }
    public function truthy(bool $condition, string $message = 'Expected condition to be true'): void
    {
        if (!$condition) { throw new RuntimeException($message); }
    }
    public function finish(): never
    {
        echo "\n{$this->passed} passed; {$this->failed} failed.\n";
        exit($this->failed === 0 ? 0 : 1);
    }
}

function fixture(string $role = 'admin', string $status = 'active', ?array $initialSession = null): array
{
    $config = new Config(allowedOrigins: ['https://cafe.example.test']);
    $store = new ArraySessionStore($initialSession ?? []);
    $sessions = new SessionManager($store);
    $gateway = new FakeGateway();
    $gateway->profile = [
        'id' => 'profile-1', 'auth_user_id' => 'auth-admin-id', 'role' => $role,
        'status' => $status, 'first_name' => 'Izzy', 'must_change_password' => false,
    ];
    return [new Application($config, $gateway, $sessions), $gateway, $sessions];
}

$tests = new TestRunner();
$tests->test('router matches parameter routes and rejects unsupported methods', function () use ($tests): void {
    $router = new Router();
    $router->add('GET', '/items/:itemId', static fn (Request $request, array $params): Response => Response::json(['id' => $params['itemId']]));
    $response = $router->dispatch(Request::fake('GET', '/items/PC-08'));
    $tests->same(200, $response->status());
    $tests->same(['id' => 'PC-08'], $response->payload());
    $tests->same(405, $router->dispatch(Request::fake('POST', '/items/PC-08'))->status());
    $tests->same(404, $router->dispatch(Request::fake('GET', '/missing'))->status());
});
$tests->test('health route returns a JSON liveness response', function () use ($tests): void {
    [$app] = fixture();
    $response = $app->handle(Request::fake('GET', '/health'));
    $tests->same(200, $response->status());
    $tests->same(['ok' => true], $response->payload());
});
$tests->test('login requires a CSRF token', function () use ($tests): void {
    [$app] = fixture();
    $response = $app->handle(Request::fake('POST', '/api/auth/login', ['Content-Type' => 'application/json'], ['email' => 'admin@example.test', 'password' => 'test-pass']));
    $tests->same(419, $response->status());
});
$tests->test('login creates a server session without returning bearer tokens', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture();
    $csrf = $sessions->csrfToken();
    $response = $app->handle(Request::fake('POST', '/api/auth/login', ['X-CSRF-Token' => $csrf], ['email' => 'admin@example.test', 'password' => 'test-pass']));
    $tests->same(200, $response->status());
    $tests->truthy(is_string($response->payload()['csrfToken'] ?? null));
    $tests->truthy(!str_contains($response->body(), 'access_token'));
    $tests->truthy($sessions->auth() !== null);
    $tests->same(1, $gateway->verifyCount);
});
$tests->test('pending profile cannot sign in', function () use ($tests): void {
    [$app, , $sessions] = fixture('customer', 'pending');
    $response = $app->handle(Request::fake('POST', '/api/auth/login', ['X-CSRF-Token' => $sessions->csrfToken()], ['email' => 'admin@example.test', 'password' => 'test-pass']));
    $tests->same(403, $response->status());
    $tests->same(null, $sessions->auth());
});
$tests->test('GET /api/me returns the authenticated linked profile envelope', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture('customer');
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('GET', '/api/me'));
    $tests->same(200, $response->status());
    $tests->same('profile-1', $response->payload()['profile']['id'] ?? null);
    $tests->same(1, $gateway->verifyCount);
});
$tests->test('GET /api/me rejects unauthenticated requests', function () use ($tests): void {
    [$app] = fixture();
    $tests->same(401, $app->handle(Request::fake('GET', '/api/me'))->status());
});
$tests->test('expired access token is refreshed before profile retrieval', function () use ($tests): void {
    [$app, $gateway] = fixture('customer', 'active', [
        'supabase_auth' => ['access_token' => 'expired-token', 'refresh_token' => 'refresh-1', 'expires_at' => time() - 20],
    ]);
    $response = $app->handle(Request::fake('GET', '/api/me'));
    $tests->same(200, $response->status());
    $tests->same(1, $gateway->refreshCount);
});
$tests->test('staff cannot access the protected database health endpoint', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture('staff');
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('GET', '/health/database'));
    $tests->same(403, $response->status());
    $tests->same(0, $gateway->databaseReachable ? 0 : 1);
});
$tests->test('active admin can check database connectivity', function () use ($tests): void {
    [$app, , $sessions] = fixture('admin');
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('GET', '/health/database'));
    $tests->same(200, $response->status());
    $tests->same(true, $response->payload()['ok'] ?? null);
});
$tests->test('state-changing endpoint rejects a mismatched CSRF token', function () use ($tests): void {
    [$app] = fixture();
    $response = $app->handle(Request::fake('POST', '/api/auth/logout', ['X-CSRF-Token' => 'wrong']));
    $tests->same(419, $response->status());
});
$tests->test('logout calls Supabase and clears the local session', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture();
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('POST', '/api/auth/logout', ['X-CSRF-Token' => $sessions->csrfToken()]));
    $tests->same(200, $response->status());
    $tests->same(1, $gateway->signOutCount);
    $tests->same(null, $sessions->auth());
});
$tests->test('unapproved cross-origin requests are denied', function () use ($tests): void {
    [$app] = fixture();
    $response = $app->handle(Request::fake('GET', '/health', ['Origin' => 'https://evil.example']));
    $tests->same(403, $response->status());
});
$tests->test('allowed CORS preflight includes credentialed origin and CSRF header policy', function () use ($tests): void {
    [$app] = fixture();
    $response = $app->handle(Request::fake('OPTIONS', '/api/auth/login', [
        'Origin' => 'https://cafe.example.test',
        'Access-Control-Request-Method' => 'POST',
        'Access-Control-Request-Headers' => 'content-type,x-csrf-token',
    ]));
    $tests->same(204, $response->status());
    $tests->same('https://cafe.example.test', $response->headers()['Access-Control-Allow-Origin'] ?? null);
    $tests->same('true', $response->headers()['Access-Control-Allow-Credentials'] ?? null);
});
$tests->test('production configuration refuses an insecure session cookie', function () use ($tests): void {
    try {
        new Config(appEnv: 'production', sessionCookieSecure: false);
        throw new RuntimeException('Expected production config to reject insecure cookies.');
    } catch (InvalidArgumentException) {
        $tests->truthy(true);
    }
});
$tests->test('production configuration rejects non-HTTPS allowed origins', function () use ($tests): void {
    try {
        new Config(appEnv: 'production', sessionCookieSecure: true, allowedOrigins: ['http://cafe.example.test']);
        throw new RuntimeException('Expected production config to reject HTTP origins.');
    } catch (InvalidArgumentException) {
        $tests->truthy(true);
    }
});
$tests->test('password activation changes Auth password and own approved profile only', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture('customer', 'approved');
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('POST', '/api/auth/activate-profile', ['X-CSRF-Token' => $sessions->csrfToken()], ['password' => 'new-pass-123']));
    $tests->same(200, $response->status());
    $tests->same(1, $gateway->passwordUpdates);
    $tests->same(1, $gateway->activationUpdates);
});
$tests->test('password activation validates the new password before upstream calls', function () use ($tests): void {
    [$app, $gateway, $sessions] = fixture('customer', 'approved');
    $sessions->establish(['access_token' => 'token-1', 'refresh_token' => 'refresh-1', 'expires_in' => 3600]);
    $response = $app->handle(Request::fake('POST', '/api/auth/activate-profile', ['X-CSRF-Token' => $sessions->csrfToken()], ['password' => 'short']));
    $tests->same(422, $response->status());
    $tests->same(0, $gateway->passwordUpdates);
});
$tests->test('new Supabase secret key is never sent as a bearer token', function () use ($tests): void {
    $config = new Config(supabaseUrl: 'https://project.supabase.co', supabasePublishableKey: 'sb_publishable_test', supabaseSecretKey: 'sb_secret_test');
    $transport = new CaptureTransport();
    $client = new SupabaseHttpClient($config, $transport);
    $client->findProfileByAuthUserId('auth-id');
    $tests->truthy(in_array('apikey: sb_secret_test', $transport->calls[0]['headers'], true));
    $tests->truthy(!array_filter($transport->calls[0]['headers'], static fn (string $header): bool => str_starts_with(strtolower($header), 'authorization:')));
});

$tests->finish();
