<?php
defined('MOODLE_INTERNAL') || die();


function local_automation_extend_navigation(global_navigation $nav) {
    global $PAGE, $USER, $COURSE, $DB;

        // Only inject after page URL is fully set
        if (!$PAGE->has_set_url()) {
            return;
        }

        static $injected = false;
        if ($injected) {
            return;
        }
        $injected = true;

    // Keep CSS
    $PAGE->requires->css('/local/automation/style/chatbot.css');

    // Detect role
    $role = 'teacher';

    // Get all role shortnames for this user
    $sql = "SELECT r.shortname
            FROM {role_assignments} ra
            JOIN {role} r ON r.id = ra.roleid
            WHERE ra.userid = :userid";

    $roles = $DB->get_fieldset_sql($sql, ['userid' => $USER->id]);

    if (in_array('student', $roles)) {
        $role = 'student';
    }

    $config = [
        'role' => $role,
        'currentcourseid' => $COURSE->id ?? 0,
        'democourseid' => get_config('local_automation', 'student_ai_courseid')
    ];

    error_log('CONFIG JSON: ' . json_encode($config));

    // Pass config to JS
    $PAGE->requires->js_call_amd(
        'local_automation/chatbot',
        'init',
        $config
    );

    // Keep navigation JS
    $PAGE->requires->css('/local/automation/style/navigation.css');
    $PAGE->requires->js_call_amd('local_automation/navigation', 'init');
}
