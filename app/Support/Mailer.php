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
     * @return array{success: bool, error: ?string}
     */
    public static function send(string $to, string $toName, string $subject, string $body): array
    {
        $mail = new PHPMailer(true);
        try {
            $host = $_ENV['MAIL_HOST'] ?? '';
            if ($host === '') {
                $error = 'MAIL_HOST est vide : configurez les variables MAIL_* dans le fichier .env.';
                error_log('Mailer: ' . $error . ' (destinataire : ' . $to . ')');
                return ['success' => false, 'error' => $error];
            }

            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = (int) ($_ENV['MAIL_PORT'] ?? 587);
            $mail->SMTPAuth = true;
            $mail->Username = $_ENV['MAIL_USERNAME'] ?? '';
            $mail->Password = $_ENV['MAIL_PASSWORD'] ?? '';
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

            $fromAddress = $_ENV['MAIL_FROM'] ?? ('no-reply@' . parse_url(Config::baseUrl(), PHP_URL_HOST));
            $fromName = $_ENV['MAIL_FROM_NAME'] ?? ($_ENV['APP_NAME'] ?? 'Le Quotidien Actu');
            $mail->setFrom($fromAddress, $fromName);
            $mail->addAddress($to, $toName);
            $mail->Subject = $subject;
            $mail->Body = $body;
            $mail->isHTML(false);

            $mail->send();
            return ['success' => true, 'error' => null];
        } catch (PHPMailerException $e) {
            error_log('Mailer: failed to send to ' . $to . ': ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
