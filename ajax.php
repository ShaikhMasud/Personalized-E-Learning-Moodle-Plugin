<?php
// local/automation/ajax.php (debug variant - only use in dev)
require_once(__DIR__ . '/../../config.php');

require_login();

$raw = optional_param('query', '', PARAM_RAW);
$query = trim($raw);

try {
    if ($query === '') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([]);
        exit;
    }

    require_once(__DIR__ . '/classes/navigation/helper.php');

    // call the helper and capture results
    $results = \local_automation\navigation\helper::search($query);

    $out = array_map(function($r) {
        return [
            'name' => $r['name'],
            'url'  => (string)$r['url']
        ];
    }, $results);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($out);
    exit;

} catch (Throwable $ex) {
    // Return JSON with debugging info (dev only)
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    $data = [
        'error' => $ex->getMessage(),
        'class' => get_class($ex),
        'file' => $ex->getFile(),
        'line' => $ex->getLine(),
        'trace' => $ex->getTraceAsString()
    ];

    // Also log to PHP error log for review
    error_log('local_automation.ajax error: ' . $ex->getMessage());
    error_log($ex->getTraceAsString());

    echo json_encode($data);
    exit;
}
