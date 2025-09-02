<?php
namespace local_automation\navigation;

defined('MOODLE_INTERNAL') || die();

class helper {
    public static function search($query) {
        global $DB;

        $results = [];

        // Prepare wildcard once
        $like = '%' . $query . '%';

        // Search courses (use positional placeholders to avoid duplicate-named-parameter issues)
        $courses = $DB->get_records_sql(
            "SELECT id, fullname
               FROM {course}
              WHERE fullname LIKE ? OR shortname LIKE ?",
            [$like, $like]
        );
        if ($courses) {
            foreach ($courses as $c) {
                $results[] = [
                    'name' => $c->fullname,
                    'url'  => new \moodle_url('/course/view.php', ['id' => $c->id])
                ];
            }
        }

        // Search sections
        $sections = $DB->get_records_sql("
            SELECT cs.id, cs.name, cs.section, c.id AS courseid, c.fullname
              FROM {course_sections} cs
              JOIN {course} c ON cs.course = c.id
             WHERE cs.name LIKE :q
        ", ['q' => $like]);

        if ($sections) {
            foreach ($sections as $s) {
                $results[] = [
                    'name' => "Section: {$s->name} ({$s->fullname})",
                    'url'  => new \moodle_url('/course/view.php', ['id' => $s->courseid, 'section' => $s->section]),
                ];
            }
        }

        // Search modules/resources (left as TODO)
        // $modules = ...;

        return $results;
    }
}
