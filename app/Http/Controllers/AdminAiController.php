<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Perplexity;
use App\Support\RateLimiter;
use App\Support\RateLimits;
use App\Support\TooManyAttemptsException;
use PDO;
use PDOException;

/**
 * The editorial AI assistant: titles, excerpts, meta tags, proofreading and
 * social-copy variants, generated from whatever the editor currently has
 * unsaved in the article form (not from the database — the draft may not
 * be saved yet). Every response is a suggestion the human reviews and
 * applies (or discards) themselves; nothing here writes to an article.
 */
final class AdminAiController
{
    private const TASKS = ['title', 'excerpt', 'meta_title', 'meta_description', 'proofread', 'social'];

    public function assist(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $this->respond(function (PDO $pdo): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $task = (string) ($input['task'] ?? '');
            if (!in_array($task, self::TASKS, true)) {
                throw new \InvalidArgumentException('Tâche IA invalide.');
            }

            [$max, $window] = RateLimits::resolve('ai-assist');
            if ((new RateLimiter($pdo))->tooManyAttempts('ai-assist', $max, $window)) {
                throw new TooManyAttemptsException('Trop de requêtes à l’assistant IA. Réessayez dans un instant.');
            }

            $title = trim((string) ($input['title'] ?? ''));
            $excerpt = trim((string) ($input['excerpt'] ?? ''));
            $bodyHtml = trim((string) ($input['body'] ?? ''));
            $bodyText = trim(strip_tags($bodyHtml));
            $categoryName = trim((string) ($input['category_name'] ?? ''));

            if ($title === '' && $bodyText === '') {
                throw new \InvalidArgumentException('Renseignez au moins un titre ou un contenu avant de solliciter l’assistant IA.');
            }

            [$systemPrompt, $userPrompt] = $this->buildPrompt($task, $title, $excerpt, $bodyText, $categoryName);
            $result = Perplexity::complete($systemPrompt, $userPrompt);
            if (!$result['success']) {
                throw new \RuntimeException($result['error']);
            }

            AuditLog::record('ai.assist', 'article', null, ['task' => $task]);

            return ['data' => ['suggestions' => $this->parseSuggestions($task, $result['content'])]];
        });
    }

    /**
     * @return array{0: string, 1: string} [systemPrompt, userPrompt]
     */
    private function buildPrompt(string $task, string $title, string $excerpt, string $bodyText, string $categoryName): array
    {
        $system = 'Tu es un assistant éditorial pour Le Quotidien Actu, un site d’actualité francophone. '
            . 'Réponds toujours en français, de façon factuelle et neutre, sans jamais inventer d’informations '
            . 'absentes du texte fourni. Ne réponds qu’avec le contenu demandé, sans préambule ni commentaire.';

        $context = 'Titre actuel : ' . ($title !== '' ? $title : '(aucun)') . "\n"
            . 'Rubrique : ' . ($categoryName !== '' ? $categoryName : '(non précisée)') . "\n"
            . 'Chapô actuel : ' . ($excerpt !== '' ? $excerpt : '(aucun)') . "\n\n"
            . 'Contenu de l’article :' . "\n" . mb_substr($bodyText, 0, 6000);

        $user = match ($task) {
            'title' => "Propose 3 titres d’article alternatifs, accrocheurs mais factuels, un par ligne, sans numérotation ni guillemets.\n\n{$context}",
            'excerpt' => "Rédige un chapô (résumé d’accroche) de 150 à 200 caractères pour cet article. Une seule proposition, sans guillemets.\n\n{$context}",
            'meta_title' => "Rédige un titre SEO (meta title) de 60 caractères maximum. Une seule proposition, sans guillemets.\n\n{$context}",
            'meta_description' => "Rédige une meta description SEO de 155 caractères maximum. Une seule proposition, sans guillemets.\n\n{$context}",
            'proofread' => "Corrige l’orthographe, la grammaire et la ponctuation du texte suivant sans changer le sens, le ton ni la structure en paragraphes. Renvoie uniquement le texte corrigé.\n\n" . mb_substr($bodyText, 0, 8000),
            'social' => "Rédige 3 déclinaisons courtes de cet article pour les réseaux sociaux, chacune sur sa propre ligne, dans cet ordre exact : "
                . "1) un post X/Twitter (280 caractères maximum, percutant) ; 2) un post Facebook (plus descriptif, 2-3 phrases) ; "
                . "3) un post LinkedIn (ton professionnel, 2-3 phrases). Sépare les 3 propositions par une ligne contenant exactement ---.\n\n{$context}",
            default => $context,
        };

        return [$system, $user];
    }

    /**
     * @return string[]
     */
    private function parseSuggestions(string $task, string $content): array
    {
        if ($task === 'title') {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $content))));
            return array_slice($lines, 0, 3) ?: [$content];
        }
        if ($task === 'social') {
            $parts = array_map('trim', explode('---', $content));
            $parts = array_slice(array_pad($parts, 3, ''), 0, 3);
            return $parts;
        }
        return [$content];
    }

    private function respond(callable $operation, int $success = 200): void
    {
        try {
            http_response_code($success);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage(), 422);
        } catch (TooManyAttemptsException $e) {
            $this->error($e->getMessage(), 429);
        } catch (PDOException) {
            $this->error('Base de données indisponible.', 503);
        } catch (\Throwable $e) {
            $this->error($e->getMessage(), 502);
        }
    }

    private function error(string $message, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => $message]);
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
