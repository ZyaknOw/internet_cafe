<?php
declare(strict_types=1);

namespace NetCafe\Http;

final class Router
{
    /** @var list<array{method:string,pattern:string,regex:string,names:list<string>,handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $path, callable $handler): void
    {
        $names = [];
        $segments = explode('/', trim($path, '/'));
        $parts = [];
        foreach ($segments as $segment) {
            if (preg_match('/^:([A-Za-z][A-Za-z0-9_]*)$/', $segment, $match)) {
                $names[] = $match[1];
                $parts[] = '([^/]+)';
            } else {
                $parts[] = preg_quote($segment, '~');
            }
        }
        $regex = $path === '/' ? '~^/$~D' : '~^/' . implode('/', $parts) . '/?$~D';
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $path,
            'regex' => $regex,
            'names' => $names,
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): Response
    {
        $pathMatches = [];
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path(), $matches)) {
                continue;
            }
            $pathMatches[] = $route['method'];
            if ($route['method'] !== $request->method() && !($request->method() === 'HEAD' && $route['method'] === 'GET')) {
                continue;
            }
            array_shift($matches);
            $params = [];
            foreach ($route['names'] as $index => $name) {
                $decoded = rawurldecode((string) ($matches[$index] ?? ''));
                if (str_contains($decoded, '/') || str_contains($decoded, "\0")) {
                    throw new HttpException(400, 'Invalid route parameter.', 'invalid_route_parameter');
                }
                $params[$name] = $decoded;
            }
            $response = ($route['handler'])($request, $params);
            if (!$response instanceof Response) {
                throw new \LogicException('Route handler must return a Response.');
            }
            if ($request->method() === 'HEAD') {
                return Response::empty($response->status(), $response->headers());
            }
            return $response;
        }
        if ($pathMatches !== []) {
            return Response::json(['error' => 'Method not allowed.', 'code' => 'method_not_allowed'], 405, ['Allow' => implode(', ', array_values(array_unique($pathMatches)))]);
        }
        return Response::json(['error' => 'Not found.', 'code' => 'not_found'], 404);
    }
}
