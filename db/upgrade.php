<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_local_automation_upgrade($oldversion) {
    global $DB;

    $dbman = $DB->get_manager();

    // ===== Create student chat table =====
    if ($oldversion < 2026022300) {

        $table = new xmldb_table('local_automation_student_chat');

        if (!$dbman->table_exists($table)) {

            $table->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table->add_field('studentid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('message', XMLDB_TYPE_TEXT, null, null, XMLDB_NOTNULL, null, null);
            $table->add_field('sender', XMLDB_TYPE_CHAR, '10', null, XMLDB_NOTNULL, null, null);
            $table->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('studentid_idx', XMLDB_INDEX_NOTUNIQUE, ['studentid']);
            $table->add_index('courseid_idx', XMLDB_INDEX_NOTUNIQUE, ['courseid']);

            $dbman->create_table($table);
        }

        // ===== Create student quiz table =====
        $table2 = new xmldb_table('local_automation_student_quiz');

        if (!$dbman->table_exists($table2)) {

            $table2->add_field('id', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, XMLDB_SEQUENCE, null);
            $table2->add_field('studentid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('courseid', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('topic', XMLDB_TYPE_CHAR, '255', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('score', XMLDB_TYPE_INTEGER, '5', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('total', XMLDB_TYPE_INTEGER, '5', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('difficulty', XMLDB_TYPE_CHAR, '20', null, XMLDB_NOTNULL, null, null);
            $table2->add_field('recommendation', XMLDB_TYPE_TEXT, null, null, null, null, null);
            $table2->add_field('timecreated', XMLDB_TYPE_INTEGER, '10', null, XMLDB_NOTNULL, null, null);

            $table2->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table2->add_index('studentid_idx2', XMLDB_INDEX_NOTUNIQUE, ['studentid']);
            $table2->add_index('courseid_idx2', XMLDB_INDEX_NOTUNIQUE, ['courseid']);

            $dbman->create_table($table2);
        }

        upgrade_plugin_savepoint(true, 2026022300, 'local', 'automation');
    }

    return true;
}