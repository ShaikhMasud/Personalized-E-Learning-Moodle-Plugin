// amd/src/chat_qb.js
define([], function() {
    'use strict';

    // If you ever need per-session state for QB mode, keep it here
    function reset() {
        // No state yet
    }

    /**
     * Allows QB mode to modify the prompt before sending to the backend.
     * For now, we just pass the text through unchanged.
     */
    function beforeSend(text) {
        // Example: later you could prepend a role instruction here, e.g.
        // return "You are a question bank generator...\nUSER_PROMPT:\n" + text;
        return text;
    }

    /**
     * Handle responses for QB mode.
     * ui helpers: { appendMessage, scrollMessagesToBottom, showConfirmButton, clearConfirmButton, escapeHtml }
     *
     * Return:
     *   true  -> QB handler fully handled this response (shell won't do fallback)
     *   false -> shell will do its normal reply rendering (res.reply → appendMessage)
     */
    function handleResponse(res, ui) {
        // For now, let the shell handle everything as plain text.
        // Later, you can add custom formatting for QB-style outputs here.
        return false;
    }

    return {
        beforeSend: beforeSend,
        handleResponse: handleResponse,
        reset: reset
    };
});
