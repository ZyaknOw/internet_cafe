<?php
declare(strict_types=1);

namespace NetCafe\Supabase;

final class CurlTransport implements HttpTransport
{
    public function send(string $method, string $url, array $headers, ?string $body, int $timeoutSeconds): HttpResult
    {
        if (!function_exists('curl_init')) {
            throw new SupabaseException(503, 'PHP cURL extension is required.');
        }
        $handle = curl_init($url);
        if ($handle === false) {
            throw new SupabaseException(503, 'Could not initialize the HTTP client.');
        }

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeoutSeconds),
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | (str_starts_with($url, 'http://127.0.0.1') || str_starts_with($url, 'http://localhost') ? CURLPROTO_HTTP : 0),
        ];
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = $body;
        }
        curl_setopt_array($handle, $options);
        $responseBody = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        if ($responseBody === false) {
            $errorNumber = curl_errno($handle);
            curl_close($handle);
            error_log('[php-app] Supabase HTTP transport failed; cURL errno ' . $errorNumber);
            throw new SupabaseException(503, 'Supabase is temporarily unavailable.');
        }
        curl_close($handle);
        return new HttpResult($status, (string) $responseBody);
    }
}
