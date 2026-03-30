<?php
require_once(__DIR__ . '/../../config.php');

require_login();

global $DB, $USER;

// ✅ Always return JSON
header('Content-Type: application/json');

try {

    // ✅ SAFE PARAMS (no crash)
    $action = optional_param('action', '', PARAM_ALPHANUMEXT);
    $courseid = optional_param('courseid', 0, PARAM_INT);

    if (!$action || !$courseid) {
        echo json_encode(['error' => 'Missing action or courseid']);
        exit;
    }

    switch ($action) {

        /* ================= GET STUDENTS ================= */
        case  'toggle_lock':

            $studentid = required_param('studentid', PARAM_INT);
            $courseid = required_param('courseid', PARAM_INT);
            $difficulty = required_param('difficulty', PARAM_TEXT);
            $locked = required_param('locked', PARAM_INT);

            $record = $DB->get_record('local_automation_quiz_lock', [
                'studentid'=>$studentid,
                'courseid'=>$courseid,
                'difficulty'=>$difficulty
            ]);

            if ($record) {
                $record->locked = $locked;
                $record->timemodified = time();
                $DB->update_record('local_automation_quiz_lock', $record);
            } else {
                $record = new stdClass();
                $record->studentid = $studentid;
                $record->courseid = $courseid;
                $record->difficulty = $difficulty;
                $record->locked = $locked;
                $record->timecreated = time();
                $record->timemodified = time();

                $DB->insert_record('local_automation_quiz_lock', $record);
            }

            echo json_encode(['status'=>'ok']);
                case 'get_students':

                    $context = context_course::instance($courseid);

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

        case 'get_locks':

            $studentid = required_param('studentid', PARAM_INT);
            $courseid = required_param('courseid', PARAM_INT);

            $records = $DB->get_records('local_automation_quiz_lock', [
                'studentid'=>$studentid,
                'courseid'=>$courseid
            ]);

            echo json_encode(array_values($records));
            exit;   
        /* ================= CHAT HISTORY ================= */
        case 'get_student_chat':

            $studentid = required_param('studentid', PARAM_INT);

            $records = $DB->get_records(
                'local_automation_student_chat',
                [
                    'studentid' => $studentid,
                    'courseid' => $courseid
                ],
                'timecreated ASC'
            );

            echo json_encode($records ? array_values($records) : []);
            break;


        /* ================= MESSAGES ================= */
        case 'get_messages':

            $studentid = required_param('studentid', PARAM_INT);

            $messages = $DB->get_records(
                'local_automation_messages',
                [
                    'studentid'=>$studentid,
                    'courseid'=>$courseid
                ],
                'timecreated ASC'
            );

            echo json_encode($messages ? array_values($messages) : []);
            break;


        /* ================= SEND MESSAGE ================= */
        case 'send_message':

            $record = new stdClass();
            $record->courseid = required_param('courseid', PARAM_INT);
            $record->studentid = required_param('studentid', PARAM_INT);
            $record->senderid = $USER->id;
            $record->message = required_param('message', PARAM_TEXT);
            $record->timecreated = time();

            $DB->insert_record('local_automation_messages', $record);

            echo json_encode(['status'=>'ok']);
            break;


        /* ================= STUDENT QUIZ ================= */
        case 'get_student_quiz':

            $studentid = required_param('studentid', PARAM_INT);

            $records = $DB->get_records(
                'local_automation_student_quiz',
                [
                    'studentid' => $studentid,
                    'courseid' => $courseid
                ],
                'timecreated DESC'
            );

            echo json_encode($records ? array_values($records) : []);
            break;


        /* ================= ALL STUDENTS QUIZ ================= */
        case 'get_all_students_quiz':

            $records = $DB->get_records(
                'local_automation_student_quiz',
                ['courseid' => $courseid],
                'timecreated DESC'
            );

            echo json_encode($records ? array_values($records) : []);
            break;


        /* ================= SAVE ADVICE ================= */
        case 'save_advice':

            $record = new stdClass();
            $record->studentid = required_param('studentid', PARAM_INT);
            $record->courseid = required_param('courseid', PARAM_INT);
            $record->advice = required_param('advice', PARAM_TEXT);
            $record->teacherid = $USER->id;
            $record->timecreated = time();

            $DB->insert_record('local_automation_advice', $record);

            echo json_encode(['status'=>'ok']);
            break;


        /* ================= GET ADVICE ================= */
        case 'get_advice':

            $studentid = required_param('studentid', PARAM_INT);

            $records = $DB->get_records(
                'local_automation_advice',
                [
                    'studentid'=>$studentid,
                    'courseid'=>$courseid
                ],
                'timecreated DESC'
            );

            echo json_encode($records ? array_values($records) : []);
            break;


        /* ================= DEFAULT ================= */
        default:
            echo json_encode(['error' => 'Invalid action']);
    }

} catch (Exception $e) {

    // ✅ CRITICAL: always return JSON error (no HTML page)
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage()
    ]);
}