// amd/src/chat_assistant.js
define(['jquery'], function($) {
    'use strict';

    let pendingCoursePayload = null; // last course params returned by assistant
    let awaitingConfirmation = false; // true while confirmation UI is active

    function reset() {
        pendingCoursePayload = null;
        awaitingConfirmation = false;
    }

    /**
     * Allows the assistant mode to modify the prompt before sending.
     * Used for "edit" flow: turns a user edit into a structured wrapper prompt.
     */
    function beforeSend(text) {
        if (pendingCoursePayload && awaitingConfirmation) {
            const wrapper = [
                'You are updating an existing COURSE CREATION JSON.',
                'Strict rules:',
                '- You MUST respond with a single JSON object, no explanations.',
                '- "type" MUST be exactly "course_creation" (do NOT invent new types).',
                '- Preserve existing fields unless the user explicitly changes them.',
                '- Keep the same number of sections (same array length).',
                '- Only modify the specific sections or fields the user mentions.',
                '- When the user gives new section names, COPY THEM VERBATIM.',
                '- Do not change spelling, singular/plural, or wording of section names.',
                '',
                'PREVIOUS_PARAMS:',
                JSON.stringify(pendingCoursePayload),
                '',
                'USER_EDIT:',
                text
            ].join('\n');

            return wrapper;
        }

        return text;
    }

    /**
     * Handle Groq/Moodle automation responses for assistant mode.
     * ui helpers: { appendMessage, scrollMessagesToBottom, showConfirmButton, clearConfirmButton, escapeHtml }
     *
     * Must return:
     *   true  -> response fully handled, shell should NOT do fallback handling
     *   false -> shell will handle (plain text / other modes)
     */
    function handleResponse(res, ui) {
        if (!(res && res.automation && res.data)) {
            // Not an automation payload – let shell handle it
            return false;
        }

        const data = res.data;

        // --- Missing params case ---
        if (data.type === 'course_creation_missing_params') {
            const missing = data.missing || [];
            ui.appendMessage(
                '<div><b>Missing parameters:</b> ' + ui.escapeHtml(missing.join(', ')) + '</div>',
                'bot'
            );
            reset();
            ui.clearConfirmButton();
            return true;
        }

        // --- Course creation / update case ---
        if (data.type === 'course_creation' || data.type === 'course_update') {
            const params = data.params || {};
            const category = params.category || 1;

            // Resolve numsections
            let numsections = parseInt(params.numsections, 10);
            if (isNaN(numsections) || numsections <= 0) {
                numsections = Array.isArray(params.sections) ? params.sections.length : 0;
            }

            const rawSections = Array.isArray(params.sections) ? params.sections : [];
            let sections = rawSections.map((s, idx) => {
                if (typeof s === 'string') {
                    return s;
                }
                if (s && typeof s === 'object') {
                    return s.name || s.title || ('Section ' + (idx + 1));
                }
                return 'Section ' + (idx + 1);
            });

            // Pad to numsections
            if (numsections > sections.length) {
                const start = sections.length;
                for (let i = start; i < numsections; i++) {
                    sections.push('Section ' + (i + 1));
                }
            }

            // Trim if too many
            if (numsections > 0 && sections.length > numsections) {
                sections = sections.slice(0, numsections);
            }

            // Shortname fallback
            let shortname = params.shortname || '';
            if (!shortname && params.fullname) {
                shortname = params.fullname.replace(/\s+/g, '').toUpperCase().slice(0, 15);
            }

            // Store payload for confirmation/edit flow
            pendingCoursePayload = {
                fullname: params.fullname || '',
                shortname: shortname,
                category: category,
                sections: sections
            };
            awaitingConfirmation = true;

            // Show preview
            const html = `
                <div class="automation-box">
                    <b>Course Preview</b><br>
                    Fullname: ${ui.escapeHtml(pendingCoursePayload.fullname)}<br>
                    Shortname: ${ui.escapeHtml(pendingCoursePayload.shortname)}<br>
                    Category: ${ui.escapeHtml(String(pendingCoursePayload.category))}<br>
                    Sections: ${ui.escapeHtml(pendingCoursePayload.sections.join(', '))}<br>
                </div>
            `;
            ui.appendMessage(html, 'bot');

            // Show confirm button below chat
            ui.showConfirmButton(function() {
                if (!pendingCoursePayload) {
                    ui.appendMessage('⚠️ No course data to confirm.', 'bot');
                    return;
                }

                console.log(
                    'JS DEBUG: Sending request to:',
                    M.cfg.wwwroot + '/local/automation/course_ajax.php'
                );
                console.log('JS DEBUG: Payload being sent:', {
                    ...pendingCoursePayload,
                    sesskey: M.cfg.sesskey
                });

                $.ajax({
                    url: M.cfg.wwwroot + '/local/automation/course_ajax.php',
                    method: 'POST',
                    data: JSON.stringify({
                        ...pendingCoursePayload,
                        sesskey: M.cfg.sesskey
                    }),
                    contentType: 'application/json',
                    dataType: 'json',
                    success: function(response) {
                        console.log('Server response:', response);
                        if (response && response.success) {
                            ui.appendMessage(
                                `✅ Course created! ID: ${ui.escapeHtml(String(response.courseid))}`,
                                'bot'
                            );
                            reset();
                            ui.clearConfirmButton();
                        } else {
                            ui.appendMessage(
                                '❌ Error: ' + (response.error || 'Unknown error'),
                                'bot'
                            );
                        }
                    },
                    error: function(xhr) {
                        ui.appendMessage('❌ Failed to create course. See server logs.', 'bot');
                        console.error('AJAX error (course_ajax):', xhr);
                    }
                });
            });

            ui.scrollMessagesToBottom();
            return true;
        }

        // Unknown automation type -> let shell show raw content if needed
        return false;
    }

    return {
        beforeSend: beforeSend,
        handleResponse: handleResponse,
        reset: reset
    };
});
