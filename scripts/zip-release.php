<?php
// Zips folders (dotfiles included) for the cPanel release.
//   php scripts/zip-release.php <base dir> <zip path> <folder>...
declare(strict_types=1);

[, $base, $zipPath] = $argv;
$folders = array_slice($argv, 3);
$base = rtrim(str_replace('\\', '/', realpath($base)), '/');

$zip = new ZipArchive();
if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Cannot create $zipPath\n");
    exit(1);
}
$count = 0;
foreach ($folders as $folder) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$base/$folder", FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        $path = str_replace('\\', '/', $file->getPathname());
        $zip->addFile($path, substr($path, strlen($base) + 1));
        $count++;
    }
}
$zip->close();
echo "Wrote $zipPath ($count files)\n";
