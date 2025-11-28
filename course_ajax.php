<?php
// local/automation/course_ajax.php
// Creates a Moodle course + auto sections. Defensive & JSON-safe.

define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');

// Do NOT enable display_errors here — it will corrupt JSON responses.
// Use error_log() to record details for debugging.
@error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
@ini_set('display_errors', 0);

require_login();
$PAGE->set_context(null); // avoid interfering with php://input

header('Content-Type: application/json; charset=utf-8');

// Read raw JSON body
$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No payload provided']);
    exit;
}

$payload = json_decode($raw, true);
if ($payload === null) {
    // Log raw payload for debugging
    error_log('local_automation: invalid JSON payload: ' . substr($raw, 0, 1000));
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// Extract expected fields
$fullname  = trim($payload['fullname'] ?? '');
$shortname = trim($payload['shortname'] ?? '');
$categoryid = (int)($payload['category'] ?? 1);   // fallback to id 1
$sectionsraw = $payload['sections'] ?? [];
$sections = [];
$idx = 0;
foreach ($sectionsraw as $entry) {
    $idx++;
    if (is_array($entry)) {
        if (isset($entry['name'])) {
            $sections[] = (string)$entry['name'];
        } elseif (isset($entry['title'])) {
            $sections[] = (string)$entry['title'];
        } else {
            $sections[] = 'Section ' . $idx;
        }
    } else {
        $sections[] = (string)$entry;
    }
}

// Sesskey check (sesskey is expected inside JSON)
$sesskey = $payload['sesskey'] ?? null;
if ($sesskey === null || !confirm_sesskey($sesskey)) {
    error_log('local_automation: invalid sesskey for user ' . (isloggedin() ? $USER->id : 0));
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Invalid session key']);
    exit;
}

// Basic validation
if ($fullname === '' || $shortname === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'fullname and shortname are required']);
    exit;
}

if (!is_array($sections) || count($sections) === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'At least one section is required']);
    exit;
}

require_once($CFG->dirroot . '/course/lib.php');
global $DB;

try {
    // Ensure shortname is unique — if collision, append suffix
    $base = $shortname;
    $suffix = 0;
    while ($DB->record_exists('course', ['shortname' => $shortname])) {
        $suffix++;
        $shortname = $base . '_' . $suffix;
        if ($suffix > 1000) {
            throw new Exception('Could not generate unique shortname');
        }
    }

    // Build course object
    $course = new stdClass();
    $course->fullname  = $fullname;
    $course->shortname = $shortname;
    $course->category  = $categoryid;
    $course->format    = 'topics';

    // 1) Create the course
    $created = create_course($course);
    $courseid = (int)$created->id;

    // 2) BEST-EFFORT: sections (this must NOT break course creation)
    $numsections = count($sections);

    try {
        // Let Moodle create any missing sections if it supports this helper
        if ($numsections > 0 && function_exists('course_create_sections_if_missing')) {
            course_create_sections_if_missing($courseid, range(1, $numsections));
        }

        // Manually ensure rows exist
        for ($i = 1; $i <= $numsections; $i++) {
            $existing = $DB->get_record('course_sections', [
                'course'  => $courseid,
                'section' => $i
            ]);

            if (!$existing) {
                $newsection = new stdClass();
                $newsection->course         = $courseid;
                $newsection->section        = $i;
                $newsection->name           = '';
                $newsection->summary        = '';
                $newsection->summaryformat  = 1;
                $newsection->visible        = 1;
                $DB->insert_record('course_sections', $newsection);
            }
        }

        // Rename sections to requested names
        for ($i = 1; $i <= $numsections; $i++) {
            if (!isset($sections[$i - 1])) {
                continue;
            }
        
            $sectionrec = $DB->get_record('course_sections', [
                'course'  => $courseid,
                'section' => $i
            ], 'id');
        
            if ($sectionrec) {
                $DB->set_field(
                    'course_sections',
                    'name',
                    $sections[$i - 1],
                    ['id' => $sectionrec->id]
                );
            }
        }

    } catch (Throwable $sectionex) {
        // Log but DO NOT fail the whole request
        error_log('local_automation: section handling error: ' . $sectionex->getMessage());
    }

    // 3) ENROL CURRENT USER AS TEACHER (so course shows in "My courses")
    try {
        require_once($CFG->dirroot . '/enrol/manual/lib.php');
        require_once($CFG->dirroot . '/lib/enrollib.php');

        // Get the 'editingteacher' role id
        $role = $DB->get_record('role', ['shortname' => 'editingteacher']);
        if ($role) {
            $teacherroleid = $role->id;

            // Find manual enrolment instance in this course
            $instances = enrol_get_instances($courseid, true);
            $manualinstance = null;
            foreach ($instances as $instance) {
                if ($instance->enrol === 'manual') {
                    $manualinstance = $instance;
                    break;
                }
            }

            if ($manualinstance) {
                $enrol = enrol_get_plugin('manual');
                if ($enrol) {
                    $enrol->enrol_user($manualinstance, $USER->id, $teacherroleid);
                }
            }
        }
    } catch (Throwable $enrolex) {
        // Log enrolment issues but don't break course creation
        error_log('local_automation: enrolment error: ' . $enrolex->getMessage());
    }

    // 4) Rebuild cache
    rebuild_course_cache($courseid, true);

    // 5) Return success
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'courseid' => $courseid,
        'message' => 'Course created successfully',
        'shortname_used' => $shortname
    ]);
    exit;

} catch (Throwable $ex) {
    error_log('local_automation: create course error: ' . $ex->getMessage() . ' | payload: ' . substr(json_encode($payload), 0, 2000));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to create course: ' . $ex->getMessage()
    ]);
    exit;

}
