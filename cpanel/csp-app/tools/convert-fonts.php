<?php
// Converts the certificate TTF fonts (SIL OFL) into TCPDF's font format.
// Usage: php tools/convert-fonts.php <directory with the .ttf files>
// The converted files are committed under assets/fonts, so this only needs
// running again if the fonts change.
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

$source = rtrim($argv[1] ?? '', '/\\');
if ($source === '' || !is_dir($source)) {
    fwrite(STDERR, "Usage: php tools/convert-fonts.php <font directory>\n");
    exit(1);
}
$out = dirname(__DIR__) . '/assets/fonts/';
foreach (['Manrope-ExtraBold', 'Manrope-Bold', 'Inter-Regular', 'Inter-SemiBold'] as $name) {
    $ttf = "{$source}/{$name}.ttf";
    if (!is_file($ttf)) {
        fwrite(STDERR, "Missing {$ttf}\n");
        exit(1);
    }
    $family = TCPDF_FONTS::addTTFfont($ttf, 'TrueTypeUnicode', '', 96, $out);
    if ($family === false) {
        fwrite(STDERR, "Could not convert {$name}\n");
        exit(1);
    }
    echo "{$name} -> {$family}\n";
}
