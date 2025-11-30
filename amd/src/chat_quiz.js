// local/automation/amd/src/chat_quiz.js
define(['jquery', 'core/notification'], function($, Notification) {
    'use strict';

    // --- State ---

    let selectedCourseId = null;
    let selectedSectionId = null;

    let fileMetaById = {};    // fileid -> { name, path, sectionname, courseid }
    let selectedFileIds = []; // array of selected fileids
    let currentSections = []; // from fetch_files, used to populate section dropdown

    let quizConfig = {
        quizname: '',
        numquestions: 10,
        marksperquestion: 1,
        timelimitminutes: 0
    };

    let draftQuestions = [];  // array of question objects from Groq

    // --- Helpers shared with chatbot.js ---

    function reset() {
        selectedCourseId = null;
        selectedSectionId = null;
        fileMetaById = {};
        selectedFileIds = [];
        currentSections = [];
        quizConfig = {
            quizname: '',
            numquestions: 10,
            marksperquestion: 1,
            timelimitminutes: 0
        };
        draftQuestions = [];

        $('#quiz-panel').remove();
        $('#chatbot-input').prop('disabled', false);
        $('#chatbot-send-btn').prop('disabled', false).text('Send');
    }

    function beforeSend(text) {
        // Not used by shell; chatbot.js calls generate() directly in quiz mode.
        return text;
    }

    function handleResponse(res, ui) {
        // Quiz mode doesn't use chatbot_endpoint.php responses.
        return false;
    }

    // Escape HTML helper
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- UI PANEL CREATION ---

    function ensurePanel() {
        if ($('#quiz-panel').length) {
            return;
        }

        const html = `
            <div id="quiz-panel" class="quiz-panel">
                <div class="quiz-row">
                    <label>Subject (course)</label>
                    <select id="quiz-course-select">
                        <option value="">Select course.</option>
                        <!-- Options loaded via AJAX -->
                    </select>
                </div>

                <div class="quiz-row">
                    <label>Upload quiz to section</label>
                    <select id="quiz-section-select">
                        <option value="">Select section.</option>
                        <!-- Populated after course files are loaded -->
                    </select>
                </div>

                <div class="quiz-row">
                    <label>Notes / PPTs / Docs to use as context</label>
                    <div>
                        <label>
                            <input type="checkbox" id="quiz-use-all-resources">
                            Select all supported files (PDF/PPT/Word)
                        </label>
                    </div>
                    <div id="quiz-files-tree" class="quiz-files-tree">
                        <div class="quiz-info">Select a course to load files.</div>
                    </div>
                </div>

                <div class="quiz-row">
                    <label>Quiz name</label>
                    <input type="text" id="quiz-name-input" />
                </div>

                <div class="quiz-row quiz-three-cols">
                    <div>
                        <label>Number of MCQs</label>
                        <input type="number" id="quiz-numquestions" min="1" value="10" />
                    </div>
                    <div>
                        <label>Marks per question</label>
                        <input type="number" id="quiz-marks" min="0" step="0.5" value="1" />
                    </div>
                    <div>
                        <label>Time limit (minutes, 0 = none)</label>
                        <input type="number" id="quiz-timelimit" min="0" value="0" />
                    </div>
                </div>

                <div class="quiz-row quiz-hint">
                    Type any extra instructions in the chat box below
                    (e.g. "mix easy/medium questions", "focus on trees").
                    Then click <b>Send</b> in Quiz mode to generate MCQs.
                </div>

                <div class="quiz-draft hidden">
                    <h4>Draft questions</h4>
                    <div class="quiz-draft-list"></div>
                    <div class="quiz-actions">
                        <button type="button" class="btn btn-secondary quiz-btn-upload">
                            Upload quiz to course
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('#chatbot-messages').prepend(html);

        applyQuizInlineStyles();
        bindPanelEvents();
        updateGenerateState();
        loadCourses();
    }

    function applyQuizInlineStyles() {
        // Basic inline styling so theme can't wreck it too much
        const $panel = $('#quiz-panel');
        $panel.css({
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '8px 10px',
            marginBottom: '10px',
            background: '#f9fafb',
            fontSize: '0.85rem'
        });

        $panel.find('.quiz-row').css({
            marginBottom: '8px'
        });

        $panel.find('label').css({
            display: 'block',
            fontWeight: '600',
            marginBottom: '3px'
        });

        $panel.find('select, input[type="number"], input[type="text"], textarea').css({
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            padding: '4px 6px',
            fontSize: '0.85rem'
        });

        $panel.find('.quiz-three-cols').css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '8px'
        });

        $panel.find('.quiz-files-tree').css({
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '4px 6px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            fontSize: '0.8rem'
        });

        $panel.find('.quiz-draft').css({
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid #ddd'
        });

        $panel.find('.quiz-draft-item').css({
            border: '1px solid #ddd',
            borderRadius: '6px',
            padding: '6px',
            marginBottom: '8px',
            background: '#ffffff'
        });

        $panel.find('.quiz-draft-question textarea, .quiz-draft-feedback textarea').css({
            width: '100%',
            boxSizing: 'border-box',
            fontSize: '0.8rem'
        });

        $panel.find('.quiz-draft-option input[type="text"]').css({
            width: '80%',
            marginLeft: '4px',
            fontSize: '0.8rem'
        });

        $panel.find('.quiz-hint').css({
            fontSize: '0.75rem',
            color: '#555'
        });
    }

    // --- GENERATE BUTTON ENABLE/DISABLE ---

    function updateGenerateState() {
        const courseVal = $('#quiz-course-select').val();
        selectedCourseId = courseVal ? parseInt(courseVal, 10) : null;

        const sectionVal = $('#quiz-section-select').val();
        selectedSectionId = sectionVal ? parseInt(sectionVal, 10) : null;

        quizConfig.quizname = $('#quiz-name-input').val().trim();
        quizConfig.numquestions = parseInt($('#quiz-numquestions').val() || '0', 10);
        quizConfig.marksperquestion = parseFloat($('#quiz-marks').val() || '1');
        quizConfig.timelimitminutes = parseInt($('#quiz-timelimit').val() || '0', 10);

        const hasCourse = !!selectedCourseId;
        const hasSection = !!selectedSectionId;
        const hasFiles = selectedFileIds.length > 0;
        const hasQuizName = quizConfig.quizname.length > 0;
        const hasNumQuestions = quizConfig.numquestions > 0;

        const enabled = hasCourse && hasSection && hasFiles && hasQuizName && hasNumQuestions;

        // These control Send + Generate-panel button
        $('#chatbot-input').prop('disabled', !enabled);
        $('#chatbot-send-btn').prop('disabled', !enabled);
        // $('.quiz-btn-generate-panel').prop('disabled', !enabled);
    }

    // --- AJAX: COURSES & FILES (reuse qb_ajax.php) ---

    function loadCourses() {
        $.ajax({
            url: M.cfg.wwwroot + '/local/automation/qb_ajax.php',
            method: 'POST',
            data: JSON.stringify({
                action: 'fetch_courses',
                sesskey: M.cfg.sesskey
            }),
            contentType: 'application/json',
            dataType: 'json',
            success: function(res) {
                if (!res || !res.success) {
                    console.error('Quiz fetch_courses error:', res);
                    return;
                }
                populateCourseSelect(res.courses || []);
            },
            error: function(xhr) {
                console.error('Quiz fetch_courses AJAX error:', xhr);
            }
        });
    }

    function populateCourseSelect(courses) {
        const $select = $('#quiz-course-select');
        $select.empty();
        $select.append('<option value="">Select course.</option>');

        courses.forEach(c => {
            const label = escapeHtml(c.fullname || c.shortname || ('Course ' + c.id));
            $select.append(
                `<option value="${String(c.id)}">${label}</option>`
            );
        });
    }

    function loadFilesForCourse(courseid) {
        if (!courseid) {
            $('#quiz-files-tree').html('<div class="quiz-info">Select a course to load files.</div>');
            $('#quiz-section-select').empty().append('<option value="">Select section.</option>');
            fileMetaById = {};
            selectedFileIds = [];
            currentSections = [];
            $('#quiz-use-all-resources').prop('checked', false);
            updateGenerateState();
            return;
        }

        $.ajax({
            url: M.cfg.wwwroot + '/local/automation/qb_ajax.php',
            method: 'POST',
            data: JSON.stringify({
                action: 'fetch_files',
                courseid: courseid,
                sesskey: M.cfg.sesskey
            }),
            contentType: 'application/json',
            dataType: 'json',
            success: function(res) {
                if (!res || !res.success) {
                    console.error('Quiz fetch_files error:', res);
                    $('#quiz-files-tree').html('<div class="quiz-info">No files found for this course.</div>');
                    fileMetaById = {};
                    selectedFileIds = [];
                    currentSections = [];
                    $('#quiz-section-select').empty().append('<option value="">Select section.</option>');
                    updateGenerateState();
                    return;
                }
                currentSections = res.sections || [];
                populateSectionSelect(currentSections);
                renderFileTree(currentSections);
            },
            error: function(xhr) {
                console.error('Quiz fetch_files AJAX error:', xhr);
                $('#quiz-files-tree').html('<div class="quiz-info">Failed to load files.</div>');
                fileMetaById = {};
                selectedFileIds = [];
                currentSections = [];
                $('#quiz-section-select').empty().append('<option value="">Select section.</option>');
                updateGenerateState();
            }
        });
    }

    function populateSectionSelect(sections) {
        const $select = $('#quiz-section-select');
        $select.empty();
        $select.append('<option value="">Select section.</option>');

        sections.forEach(sec => {
            const label = escapeHtml(sec.name || ('Section ' + sec.id));
            $select.append(
                `<option value="${String(sec.id)}">${label}</option>`
            );
        });
    }

    // --- TREE RENDERING (mirror QB but quiz-* IDs/classes) ---

    function renderFileTree(sections) {
        fileMetaById = {};
        selectedFileIds = [];
        $('#quiz-use-all-resources').prop('checked', false);

        if (!sections.length) {
            $('#quiz-files-tree').html('<div class="quiz-info">No supported files (PDF/PPT/Word) found in this course.</div>');
            updateGenerateState();
            return;
        }

        let html = '';

        sections.forEach(section => {
            const sname = escapeHtml(section.name || 'Topic');
            const files = Array.isArray(section.files) ? section.files : [];

            if (!files.length) {
                return;
            }

            const treeRoot = buildTreeFromFiles(section, files);

            html += `
                <div class="quiz-section">
                    <div class="quiz-section-title">
                        <span class="quiz-icon quiz-icon-section">📚</span>
                        ${sname}
                    </div>
                    <div class="quiz-section-tree">
                        ${renderTreeNode(treeRoot)}
                    </div>
                </div>
            `;
        });

        if (!html) {
            html = '<div class="quiz-info">No supported files (PDF/PPT/Word) found in this course.</div>';
        }

        $('#quiz-files-tree').html(html);
        updateGenerateState();
    }

    function buildTreeFromFiles(section, files) {
        const root = {
            type: 'root',
            name: section.name || 'Section',
            children: {}
        };

        files.forEach(file => {
            const fileid = file.fileid;
            const name = file.name;
            const path = file.path || name;

            fileMetaById[fileid] = {
                name: name,
                path: path,
                sectionname: section.name || '',
                courseid: section.courseid || selectedCourseId
            };

            const parts = path.split('/').filter(Boolean);
            let node = root;

            for (let i = 0; i < parts.length - 1; i++) {
                const folderName = parts[i];
                if (!node.children[folderName]) {
                    node.children[folderName] = {
                        type: 'folder',
                        name: folderName,
                        children: {}
                    };
                }
                node = node.children[folderName];
            }

            const filename = parts[parts.length - 1] || name;
            node.children[filename] = {
                type: 'file',
                name: filename,
                fileid: fileid
            };
        });

        return root;
    }

    function renderTreeNode(node) {
        if (!node || !node.children) {
            return '';
        }

        const keys = Object.keys(node.children);
        if (!keys.length) {
            return '';
        }

        let html = '<div class="quiz-tree-level">';

        keys.forEach(key => {
            const child = node.children[key];
            if (child.type === 'folder') {
                html += `
                    <details class="quiz-folder">
                        <summary>
                            <span class="quiz-icon quiz-icon-folder">📁</span>
                            ${escapeHtml(child.name)}
                        </summary>
                        ${renderTreeNode(child)}
                    </details>
                `;
            } else if (child.type === 'file') {
                const fid = child.fileid;
                const id = 'quiz-file-' + fid;
                const labelText = escapeHtml(fileMetaById[fid].path || child.name);

                html += `
                    <div class="quiz-file">
                        <label for="${id}">
                            <input type="checkbox"
                                id="${id}"
                                class="quiz-file-checkbox"
                                data-fileid="${fid}">
                            <span class="quiz-icon quiz-icon-file">📄</span>
                            ${labelText}
                        </label>
                    </div>
                `;
            }
        });

        html += '</div>';
        return html;
    }

    function recomputeSelectedFiles() {
        selectedFileIds = [];
        $('.quiz-file-checkbox:checked').each(function() {
            const fileid = parseInt($(this).data('fileid'), 10);
            if (!isNaN(fileid)) {
                selectedFileIds.push(fileid);
            }
        });
    }

    // --- BIND EVENTS ---

    function bindPanelEvents() {
        // Course changed -> reload files + sections
        $('#quiz-course-select').on('change', function() {
            const cid = $(this).val();
            selectedCourseId = cid ? parseInt(cid, 10) : null;
            loadFilesForCourse(selectedCourseId);
            updateGenerateState();
        });

        // Section changed
        $('#quiz-section-select').on('change', function() {
            const sid = $(this).val();
            selectedSectionId = sid ? parseInt(sid, 10) : null;
            updateGenerateState();
        });

        // Select-all files
        $('#quiz-use-all-resources').on('change', function() {
            const checked = $(this).is(':checked');
            $('.quiz-file-checkbox').prop('checked', checked);
            recomputeSelectedFiles();
            updateGenerateState();
        });

        // Individual file checkbox (delegated)
        $('#chatbot-messages').on('change', '.quiz-file-checkbox', function() {
            recomputeSelectedFiles();
            const totalFiles = $('.quiz-file-checkbox').length;
            const totalSelected = $('.quiz-file-checkbox:checked').length;
            $('#quiz-use-all-resources').prop('checked', totalFiles > 0 && totalFiles === totalSelected);
            updateGenerateState();
        });

        // Quiz basic config inputs
        $('#quiz-name-input, #quiz-numquestions, #quiz-marks, #quiz-timelimit').on('input', function() {
            updateGenerateState();
        });

        // Panel "Generate questions" button – just call generate with empty instructions

        // Upload button (delegated – inside quiz-draft)
        $('#quiz-panel').on('click', '.quiz-btn-upload', function() {
            handleUpload();
        });
    }

    // --- MODE ACTIVATION ---

    function onModeActivated() {
        ensurePanel();
        $('#chatbot-send-btn').text('Send');

        // Placeholder set by chatbot.js already; no need to override.
        updateGenerateState();
    }

    // --- CORE: GENERATE & DRAFT RENDERING ---

    /**
     * Called from chatbot.js when user presses Send in Quiz mode.
     * instructions = text from chat input.
     */
    function generate(instructions, ui) {
        updateGenerateState();

        if (!selectedCourseId) {
            ui.appendMessage('⚠️ Please select a course first.', 'bot');
            return;
        }
        if (!selectedSectionId) {
            ui.appendMessage('⚠️ Please choose a section where the quiz will be created.', 'bot');
            return;
        }
        if (!selectedFileIds.length) {
            ui.appendMessage('⚠️ Please select at least one file to use as context.', 'bot');
            return;
        }
        if (!quizConfig.quizname) {
            ui.appendMessage('⚠️ Please enter a quiz name.', 'bot');
            return;
        }
        if (quizConfig.numquestions <= 0) {
            ui.appendMessage('⚠️ Number of MCQs must be greater than zero.', 'bot');
            return;
        }

        // Lock inputs while generating
        $('#quiz-course-select').prop('disabled', true);
        $('#quiz-section-select').prop('disabled', true);
        $('#quiz-use-all-resources').prop('disabled', true);
        $('.quiz-file-checkbox').prop('disabled', true);
        $('#quiz-name-input').prop('disabled', true);
        $('#quiz-numquestions').prop('disabled', true);
        $('#quiz-marks').prop('disabled', true);
        $('#quiz-timelimit').prop('disabled', true);
        $('#chatbot-input').prop('disabled', true);
        $('#chatbot-send-btn').prop('disabled', true);
        $('.quiz-btn-generate-panel').prop('disabled', true);

        ui.appendMessage('⏳ Generating MCQ questions for this quiz…', 'bot');

        const payload = {
            action: 'generate',
            courseid: selectedCourseId,
            sectionid: selectedSectionId,
            fileids: selectedFileIds,
            quizname: quizConfig.quizname,
            numquestions: quizConfig.numquestions,
            marksperquestion: quizConfig.marksperquestion,
            timelimitminutes: quizConfig.timelimitminutes,
            instructions: instructions || ''
        };

        $.ajax({
            url: M.cfg.wwwroot + '/local/automation/quiz_ajax.php?sesskey=' + M.cfg.sesskey,
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(res) {
                if (!res || !res.success) {
                    Notification.alert('Quiz generator', (res && res.message) ? res.message : 'Failed to generate questions.', 'OK');
                    return;
                }

                draftQuestions = res.questions || [];
                renderDraftQuestions();
            },
            error: function(xhr) {
                console.error('Quiz generate AJAX error:', xhr);
                Notification.alert('Quiz generator', 'AJAX error while contacting server.', 'OK');
            },
            complete: function() {
                // Re-enable controls for editing / re-generation
                $('#quiz-course-select').prop('disabled', false);
                $('#quiz-section-select').prop('disabled', false);
                $('#quiz-use-all-resources').prop('disabled', false);
                $('.quiz-file-checkbox').prop('disabled', false);
                $('#quiz-name-input').prop('disabled', false);
                $('#quiz-numquestions').prop('disabled', false);
                $('#quiz-marks').prop('disabled', false);
                $('#quiz-timelimit').prop('disabled', false);
                $('#chatbot-input').prop('disabled', false);
                $('#chatbot-send-btn').prop('disabled', false);
                // $('.quiz-btn-generate-panel').prop('disabled', false);
            }
        });
    }

    function renderDraftQuestions() {
        const $draft = $('#quiz-panel .quiz-draft');
        const $list = $draft.find('.quiz-draft-list');
        $list.empty();

        draftQuestions.forEach((q, index) => {
            const opts = Array.isArray(q.options) ? q.options : [];
            const correct = parseInt(q.correct_index, 10) || 0;
            const feedback = q.feedback || '';

            const htmlOptions = opts.map((opt, i) => `
                <div class="quiz-draft-option">
                    <label>
                        <input type="radio"
                               name="quiz-q${index}-correct"
                               value="${i}" ${i === correct ? 'checked' : ''} />
                        Correct
                    </label>
                    <input type="text"
                           class="quiz-q${index}-opt"
                           data-index="${i}"
                           value="${escapeHtml(opt)}" />
                </div>
            `).join('');

            const block = `
                <div class="quiz-draft-item" data-qindex="${index}">
                    <div class="quiz-draft-question">
                        <label>Question ${index + 1}</label>
                        <textarea class="quiz-q${index}-text" rows="3">${escapeHtml(q.questiontext || '')}</textarea>
                    </div>
                    <div class="quiz-draft-options">
                        ${htmlOptions}
                    </div>
                    <div class="quiz-draft-feedback">
                        <label>Feedback (optional)</label>
                        <textarea class="quiz-q${index}-feedback" rows="2">${escapeHtml(feedback)}</textarea>
                    </div>
                </div>
            `;
            $list.append(block);
        });

        $draft.removeClass('hidden');
        applyQuizInlineStyles(); // re-apply to new elements
    }

    // --- UPLOAD QUIZ TO MOODLE ---

    function handleUpload() {
        updateGenerateState();

        if (!draftQuestions.length) {
            Notification.alert('Quiz generator', 'No questions to upload. Generate questions first.', 'OK');
            return;
        }
        if (!selectedCourseId || !selectedSectionId || !quizConfig.quizname) {
            Notification.alert('Quiz generator', 'Course, section or quiz name missing.', 'OK');
            return;
        }

        // Collect edited questions from DOM
        const cleaned = [];
        $('#quiz-panel .quiz-draft-item').each(function() {
            const $item = $(this);
            const idx = parseInt($item.attr('data-qindex'), 10) || 0;

            const questiontext = $item.find(`.quiz-q${idx}-text`).val().trim();
            if (!questiontext) {
                return; // skip blank
            }

            const options = [];
            $item.find(`.quiz-q${idx}-opt`).each(function() {
                const text = $(this).val().trim();
                if (text) {
                    options.push(text);
                }
            });
            if (options.length < 2) {
                return; // skip invalid
            }

            const correctStr = $item.find(`input[name="quiz-q${idx}-correct"]:checked`).val();
            const correctIndex = correctStr !== undefined ? parseInt(correctStr, 10) : 0;

            const feedback = $item.find(`.quiz-q${idx}-feedback`).val().trim();

            cleaned.push({
                questiontext: questiontext,
                options: options,
                correct_index: isNaN(correctIndex) ? 0 : correctIndex,
                feedback: feedback
            });
        });

        if (!cleaned.length) {
            Notification.alert('Quiz generator', 'No valid questions to upload.', 'OK');
            return;
        }

        const payload = {
            action: 'upload',
            courseid: selectedCourseId,
            sectionid: selectedSectionId,
            quizname: quizConfig.quizname,
            marksperquestion: quizConfig.marksperquestion,
            timelimitminutes: quizConfig.timelimitminutes,
            questions: draftQuestions,
        };

        const $btn = $('#quiz-panel .quiz-btn-upload').prop('disabled', true);
        $btn.text('Uploading...');

        $.ajax({
            url: M.cfg.wwwroot + '/local/automation/quiz_ajax.php?sesskey=' + M.cfg.sesskey,
            method: 'POST',
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify(payload),
            success: function(res) {
                if (!res || !res.success) {
                    Notification.alert('Quiz generator', (res && res.message) ? res.message : 'Failed to create quiz.', 'OK');
                    return;
                }

                const msg = `
<p>${escapeHtml(res.message || 'Quiz created successfully.')}</p>
<p>
  <a href="${escapeHtml(res.settingsurl || '#')}" target="_blank">Open quiz settings</a><br/>
  <a href="${escapeHtml(res.editurl || '#')}" target="_blank">Open question editor</a>
</p>`;
                Notification.alert('Quiz created', msg, 'OK');
            },
            error: function(xhr) {
                console.error('Quiz upload AJAX error:', xhr);
                Notification.alert('Quiz generator', 'AJAX error while creating quiz.', 'OK');
            },
            complete: function() {
                $btn.prop('disabled', false).text('Upload quiz to course');
            }
        });
    }

    // --- EXPORTS ---

    return {
        beforeSend: beforeSend,
        handleResponse: handleResponse,
        reset: reset,
        onModeActivated: onModeActivated,
        generate: generate
    };
});
