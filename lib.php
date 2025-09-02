<?php
defined('MOODLE_INTERNAL') || die();

function local_automation_extend_navigation(global_navigation $nav) {
    global $PAGE;
    $PAGE->requires->css('/local/automation/style/navigation.css');
    $PAGE->requires->js_call_amd('local_automation/navigation', 'init');
}

