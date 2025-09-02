<?php
namespace local_automation\output;

defined('MOODLE_INTERNAL') || die();

use renderable;
use renderer_base;
use templatable;

class navigation_renderer implements renderable, templatable {
    public function export_for_template(renderer_base $output) {
        return [];
    }
}
