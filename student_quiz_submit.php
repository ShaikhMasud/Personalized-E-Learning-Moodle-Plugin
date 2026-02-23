<?php
require_once('../../config.php');

require_login();
require_sesskey();

global $DB, $USER;

$courseid   = required_param('courseid', PARAM_INT);
$total      = required_param('totalquestions', PARAM_INT);
$difficulty = required_param('difficulty', PARAM_ALPHA);
$topics     = optional_param_array('topics', [], PARAM_TEXT);


if (!isset($_SESSION['ai_quiz_data'])) {
    redirect(
        new moodle_url('/course/view.php', ['id' => $courseid]),
        "Quiz session expired."
    );
}

$quizData = $_SESSION['ai_quiz_data'];

$score = 0;

// Loop through questions
for ($i = 0; $i < $total; $i++) {

    $studentAnswer = optional_param("q$i", '', PARAM_INT);

    if (!isset($quizData[$i])) {
        continue;
    }

    $correctAnswer = $quizData[$i]['answer_index'];

    if ((int)$studentAnswer === (int)$correctAnswer) {
        $score++;
    }
}

// Clear session quiz
unset($_SESSION['ai_quiz_data']);

// Convert topics array into string
$topicstring = !empty($topics) ? implode(', ', $topics) : 'General';

// Recommendation logic
if ($score == $total) {
    $recommendation = 'Excellent performance!';
} elseif ($score >= ($total / 2)) {
    $recommendation = 'Good attempt. Revise weak areas.';
} else {
    $recommendation = 'Needs improvement. Review fundamentals.';
}

// Save to DB
$record = new stdClass();
$record->studentid = $USER->id;
$record->courseid = $courseid;
$record->topic = $topicstring;
$record->score = $score;
$record->total = $total;
$record->difficulty = $difficulty;
$record->recommendation = $recommendation;
$record->timecreated = time();

$DB->insert_record('local_automation_student_quiz', $record);

redirect(
    new moodle_url('/course/view.php', ['id' => $courseid]),
    "Quiz submitted! Score: $score / $total"
);