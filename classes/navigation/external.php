<?php
namespace local_automation\navigation;

require_once("$CFG->libdir/externallib.php");

use external_function_parameters;
use external_single_structure;
use external_multiple_structure;
use external_value;
use external_api;

class external extends external_api {

    public static function navsearch_parameters() {
    return new external_function_parameters([
        'query' => new external_value(PARAM_TEXT, 'Search query')
    ]);
}

    public static function navsearch($query) {
        $results = helper::search($query);
        return array_map(function($r) {
            return [
                'name' => $r['name'],
                'url' => (string)$r['url']
            ];
        }, $results);
    }

    public static function navsearch_returns() {
        return new external_multiple_structure(
            new external_single_structure([
                'name' => new external_value(PARAM_TEXT, 'Result name'),
                'url' => new external_value(PARAM_URL, 'Result URL'),
            ])
        );
    }
}
