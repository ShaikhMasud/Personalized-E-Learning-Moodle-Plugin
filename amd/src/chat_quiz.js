// amd/src/chat_quiz.js
define([], function() {
    'use strict';

    function reset() {
        // No quiz-specific state yet
    }

    /**
     * Allows Quiz mode to tweak the outgoing prompt.
     * Currently just returns the user text as-is.
     */
    function beforeSend(text) {
        // Example later:
        // return "You are a Moodle quiz generator...\nUSER_PROMPT:\n" + text;
        return text;
    }

    /**
     * Handle responses for Quiz mode.
     * ui helpers: { appendMessage, scrollMessagesToBottom, showConfirmButton, clearConfirmButton, escapeHtml }
     *
     * Return:
     *   true  -> Quiz handler handled it completely
     *   false -> let shell render reply normally
     */
    function handleResponse(res, ui) {
        // For now, we don't do any special parsing/formatting.
        // Shell will show res.reply as plain text (with <br> for newlines).
        return false;
    }

    return {
        beforeSend: beforeSend,
        handleResponse: handleResponse,
        reset: reset
    };
});
