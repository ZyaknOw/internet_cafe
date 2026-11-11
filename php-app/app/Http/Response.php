<?php
declare(strict_types=1);

namespace NetCafe\Http;

final class Response
{
    /** @param array<string,string> $headers @param array<string,mixed>|null $payload */
    public function __construct(
        private readonly int $status,
        private readonly string $body,
        private readonly array $headers = [],
        private readonly ?array $payload = null,
    ) {
    }

    /** @param array<string,mixed> $payload @param array<string,string> $headers */
    public static function json(array $payload, int $status = 200, array $headers = []): self
    {
        $body = json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        return new self($status, $body, ['Content-Type' => 'application/json; charset=utf-8'] + $headers, $payload);
    }

    /** @param array<string,string> $headers */
    public static function empty(int $status = 204, array $headers = []): self
    {
        return new self($status, '', $headers, null);
    }

    public function withHeaders(array $headers): self
    {
        return new self($this->status, $this->body, $headers + $this->headers, $this->payload);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function body(): string
    {
        return $this->body;
    }

    /** @return array<string,string> */
    public function headers(): array
    {
        return $this->headers;
    }

    /** @return array<string,mixed>|null */
    public function payload(): ?array
    {
        return $this->payload;
    }

    public function send(): never
    {
        http_response_code($this->status);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value, true);
        }
        echo $this->body;
        exit;
    }
}
