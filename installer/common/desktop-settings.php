<?php
declare(strict_types=1);

// Installer-only, filesystem-only backfill. Existing store and device values
// win over packaged defaults; database configuration is never read or changed.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function lightemDesktopSafePath(string $path): void
{
    if ($path === '' || str_contains($path, "\0")) {
        throw new RuntimeException('Invalid desktop settings path.');
    }
    for ($current = $path; ; $current = dirname($current)) {
        if (is_link($current)) {
            throw new RuntimeException('A desktop settings path is a symbolic link; settings were preserved.');
        }
        if (dirname($current) === $current) break;
    }
}

function lightemDesktopRead(string $file, bool $required): ?string
{
    lightemDesktopSafePath($file);
    if (!file_exists($file) && !$required) return null;
    if (!is_file($file) || ($text = file_get_contents($file)) === false) {
        throw new RuntimeException('Cannot read desktop settings: ' . basename($file));
    }
    return $text;
}

function lightemDesktopTextFields(string $text, string $name): array
{
    $fields = [];
    preg_match_all('/^[ \t]*([A-Za-z][A-Za-z0-9_-]*)[ \t]*:[ \t]*([^\r\n]*)/m', $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
    foreach ($matches as $match) {
        $key = strtoupper($match[1][0]);
        if (isset($fields[$key])) {
            throw new RuntimeException('Duplicate setting in ' . $name . ': ' . $key . '. Review the preserved configuration.');
        }
        $fields[$key] = ['name' => $match[1][0], 'value' => trim($match[2][0]), 'offset' => $match[0][1], 'line' => $match[0][0]];
    }
    return $fields;
}

function lightemDesktopMergeText(string $current, string $defaults, string $name): string
{
    $fields = lightemDesktopTextFields($current, $name);
    // Earlier ip.txt files could contain only an endpoint. Retain it as LOCAL
    // before adding TENANT/WEB so an intentional remote server is not lost.
    if ($name === 'ip.txt' && !isset($fields['LOCAL']) && !isset($fields['WEB']) && !isset($fields['TENANT'])
        && preg_match('~\Ahttps?:[\\\\/]{2}[^\r\n]+\z~i', trim($current))) {
        $current = 'LOCAL: ' . trim($current) . "\n";
        $fields = lightemDesktopTextFields($current, $name);
    }
    $replacements = [];
    $append = [];
    foreach (lightemDesktopTextFields($defaults, $name) as $key => $value) {
        $line = $value['name'] . ': ' . $value['value'];
        if (!isset($fields[$key])) $append[] = $line;
        elseif ($fields[$key]['value'] === '' && $value['value'] !== '') {
            $replacements[] = [$fields[$key]['offset'], strlen($fields[$key]['line']), $line];
        }
    }
    usort($replacements, static fn(array $a, array $b): int => $b[0] <=> $a[0]);
    foreach ($replacements as [$offset, $length, $line]) {
        $current = substr_replace($current, $line, $offset, $length);
    }
    if ($append) {
        $newline = str_contains($current, "\r\n") ? "\r\n" : "\n";
        $current .= ($current !== '' && !str_ends_with($current, "\n") ? $newline : '') . implode($newline, $append) . $newline;
    }
    return $current;
}

function lightemDesktopJson(string $text, string $name): stdClass
{
    try {
        $value = json_decode($text, false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('Invalid JSON in ' . $name . '; review the preserved configuration.');
    }
    if (!$value instanceof stdClass) {
        throw new RuntimeException('Desktop settings must be a JSON object: ' . $name);
    }
    return $value;
}

function lightemDesktopMergeObject(stdClass $current, stdClass $defaults, bool $top = true): stdClass
{
    // An explicitly empty nested object/array can disable a device feature.
    // Preserve it and every existing array, including empty category lists.
    if (!$top && get_object_vars($current) === []) return $current;
    foreach ($defaults as $key => $default) {
        if (!property_exists($current, $key) || $current->$key === null
            || (is_string($current->$key) && trim($current->$key) === '')) {
            $current->$key = $default;
        } elseif ($current->$key instanceof stdClass && $default instanceof stdClass) {
            $current->$key = lightemDesktopMergeObject($current->$key, $default, false);
        }
    }
    return $current;
}

function lightemBackfillDesktopSettings(string $resources, string $defaults): array
{
    foreach ([$resources, $defaults] as $directory) {
        lightemDesktopSafePath($directory);
        if (!is_dir($directory)) throw new RuntimeException('Desktop settings directory is missing.');
    }
    $names = ['ip.txt', 'printer.txt', 'businessInfo.json', 'pos-config.json', 'printer_categories.json'];
    $packaged = $existing = [];
    foreach ($names as $name) {
        $packaged[$name] = lightemDesktopRead($defaults . '/' . $name, true);
        $existing[$name] = lightemDesktopRead($resources . '/' . $name, false);
    }
    // A tenant-specific bundle must not fill another tenant's blank company,
    // terminal or printer details with settings from the build machine.
    $oldTenant = lightemDesktopTextFields(preg_replace('/\A\xEF\xBB\xBF/', '', $existing['ip.txt'] ?? ''), 'ip.txt')['TENANT']['value'] ?? '';
    $newTenant = lightemDesktopTextFields(preg_replace('/\A\xEF\xBB\xBF/', '', $packaged['ip.txt']), 'ip.txt')['TENANT']['value'] ?? '';
    if ($newTenant === '') throw new RuntimeException('The packaged desktop TENANT is missing; settings were preserved.');
    if ($oldTenant !== '' && strcasecmp($oldTenant, $newTenant) !== 0) {
        return ['changed' => [], 'preservedDifferentTenant' => true];
    }
    $changes = [];
    // Plan all files first; malformed JSON/duplicate text settings never leave
    // a partially applied default configuration.
    foreach ($names as $name) {
        $default = preg_replace('/\A\xEF\xBB\xBF/', '', $packaged[$name]);
        $current = $existing[$name] === null ? null : preg_replace('/\A\xEF\xBB\xBF/', '', $existing[$name]);
        if (str_ends_with($name, '.json')) {
            $defaultValue = lightemDesktopJson($default, $name);
            if ($current === null || trim($current) === '') $updated = $default;
            else {
                $currentValue = lightemDesktopJson($current, $name);
                $before = json_encode($currentValue, JSON_THROW_ON_ERROR);
                $merged = lightemDesktopMergeObject($currentValue, $defaultValue);
                $updated = json_encode($merged, JSON_THROW_ON_ERROR) === $before ? $current
                    : json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";
            }
        } else {
            lightemDesktopTextFields($default, $name);
            $updated = $current === null || trim($current) === '' ? $default : lightemDesktopMergeText($current, $default, $name);
        }
        if ($updated !== $current || $current === null) $changes[$name] = $updated;
    }
    foreach ($changes as $name => $contents) {
        $file = $resources . '/' . $name;
        lightemDesktopSafePath($file);
        // Write in place to retain restored Windows file ACLs and Mac ownership.
        if (file_put_contents($file, $contents, LOCK_EX) !== strlen($contents)) {
            throw new RuntimeException('Cannot save desktop settings: ' . $name);
        }
    }
    return ['changed' => array_keys($changes), 'preservedDifferentTenant' => false];
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        $args = getopt('', ['resources:', 'defaults:']);
        foreach (['resources', 'defaults'] as $key) {
            if (!isset($args[$key]) || !is_string($args[$key])) throw new RuntimeException('Missing desktop settings argument: ' . $key);
        }
        echo json_encode(lightemBackfillDesktopSettings($args['resources'], $args['defaults']), JSON_THROW_ON_ERROR) . "\n";
    } catch (Throwable $error) {
        fwrite(STDERR, 'Desktop settings backfill failed: ' . $error->getMessage() . "\n");
        exit(1);
    }
}
