<?php
declare(strict_types=1);

namespace NetCafe\Security;

/** In-memory session store for automated tests only. */
final class ArraySessionStore implements SessionStore
{
    /** @param array<string,mixed> $values */
    public function __construct(private array $values = [])
    {
    }

    public function get(string $key): mixed
    {
        return $this->values[$key] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $this->values[$key] = $value;
    }

    public function remove(string $key): void
    {
        unset($this->values[$key]);
    }

    public function clear(): void
    {
        $this->values = [];
    }

    public function regenerate(): void
    {
    }
}
