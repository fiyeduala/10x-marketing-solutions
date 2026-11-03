<?php
declare(strict_types=1);

namespace Csp;

/**
 * Landscape A4 certificate, generated on request from the issued record, with
 * the same layout as the Vercel version. Fonts are SIL OFL (licences in
 * assets/fonts), converted for TCPDF by tools/convert-fonts.php.
 *
 * Coordinates below are written as in the original (origin bottom-left, y
 * up) and flipped for TCPDF, whose origin is the top-left.
 */

const CERT_FONTS = ['heading' => 'manropeextrab', 'headingBold' => 'manropeb', 'body' => 'inter', 'bodySemi' => 'intersemib'];

const CERT_COLOURS = [
    'ink' => [0x10, 0x17, 0x19],
    'muted' => [0x58, 0x64, 0x69],
    'teal' => [0x39, 0xb2, 0xac],
    'tealInk' => [0x1a, 0x75, 0x71],
    'yellow' => [0xff, 0xd0, 0x44],
    'rule' => [0xdf, 0xe4, 0xe1],
];

function cert_font_file(string $font): string
{
    return CSP_APP_DIR . '/assets/fonts/' . $font . '.php';
}

/**
 * Characters in a name that the certificate font cannot draw. Registration
 * rejects these so a certificate never shows blank boxes.
 * @return string[]
 */
function unsupported_name_characters(string $name): array
{
    static $charset = null;
    if ($charset === null) {
        $cw = (static function (string $file): array {
            include $file;
            return $cw ?? [];
        })(cert_font_file(CERT_FONTS['bodySemi']));
        $charset = $cw;
    }
    $name = class_exists(\Normalizer::class) ? (string) \Normalizer::normalize($name, \Normalizer::FORM_C) : $name;
    $bad = [];
    foreach (mb_str_split($name) as $ch) {
        $cp = mb_ord($ch, 'UTF-8');
        if ($cp !== 0x20 && !isset($charset[$cp])) $bad[$ch] = true;
    }
    return array_keys($bad);
}

function format_score(float $score): string
{
    return rtrim(rtrim(number_format($score, 2, '.', ''), '0'), '.') . '%';
}

function format_issue_date(string $iso): string
{
    return (new \DateTimeImmutable($iso))->setTimezone(new \DateTimeZone('Africa/Lagos'))->format('j F Y');
}

final class CertificateCanvas
{
    public readonly float $W;
    public readonly float $H;

    public function __construct(public readonly \TCPDF $pdf)
    {
        $this->W = $pdf->getPageWidth();
        $this->H = $pdf->getPageHeight();
    }

    public function width(string $text, string $font, float $size): float
    {
        return $this->pdf->GetStringWidth($text, CERT_FONTS[$font], '', $size);
    }

    /** Draws text with its baseline at $y (measured from the bottom). */
    public function text(string $text, float $x, float $y, string $font, float $size, string $colour): void
    {
        $this->pdf->SetFont(CERT_FONTS[$font], '', $size);
        $this->pdf->SetTextColorArray(CERT_COLOURS[$colour]);
        $this->pdf->SetXY($x, $this->H - $y);
        $this->pdf->Cell(0, 0, $text, 0, 0, 'L', false, '', 0, false, 'L', 'M');
    }

    public function centred(string $text, string $font, float $size, float $y, string $colour = 'ink'): void
    {
        $this->text($text, ($this->W - $this->width($text, $font, $size)) / 2, $y, $font, $size, $colour);
    }

    public function rightAligned(string $text, float $right, float $y, string $font, float $size, string $colour): void
    {
        $this->text($text, $right - $this->width($text, $font, $size), $y, $font, $size, $colour);
    }

    /** @return string[] */
    public function wrap(string $text, string $font, float $size, float $maxWidth): array
    {
        $lines = [];
        $line = '';
        foreach (preg_split('/\s+/u', $text) as $word) {
            $next = $line === '' ? $word : "{$line} {$word}";
            if ($line !== '' && $this->width($next, $font, $size) > $maxWidth) {
                $lines[] = $line;
                $line = $word;
            } else {
                $line = $next;
            }
        }
        if ($line !== '') $lines[] = $line;
        return $lines;
    }

    /** Breaks a URL after "/" (or mid-segment if one segment is too long). @return string[] */
    public function wrapUrl(string $url, string $font, float $size, float $maxWidth): array
    {
        $lines = [];
        $line = '';
        foreach (preg_split('#(?<=/)#', $url, -1, PREG_SPLIT_NO_EMPTY) as $part) {
            if ($line !== '' && $this->width($line . $part, $font, $size) > $maxWidth) {
                $lines[] = $line;
                $line = '';
            }
            foreach (mb_str_split($part) as $ch) {
                if ($line !== '' && $this->width($line . $ch, $font, $size) > $maxWidth) {
                    $lines[] = $line;
                    $line = '';
                }
                $line .= $ch;
            }
        }
        if ($line !== '') $lines[] = $line;
        return $lines;
    }
}

/**
 * @param array{certificateNumber:string,recipientName:string,certificateTitle:string,scorePercentage:float,issuedAt:string,verifyUrl:string} $data
 * @return string PDF bytes
 */
function render_certificate_pdf(array $data): string
{
    $pdf = new \TCPDF('L', 'pt', 'A4', true, 'UTF-8', false);
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(false);
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetAutoPageBreak(false, 0);
    $pdf->setCellPaddings(0, 0, 0, 0);
    $pdf->setFontSubsetting(true);
    $pdf->SetTitle("{$data['certificateTitle']} – {$data['recipientName']}");
    $pdf->SetAuthor('10X Marketing Solutions');
    $pdf->SetSubject(ASSESSMENT_NAME . " – {$data['certificateNumber']}");
    $pdf->SetCreator('10X Marketing Solutions');
    $pdf->setDocCreationTimestamp((new \DateTimeImmutable($data['issuedAt']))->getTimestamp());
    foreach (CERT_FONTS as $font) $pdf->AddFont($font, '', cert_font_file($font));
    $pdf->AddPage();

    $c = new CertificateCanvas($pdf);
    $W = $c->W;
    $H = $c->H;

    // Frame
    $pdf->Rect(22, 22, $W - 44, $H - 44, 'D', ['all' => ['width' => 1, 'color' => CERT_COLOURS['rule']]]);
    $pdf->Rect(22, 22, 10, $H - 44, 'F', [], CERT_COLOURS['teal']);
    $pdf->Rect(32, 22, 4, $H - 44, 'F', [], CERT_COLOURS['yellow']);

    // Header
    $logo = CSP_APP_DIR . '/assets/logo.png';
    [$lw, $lh] = getimagesize($logo);
    $logoH = 56;
    $pdf->Image($logo, 64, 64, $lw / $lh * $logoH, $logoH, 'PNG');
    $c->rightAligned('CERTIFICATE NO.', $W - 64, $H - 82, 'body', 8, 'muted');
    $c->rightAligned($data['certificateNumber'], $W - 64, $H - 98, 'bodySemi', 11, 'ink');

    // Title
    $c->centred('Certificate of Competency', 'heading', 30, $H - 180);
    $c->centred('in Customer Support', 'headingBold', 15, $H - 204, 'tealInk');
    $c->centred('This certifies that', 'body', 13, $H - 252, 'muted');

    // Recipient name, shrunk to fit
    $name = class_exists(\Normalizer::class) ? (string) \Normalizer::normalize($data['recipientName'], \Normalizer::FORM_C) : $data['recipientName'];
    $size = 36;
    while ($size > 18 && $c->width($name, 'bodySemi', $size) > $W - 220) $size -= 1;
    $c->centred($name, 'bodySemi', $size, $H - 300);
    $pdf->Line($W / 2 - 200, 316, $W / 2 + 200, 316, ['width' => 1, 'color' => CERT_COLOURS['rule']]);

    $statement = 'has passed the ' . ASSESSMENT_NAME . ', a timed assessment of customer support knowledge '
        . 'and professional judgment, with a score of ' . format_score($data['scorePercentage']) . '.';
    foreach ($c->wrap($statement, 'body', 12.5, 560) as $i => $line) $c->centred($line, 'body', 12.5, $H - 348 - $i * 19);

    // Footer row
    $baseY = 112;
    $c->text('DATE OF ISSUE', 64, $baseY + 30, 'body', 8, 'muted');
    $c->text(format_issue_date($data['issuedAt']), 64, $baseY + 12, 'bodySemi', 12, 'ink');
    $c->text('ISSUED BY', 250, $baseY + 30, 'body', 8, 'muted');
    $c->text('10X Marketing Solutions', 250, $baseY + 12, 'bodySemi', 12, 'ink');

    $qrSize = 84;
    $qrX = $W - 64 - $qrSize;
    $pdf->write2DBarcode($data['verifyUrl'], 'QRCODE,M', $qrX, $H - ($baseY - 16) - $qrSize, $qrSize, $qrSize, [
        'border' => false, 'padding' => 0, 'fgcolor' => CERT_COLOURS['ink'], 'bgcolor' => false,
    ], 'N');
    // Right-aligned beside the QR code, kept clear of the "Issued by" column.
    $right = $qrX - 14;
    $maxWidth = $right - (250 + $c->width('10X Marketing Solutions', 'bodySemi', 12) + 28);
    $c->rightAligned('VERIFY THIS CERTIFICATE', $right, $baseY + 44, 'body', 8, 'muted');
    foreach ($c->wrapUrl((string) preg_replace('#^https?://#', '', $data['verifyUrl']), 'body', 8, $maxWidth) as $i => $line) {
        $c->rightAligned($line, $right, $baseY + 30 - $i * 11, 'body', 8, 'tealInk');
    }

    $note = 'Awarded by 10X Marketing Solutions to ' . $name . ' for successfully completing the ' . ASSESSMENT_NAME . '. '
        . 'The authenticity and current status of this certificate can be confirmed by scanning the QR code or visiting the verification link.';
    foreach ($c->wrap($note, 'body', 7.5, $W - 128) as $i => $line) $c->text($line, 64, 58 - $i * 11, 'body', 7.5, 'muted');

    return $pdf->Output('certificate.pdf', 'S');
}
