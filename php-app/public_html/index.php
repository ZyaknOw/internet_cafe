<?php
declare(strict_types=1);

use NetCafe\Http\Request;

require dirname(__DIR__) . '/bootstrap.php';

try {
    netcafe_application()->handle(Request::fromGlobals())->send();
} catch (Throwable $exception) {
    error_log('[php-app] Bootstrap failure: ' . get_class($exception));
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":"Application could not process the request.","code":"bootstrap_failure"}';
}
