<?php
require_once('../../config.php');

$courseid = required_param('courseid', PARAM_INT);

// MUST be first
require_login($courseid);

$context = context_course::instance($courseid);

$PAGE->set_url('/local/automation/student_quiz.php', ['courseid' => $courseid]);
$PAGE->set_context($context);
$PAGE->set_title('Mini Quiz');
$PAGE->set_heading('Mini Quiz');
$PAGE->set_pagelayout('standard');

// Load AMD JS
$PAGE->requires->js_call_amd(
    'local_automation/student_quiz',
    'init',
    [
        'courseid' => $courseid
    ]
);

// Only now start output
echo $OUTPUT->header();
?>

<h3>Generate Quiz</h3>

<!-- <div>
    <label>Select Units (max 3)</label><br>
    <select id="unitContainer" multiple style="width:300px; height:120px;"></select>
</div> -->

<div style="height:350px; overflow-y:auto; border:1px solid #ccc; padding:10px;">
    <div id="unitContainer"></div>
</div>

<br>

<div>
    <label>Number of Questions</label><br>
    <input type="number" id="questionCount" min="1" max="10" value="5">
</div>

<br>

<div>
    <label>Difficulty</label><br>
    <select id="difficulty">
        <option value="easy">Easy</option>
        <option value="medium" selected>Medium</option>
        <option value="hard">Hard</option>
    </select>
</div>

<br>

<button id="generateQuizBtn">Generate Quiz</button>

<hr>

<div id="quizContainer"></div>

<?php
echo $OUTPUT->footer();