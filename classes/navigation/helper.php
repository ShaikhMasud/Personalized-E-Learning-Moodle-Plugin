<?php
namespace local_automation\navigation;

defined('MOODLE_INTERNAL') || die();

class helper {
    public static function search($query) {
        global $DB;

        $results = [];

        // Search courses
        $courses = $DB->get_records_select('course', "fullname LIKE :q OR shortname LIKE :q", ['q' => "%$query%"], '', 'id, fullname');
        foreach ($courses as $c) {
            $results[] = [
                'name' => "Course: " . $c->fullname,
                'url' => new \moodle_url('/course/view.php', ['id' => $c->id])
            ];
        }

        // Search sections
        $sections = $DB->get_records_sql("
            SELECT cs.id, cs.name, cs.section, c.id AS courseid, c.fullname
              FROM {course_sections} cs
              JOIN {course} c ON cs.course = c.id
             WHERE cs.name LIKE :q
        ", ['q' => "%$query%"]);
            
        foreach ($sections as $s) {
            $results[] = [
                'name' => "Section: {$s->name} ({$s->fullname})",
                'url'  => new \moodle_url('/course/view.php', ['id' => $s->courseid, 'section' => $s->section]),
            ];
        }

        // Search modules/resources
        $modules = $DB->get_records_sql("
            SELECT cm.id, m.name as modname, c.fullname
            FROM {course_modules} cm
            JOIN {modules} m ON m.id = cm.module
            JOIN {course} c ON c.id = cm.course
            WHERE cm.id IN (
                SELECT instance FROM {course_modules} WHERE id IN (
                    SELECT id FROM {course_modules}
                )
            )
        ");
        // TODO: Add filtering by $query (keeping MVP simple for now)

        return $results;
    }
}
