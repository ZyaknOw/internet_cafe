<?php
declare(strict_types=1);

$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
$file = __DIR__ . (is_string($path) ? $path : '/');
if (is_file($file) && str_starts_with(realpath($file) ?: '', realpath(__DIR__) . DIRECTORY_SEPARATOR)) {
    return false;
}
require __DIR__ . '/index.php';
