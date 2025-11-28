define(['jquery', 'core/templates'], function($, Templates) {
    'use strict';

    const STORAGE_PREFIX = 'ai_chat_history_';
    let currentMode = 'assistant'; // Default mode

    // For course creation flow
    let pendingCoursePayload = null;      // holds last course params returned by assistant
    let awaitingConfirmation = false;     // true when a confirmation bubble is shown

    function getStorageKey() {
        return STORAGE_PREFIX + currentMode;
    }

    function loadHistory() {
        $('#chatbot-messages').empty();

        let history = localStorage.getItem(getStorageKey());
        if (!history) return;
        history = JSON.parse(history);

        history.forEach(msg => appendMessage(msg.text, msg.sender, false));
        scrollMessagesToBottom();
    }

    function saveMessage(text, sender) {
        let history = localStorage.getItem(getStorageKey());
        history = history ? JSON.parse(history) : [];
        history.push({ text, sender });
        localStorage.setItem(getStorageKey(), JSON.stringify(history));
    }

    function appendMessage(text, sender, store = true) {
        const className = sender === 'user' ? 'msg-user' : 'msg-bot';
        $('#chatbot-messages').append(`<div class="message ${className}">${text}</div>`);

        if (store) saveMessage(text, sender);
        scrollMessagesToBottom();
    }

    function scrollMessagesToBottom() {
        const msgBox = $('#chatbot-messages')[0];
        if (msgBox) {
            msgBox.scrollTo({ top: msgBox.scrollHeight, behavior: 'smooth' });
        }
    }
    // Renders automation JSON responses (assistant mode)
    function renderAutomationMessage(data) {
        // missing params -> list them and ask the user to provide
        if (data.type === 'course_creation_missing_params') {
            const missing = data.missing || [];
            appendMessage(`<div><b>Missing parameters:</b> ${missing.join(', ')}</div>`, 'bot');
            // clear any pending flow (user must provide missing details)
            pendingCoursePayload = null;
            awaitingConfirmation = false;
            return;
        }

        if (data.type === 'course_creation'|| data.type === 'course_update') {
            const params = data.params || {};
            const category = params.category || 1;

            // numsections from model (preferred), fallback to sections length
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
                    // If Groq returns { "name": "Graphs" } or { "title": "Graphs" }
                    return s.name || s.title || ('Section ' + (idx + 1));
                }
                return 'Section ' + (idx + 1);
            });

            // If LLM returned fewer section names than numsections, pad the rest
            if (numsections > sections.length) {
                const start = sections.length;
                for (let i = start; i < numsections; i++) {
                    sections.push('Section ' + (i + 1));
                }
            }
        
            // If numsections somehow smaller, trim to be safe
            if (numsections > 0 && sections.length > numsections) {
                sections = sections.slice(0, numsections);
            }

            let shortname = params.shortname || '';
            if (!shortname && params.fullname) {
                shortname = params.fullname.replace(/\s+/g, '').toUpperCase().slice(0, 15);
            }


            // store pending payload
            pendingCoursePayload = {
                fullname: params.fullname || '',
                shortname: params.shortname || '',
                category: category,
                sections: sections
            };
            awaitingConfirmation = true;
        
            // show preview bubble
            const html = `
                <div class="automation-box">
                    <b>Course Preview</b><br>
                    Fullname: ${escapeHtml(pendingCoursePayload.fullname)}<br>
                    Shortname: ${escapeHtml(pendingCoursePayload.shortname)}<br>
                    Category: ${escapeHtml(pendingCoursePayload.category)}<br>
                    Sections: ${escapeHtml(pendingCoursePayload.sections.join(', '))}<br>
                </div>
            `;
            appendMessage(html, 'bot');
        
            // show confirm button *below chat* using action-area
            showConfirmButton(function() {
                console.log("JS DEBUG: Sending request to:", M.cfg.wwwroot + '/local/automation/course_ajax.php');
                console.log("JS DEBUG: Payload being sent:", {
                    ...pendingCoursePayload,
                    sesskey: M.cfg.sesskey
                });
            
                // send to backend
                $.ajax({
                    url: M.cfg.wwwroot + '/local/automation/course_ajax.php',
                    method: 'POST',
                    data: JSON.stringify({
                        ...pendingCoursePayload,
                        sesskey: M.cfg.sesskey
                    }),
                    contentType: "application/json",
                    dataType: "json",
                    success: function(res) {
                        console.log("Server response:", res);
                        if (res && res.success) {
                            appendMessage(`✅ Course created! ID: ${res.courseid}`, 'bot');
                            pendingCoursePayload = null;
                            awaitingConfirmation = false;
                            clearConfirmButton();
                        } else {
                            appendMessage('❌ Error: ' + (res.error || 'Unknown error'), 'bot');
                        }
                    },
                    error: function(xhr) {
                        appendMessage('❌ Failed to create course. See server logs.', 'bot');
                        console.error("AJAX error:", xhr);
                    }
                });
            
            });
        
            scrollMessagesToBottom();
            return;
        }

        // Unknown automation type -> just show raw JSON
        appendMessage(`<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, 'bot');
    }

    // helper to escape HTML to avoid XSS with user-editable data
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Show confirm button only for automation confirmation
    function showConfirmButton(onConfirm) {
        const area = $('#chatbot-action-area');

        area.html(`
            <div id="chatbot-edit-note">Type for any edits...</div>
            <button id="chatbot-confirm-btn">Confirm</button>
        `);

        $('#chatbot-confirm-btn').off('click').on('click', onConfirm);
    }

    function clearConfirmButton() {
        $('#chatbot-action-area').empty();
    }

    function handleSend() {
        const input = $('#chatbot-input');
        const text = input.val().trim();
        if (!text) return;

        appendMessage(text, 'user');
        input.val('');

        // If we are awaiting confirmation (a pending course preview exists),
        // treat the user's message as an edit instruction.
        let promptToSend = text;
        if (pendingCoursePayload && awaitingConfirmation) {
            const wrapper = [
                "You are updating an existing COURSE CREATION JSON.",
                "Strict rules:",
                "- You MUST respond with a single JSON object, no explanations.",
                "- \"type\" MUST be exactly \"course_creation\" (do NOT invent new types).",
                "- Preserve existing fields unless the user explicitly changes them.",
                "- Keep the same number of sections (same array length).",
                "- Only modify the specific sections or fields the user mentions.",
                "",
                "PREVIOUS_PARAMS:",
                JSON.stringify(pendingCoursePayload),
                "",
                "USER_EDIT:",
                text
            ].join('\n');
            promptToSend = wrapper;
        }

        $.ajax({
            url: M.cfg.wwwroot + '/local/automation/chatbot_endpoint.php',
            method: 'POST',
            data: {
                prompt: promptToSend,
                mode: currentMode,
                sesskey: M.cfg.sesskey
            },
            success: function(res) {
                // If assistant returned structured automation
                if (res.automation && res.data) {
                    renderAutomationMessage(res.data);
                    return;
                }

                // Otherwise handle plain text
                if (res.reply) {
                    // preserve line breaks
                    const formattedReply = res.reply.replace(/\n/g, '<br>');
                    appendMessage(formattedReply, 'bot');
                } else {
                    appendMessage('⚠️ ' + (res.error || 'No response from AI'), 'bot');
                }
            },
            error: function(xhr) {
                appendMessage('❌ Failed to connect to server.', 'bot');
                console.error(xhr);
            }
        });
    }


    function handleTabSwitch(newMode) {
        if (newMode === currentMode) return;

        currentMode = newMode;
        console.log(`Switched to mode: ${currentMode}`);

        // Update tab visuals
        $('.chat-tab').removeClass('active');
        $(`.chat-tab[data-mode="${currentMode}"]`).addClass('active');

        // Update header title
        const headerText = {
            assistant: 'AI Assistant',
            qb: 'QB Generator',
            quiz: 'Quiz Generator'
        }[currentMode];
        $('.chat-header span').text(headerText);

        pendingCoursePayload = null;
        awaitingConfirmation = false;

        clearConfirmButton();

        loadHistory();
    }

    function bindEvents() {
        $('#ai-chatbot-button').on('click', () => {
            $('#ai-chatbot-modal').toggleClass('hidden');
            $('#chatbot-input').focus();
        });

        $('#chatbot-close-btn').on('click', () => {
            $('#ai-chatbot-modal').addClass('hidden');
        });

        $('#chatbot-send-btn').on('click', handleSend);

        $('#chatbot-input').on('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        });

        $('.chat-tab').on('click', function() {
            const mode = $(this).data('mode');
            handleTabSwitch(mode);
        });
    }

    function init() {
        if (!document.getElementById('chatbot-style')) {
            $('head').append('<link id="chatbot-style" rel="stylesheet" href="'+M.cfg.wwwroot+'/local/automation/style/chatbot.css">');
        }
        
        Templates.render('local_automation/chatbot', {})
            .then(html => {
                $('body').append(html);
                bindEvents();
                loadHistory();
            })
            .catch(err => console.error("Chatbot template load failed:", err));
    }

    return { init: init };
});
