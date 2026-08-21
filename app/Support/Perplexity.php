<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Thin wrapper around Perplexity's chat-completions endpoint for the
 * editorial AI assistant (title/excerpt/meta/proofreading/social-copy
 * suggestions). Every call is a single stateless request — there's no
 * conversation history to manage, and callers always treat the result as a
 * draft a human reviews before it touches the article.
 */
final class Perplexity
{
    /**
     * @return array{success: true, content: string}|array{success: false, error: string}
     */
    public static function complete(string $systemPrompt, string $userPrompt): array
    {
        $apiKey = $_ENV['PERPLEXITY_API_KEY'] ?? '';
        if ($apiKey === '') {
            return ['success' => false, 'error' => 'Clé API Perplexity manquante (PERPLEXITY_API_KEY).'];
        }

        $payload = json_encode([
            'model' => $_ENV['PERPLEXITY_MODEL'] ?? 'sonar',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 0.4,
        ], JSON_THROW_ON_ERROR);

        $ch = curl_init('https://api.perplexity.ai/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_TIMEOUT => 40,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return ['success' => false, 'error' => 'Connexion à Perplexity impossible : ' . $curlError];
        }
        if ($status !== 200) {
            return ['success' => false, 'error' => 'Perplexity a renvoyé une erreur (HTTP ' . $status . ').'];
        }

        try {
            $decoded = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return ['success' => false, 'error' => 'Réponse Perplexity illisible.'];
        }

        $content = $decoded['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
            return ['success' => false, 'error' => 'Réponse Perplexity vide.'];
        }

        return ['success' => true, 'content' => trim($content)];
    }
}
