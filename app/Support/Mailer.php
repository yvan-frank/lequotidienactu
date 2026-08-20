<?php
declare(strict_types=1);

namespace App\Support;

use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;

final class Mailer
{
    /**
     * Sends a plain-text email via SMTP. Never throws — on failure it logs
     * and returns the reason, so a mail outage never breaks the request that
     * triggered it while still letting diagnostic callers see what broke.
     *
     * @param array{email: string, name?: string}|null $replyTo
     * @param string|null $profile Selects an alternate SMTP identity — e.g.
     *   'NEWSLETTER' reads MAIL_USERNAME_NEWSLETTER/MAIL_PASSWORD_NEWSLETTER/
     *   MAIL_FROM_NEWSLETTER/MAIL_FROM_NAME_NEWSLETTER instead of the base
     *   MAIL_* vars (falling back to the base vars for anything not set).
     *   Host/port/encryption are always shared — only the mailbox differs.
     * @return array{success: bool, error: ?string}
     */
    public static function send(string $to, string $toName, string $subject, string $body, ?array $replyTo = null, ?string $profile = null): array
    {
        return self::dispatch($to, $toName, $subject, $body, null, $replyTo, $profile);
    }

    /**
     * Sends a branded HTML email with a plain-text fallback via SMTP.
     * Never throws, same contract as send().
     *
     * @param array{email: string, name?: string}|null $replyTo
     * @return array{success: bool, error: ?string}
     */
    public static function sendHtml(string $to, string $toName, string $subject, string $html, string $text, ?array $replyTo = null, ?string $profile = null): array
    {
        return self::dispatch($to, $toName, $subject, $html, $text, $replyTo, $profile);
    }

    /**
     * @param array{email: string, name?: string}|null $replyTo
     * @return array{success: bool, error: ?string}
     */
    private static function dispatch(string $to, string $toName, string $subject, string $body, ?string $altText, ?array $replyTo = null, ?string $profile = null): array
    {
        $mail = new PHPMailer(true);
        try {
            $host = $_ENV['MAIL_HOST'] ?? '';
            if ($host === '') {
                $error = 'MAIL_HOST est vide : configurez les variables MAIL_* dans le fichier .env.';
                Logger::error('Mailer: ' . $error, ['to' => $to]);
                return ['success' => false, 'error' => $error];
            }

            $suffix = $profile !== null && $profile !== '' ? '_' . strtoupper($profile) : '';
            $username = $_ENV['MAIL_USERNAME' . $suffix] ?? $_ENV['MAIL_USERNAME'] ?? '';
            $password = $_ENV['MAIL_PASSWORD' . $suffix] ?? $_ENV['MAIL_PASSWORD'] ?? '';

            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = (int) ($_ENV['MAIL_PORT'] ?? 587);
            $mail->SMTPAuth = true;
            $mail->Username = $username;
            $mail->Password = $password;
            $encryption = strtolower((string) ($_ENV['MAIL_ENCRYPTION'] ?? 'tls'));
            $mail->SMTPSecure = match ($encryption) {
                'ssl' => PHPMailer::ENCRYPTION_SMTPS,
                'none', '' => '',
                default => PHPMailer::ENCRYPTION_STARTTLS,
            };
            if ($encryption === 'none' || $encryption === '') {
                $mail->SMTPAutoTLS = false;
            }
            $mail->CharSet = 'UTF-8';

            $fromAddress = $_ENV['MAIL_FROM' . $suffix] ?? $_ENV['MAIL_FROM'] ?? ('no-reply@' . parse_url(Config::baseUrl(), PHP_URL_HOST));
            $fromName = $_ENV['MAIL_FROM_NAME' . $suffix] ?? $_ENV['MAIL_FROM_NAME'] ?? ($_ENV['APP_NAME'] ?? 'Le Quotidien Actu');
            $mail->setFrom($fromAddress, $fromName);
            $mail->addAddress($to, $toName);
            if ($replyTo !== null) {
                $mail->addReplyTo($replyTo['email'], $replyTo['name'] ?? '');
            }
            $mail->Subject = $subject;
            if ($altText !== null) {
                $mail->isHTML(true);
                $mail->Body = $body;
                $mail->AltBody = $altText;
            } else {
                $mail->isHTML(false);
                $mail->Body = $body;
            }

            $mail->send();
            return ['success' => true, 'error' => null];
        } catch (PHPMailerException $e) {
            Logger::error('Mailer: failed to send', ['to' => $to, 'error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
