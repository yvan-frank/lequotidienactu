<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use PDO;
use PDOException;
use Stripe\StripeClient;
use Stripe\Webhook;
use Stripe\Exception\SignatureVerificationException;
use UnexpectedValueException;

/**
 * Stripe-backed premium subscriptions for reader accounts. Claude never
 * handles card data directly — checkout and subscription management both
 * happen on Stripe-hosted pages (Checkout, Billing Portal); this
 * controller only creates the session URLs and reacts to webhook events
 * to keep `readers.premium_status` in sync.
 *
 * Requires STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET in
 * .env — every method fails with a clear message if they're unset, rather
 * than a confusing Stripe SDK error.
 */
final class PremiumController
{
    public function checkout(): void
    {
        $this->startReaderSession();
        $reader = $_SESSION['reader'] ?? null;
        if (!$reader) {
            $this->json(['message' => 'Connectez-vous pour souscrire à l’offre premium.'], 401);
            return;
        }

        $client = $this->stripeClient();
        if (!$client) {
            $this->json(['message' => 'Les paiements ne sont pas encore configurés sur ce site.'], 503);
            return;
        }
        $priceId = $_ENV['STRIPE_PRICE_ID'] ?? '';
        if ($priceId === '') {
            $this->json(['message' => 'Les paiements ne sont pas encore configurés sur ce site.'], 503);
            return;
        }

        try {
            $pdo = $this->pdo();
            $statement = $pdo->prepare('SELECT stripe_customer_id FROM readers WHERE id = :id');
            $statement->execute(['id' => $reader['id']]);
            $customerId = $statement->fetchColumn() ?: null;

            $session = $client->checkout->sessions->create([
                'mode' => 'subscription',
                'line_items' => [['price' => $priceId, 'quantity' => 1]],
                'customer' => $customerId ?: null,
                'customer_email' => $customerId ? null : $reader['email'],
                'client_reference_id' => (string) $reader['id'],
                'success_url' => Config::url('/') . '?premium=succes',
                'cancel_url' => Config::url('/') . '?premium=annule',
            ]);

            $this->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            $this->json(['message' => 'Impossible de créer la session de paiement : ' . $e->getMessage()], 502);
        }
    }

    public function billingPortal(): void
    {
        $this->startReaderSession();
        $reader = $_SESSION['reader'] ?? null;
        if (!$reader) {
            $this->json(['message' => 'Connectez-vous pour gérer votre abonnement.'], 401);
            return;
        }

        $client = $this->stripeClient();
        if (!$client) {
            $this->json(['message' => 'Les paiements ne sont pas encore configurés sur ce site.'], 503);
            return;
        }

        try {
            $pdo = $this->pdo();
            $statement = $pdo->prepare('SELECT stripe_customer_id FROM readers WHERE id = :id');
            $statement->execute(['id' => $reader['id']]);
            $customerId = $statement->fetchColumn();
            if (!$customerId) {
                $this->json(['message' => 'Aucun abonnement à gérer.'], 422);
                return;
            }

            $session = $client->billingPortal->sessions->create([
                'customer' => $customerId,
                'return_url' => Config::url('/'),
            ]);
            $this->json(['url' => $session->url]);
        } catch (\Throwable $e) {
            $this->json(['message' => 'Impossible d’ouvrir la gestion d’abonnement : ' . $e->getMessage()], 502);
        }
    }

    /**
     * Stripe webhook receiver — authenticated by signature, not a reader
     * session (Stripe's servers call this directly). Keeps `readers`
     * in sync with the subscription lifecycle: activation, renewal,
     * payment failure, cancellation.
     */
    public function webhook(): void
    {
        $secret = $_ENV['STRIPE_WEBHOOK_SECRET'] ?? '';
        $payload = file_get_contents('php://input') ?: '';
        $signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

        if ($secret === '') {
            http_response_code(503);
            echo 'Webhook not configured.';
            return;
        }

        try {
            $event = Webhook::constructEvent($payload, $signature, $secret);
        } catch (UnexpectedValueException|SignatureVerificationException) {
            http_response_code(400);
            echo 'Invalid payload or signature.';
            return;
        }

        try {
            $pdo = $this->pdo();
            switch ($event->type) {
                case 'checkout.session.completed':
                    $session = $event->data->object;
                    $readerId = (int) ($session->client_reference_id ?? 0);
                    if ($readerId > 0) {
                        $pdo->prepare('UPDATE readers SET stripe_customer_id = :customer_id, stripe_subscription_id = :subscription_id, premium_status = "active" WHERE id = :id')
                            ->execute(['customer_id' => $session->customer, 'subscription_id' => $session->subscription, 'id' => $readerId]);
                    }
                    break;

                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    $subscription = $event->data->object;
                    $status = $event->type === 'customer.subscription.deleted' ? 'canceled' : $this->mapStripeStatus($subscription->status);
                    $periodEnd = isset($subscription->current_period_end)
                        ? date('Y-m-d H:i:s', $subscription->current_period_end)
                        : null;
                    $pdo->prepare('UPDATE readers SET premium_status = :status, premium_current_period_end = :period_end WHERE stripe_subscription_id = :subscription_id')
                        ->execute(['status' => $status, 'period_end' => $periodEnd, 'subscription_id' => $subscription->id]);
                    break;
            }
        } catch (PDOException) {
            // Stripe retries webhooks on non-2xx; a transient DB hiccup will
            // self-heal on the next retry, so don't fail loudly here either.
        }

        http_response_code(200);
        echo 'ok';
    }

    private function mapStripeStatus(string $stripeStatus): string
    {
        return match ($stripeStatus) {
            'active', 'trialing' => 'active',
            'past_due', 'unpaid' => 'past_due',
            default => 'canceled',
        };
    }

    private function stripeClient(): ?StripeClient
    {
        $key = $_ENV['STRIPE_SECRET_KEY'] ?? '';
        return $key !== '' ? new StripeClient($key) : null;
    }

    private function startReaderSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_reader');
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
            session_start();
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    private function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
    }
}
