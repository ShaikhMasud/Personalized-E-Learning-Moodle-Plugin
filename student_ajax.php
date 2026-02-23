<?php
require_once(__DIR__ . '/../../config.php');

require_login();
require_sesskey();

global $DB, $USER;

$action = required_param('action', PARAM_ALPHANUMEXT);
$courseid = required_param('courseid', PARAM_INT);

header('Content-Type: application/json');

error_log("STUDENT AJAX CALLED");

switch ($action) {

    // ===== Save chat message =====
    case 'save_message':

        $message = required_param('message', PARAM_RAW);
        $sender  = required_param('sender', PARAM_ALPHA);

        $record = new stdClass();
        $record->studentid = $USER->id;
        $record->courseid = $courseid;
        $record->message = $message;
        $record->sender = $sender;
        $record->timecreated = time();

        $DB->insert_record('local_automation_student_chat', $record);

        echo json_encode([
            'status' => 'success',
            'timecreated' => $record->timecreated
        ]);
        break;


    // ===== Fetch chat history =====
    case 'fetch_history':

        $records = $DB->get_records(
            'local_automation_student_chat',
            ['studentid' => $USER->id, 'courseid' => $courseid],
            'timecreated ASC'
        );

        echo json_encode(array_values($records));
        break;


    // ===== Insert dummy mini quiz =====
    case 'insert_dummy_quiz':

        $record = new stdClass();
        $record->studentid = $USER->id;
        $record->courseid = $courseid;
        $record->topic = 'Demo Topic';
        $record->score = rand(2, 5);
        $record->total = 5;
        $record->difficulty = 'medium';
        $record->recommendation = 'Revise core concepts.';
        $record->timecreated = time();

        $DB->insert_record('local_automation_student_quiz', $record);

        echo json_encode(['status' => 'quiz_inserted']);
        break;

    case 'ask_rag':

        $question = required_param('question', PARAM_RAW);

        $url = 'http://127.0.0.1:8000/ask';

        $data = json_encode(['question' => $question]);

        $options = [
            'http' => [
                'header'  => "Content-type: application/json\r\n",
                'method'  => 'POST',
                'content' => $data,
                'timeout' => 30
            ]
        ];

        $context = stream_context_create($options);
        $result = file_get_contents($url, false, $context);

        if ($result === FALSE) {
            echo json_encode(['ok' => false, 'error' => 'FastAPI server not reachable']);
            break;
        }

        echo $result;
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
}