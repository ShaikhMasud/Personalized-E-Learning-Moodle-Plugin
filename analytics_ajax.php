<?php
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

global $DB;

$action = required_param('action', PARAM_ALPHANUMEXT);
$courseid = required_param('courseid', PARAM_INT);

header('Content-Type: application/json');

switch ($action) {

    // ===== Get enrolled students =====
    case 'get_students':

        $context = context_course::instance($courseid);

        // Get student role id
        $studentrole = $DB->get_record('role', ['shortname' => 'student']);

        if (!$studentrole) {
            echo json_encode([]);
            exit;
        }

        $students = get_role_users(
            $studentrole->id,
            $context,
            false,
            'u.id, u.firstname, u.lastname'
        );

        echo json_encode(array_values($students));
        break;


    // ===== Get chat history of specific student =====
    case 'get_student_chat':

        $studentid = required_param('studentid', PARAM_INT);

        $records = $DB->get_records(
            'local_automation_student_chat',
            ['studentid' => $studentid, 'courseid' => $courseid],
            'timecreated ASC'
        );

        echo json_encode(array_values($records));
        break;


    // ===== Get quiz attempts of specific student =====
    case 'get_student_quiz':

        $studentid = required_param('studentid', PARAM_INT);

        $records = $DB->get_records(
            'local_automation_student_quiz',
            ['studentid' => $studentid, 'courseid' => $courseid],
            'timecreated DESC'
        );

        echo json_encode(array_values($records));
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
}