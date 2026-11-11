<?php
declare(strict_types=1);

namespace NetCafe\Http;

final class Request
{
    /** @param array<string,string> $headers @param array<string,mixed> $body @param array<string,string> $query */
    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $headers = [],
        private readonly array $body = [],
        private readonly array $query = [],
    ) {
    }

    public static function fromGlobals(int $maxBodyBytes = 1_048_576): self
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = parse_url($uri, PHP_URL_PATH);
        $path = is_string($path) && $path !== '' ? $path : '/';
        $path = '/' . trim($path, '/');
        if ($path === '/') {
            $path = '/';
        }

        $headers = function_exists('getallheaders') ? getallheaders() : [];
        if (!is_array($headers)) {
            $headers = [];
        }
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                $headers[$name] ??= (string) $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['Content-Type'] ??= (string) $_SERVER['CONTENT_TYPE'];
        }

        $rawBody = file_get_contents('php://input');
        if ($rawBody === false) {
            throw new HttpException(400, 'Could not read request body.', 'invalid_request');
        }
        if (strlen($rawBody) > $maxBodyBytes) {
            throw new HttpException(413, 'Request body is too large.', 'payload_too_large');
        }

        $body = [];
        if (trim($rawBody) !== '') {
            $contentType = '';
            foreach ($headers as $name => $value) {
                if (strcasecmp((string) $name, 'Content-Type') === 0) {
                    $contentType = strtolower(trim(explode(';', (string) $value, 2)[0]));
                    break;
                }
            }
            if ($contentType !== 'application/json') {
                throw new HttpException(415, 'Send request data as JSON.', 'unsupported_media_type');
            }
            try {
                $decoded = json_decode($rawBody, true, 32, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new HttpException(400, 'Request body must be valid JSON.', 'invalid_json');
            }
            $firstNonWhitespace = strspn($rawBody, " \t\n\r");
            if (!is_array($decoded) || ($rawBody[$firstNonWhitespace] ?? '') !== '{') {
                throw new HttpException(400, 'Request body must be a JSON object.', 'invalid_json');
            }
            $body = $decoded;
        }

        $query = [];
        foreach ($_GET as $key => $value) {
            if (is_string($value) || is_numeric($value)) {
                $query[(string) $key] = (string) $value;
            }
        }

        return new self($method, $path, self::normalizeHeaders($headers), $body, $query);
    }

    /** Convenient constructor for tests and internally dispatched requests. */
    public static function fake(string $method, string $path, array $headers = [], array $body = [], array $query = []): self
    {
        $pathOnly = parse_url($path, PHP_URL_PATH);
        $normalizedPath = '/' . trim(is_string($pathOnly) && $pathOnly !== '' ? $pathOnly : '/', '/');
        if ($normalizedPath === '/') {
            $normalizedPath = '/';
        }
        return new self(strtoupper($method), $normalizedPath, self::normalizeHeaders($headers), $body, $query);
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** @return array<string,mixed> */
    public function body(): array
    {
        return $this->body;
    }

    public function input(string $key): mixed
    {
        return $this->body[$key] ?? null;
    }

    public function query(string $key): ?string
    {
        return $this->query[$key] ?? null;
    }

    /** @param array<string,mixed> $headers @return array<string,string> */
    private static function normalizeHeaders(array $headers): array
    {
        $normalized = [];
        foreach ($headers as $name => $value) {
            if (is_string($name) && (is_string($value) || is_numeric($value))) {
                $normalized[strtolower(trim($name))] = trim((string) $value);
            }
        }
        return $normalized;
    }
}
