define(['jquery', 'core/templates'], function($, Templates) {
    'use strict';

    const STORAGE_KEY = 'ai_chat_history';

    function loadHistory() {
        let history = localStorage.getItem(STORAGE_KEY);
        if (!history) return;
        history = JSON.parse(history);

        history.forEach(msg => appendMessage(msg.text, msg.sender, false));
        scrollMessagesToBottom();
    }

    function saveMessage(text, sender) {
        let history = localStorage.getItem(STORAGE_KEY);
        history = history ? JSON.parse(history) : [];
        history.push({ text, sender });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
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
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    }

    function handleSend() {
        const input = $('#chatbot-input');
        const text = input.val().trim();
        if (!text) return;

        appendMessage(text, 'user');
        console.log("User typed:", text);
        input.val('');

        setTimeout(() => {
            appendMessage("Working ✅", 'bot');
        }, 500);
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
    }

    function init() {
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
