<?php
declare(strict_types=1);

use NetCafe\Application;
use NetCafe\Config;
use NetCafe\Security\NativeSessionStore;
use NetCafe\Security\SessionManager;
use NetCafe\Supabase\CurlTransport;
use NetCafe\Supabase\SupabaseHttpClient;

$projectRoot = __DIR__;
spl_autoload_register(static function (string $class): void {
    $prefix = 'NetCafe\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $path = __DIR__ . '/app/' . str_replace('\\', DIRECTORY_SEPARATOR, substr($class, strlen($prefix))) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

function netcafe_application(): Application
{
    global $projectRoot;
    static $application;
    if ($application instanceof Application) {
        return $application;
    }
    $config = Config::fromEnvironment($projectRoot);
    $sessionStore = NativeSessionStore::start($config);
    $sessions = new SessionManager($sessionStore);
    $supabase = new SupabaseHttpClient($config, new CurlTransport());
    return $application = new Application($config, $supabase, $sessions);
}
