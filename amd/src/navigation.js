/**
 * Navigation helper using local ajax endpoint
 *
 * @module local_automation/navigation
 */
define(['jquery', 'core/templates', 'core/config'], function($, Templates, Config) {
    'use strict';

    function bindHandlers() {
        // Toggle modal
        $('#nav-helper-button').on('click', function() {
            $('#nav-helper-modal').toggleClass('hidden');
            $('#nav-helper-input').trigger('focus');
        });

        // Live search on keyup (>= 3 chars)
        $('#nav-helper-input').on('keyup', function() {
            const query = $(this).val().trim();
            if (query.length < 3) {
                $('#nav-helper-results').empty();
                return;
            }

            const url = Config.wwwroot + '/local/automation/ajax.php';

            $.ajax({
                url: url,
                method: 'POST',
                dataType: 'json',
                data: { query: query },
                success: function(results) {
                    const $list = $('#nav-helper-results');
                    $list.empty();
                    if (!results || results.length === 0) {
                        $list.append('<li>No matches found</li>');
                        return;
                    }
                    results.forEach(function(r) {
                        const name = $('<div/>').text(r.name).html();
                        const url = $('<div/>').text(r.url).html();
                        $list.append('<li><a href="' + url + '">' + name + '</a></li>');
                    });
                },
                error: function(xhr, status, err) {
                    // dev-friendly logging; remove in production
                    // eslint-disable-next-line no-console
                    console.error('navsearch AJAX failed', status, err, xhr.responseText);
                }
            });
        });

        // Enter key -> go to first result
        $('#nav-helper-input').on('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const $first = $('#nav-helper-results li a').first();
                if ($first.length) {
                    window.location.href = $first.attr('href');
                }
            }
        });

        // Go button -> first result
        $('#nav-helper-search-btn').on('click', function() {
            const $first = $('#nav-helper-results li a').first();
            if ($first.length) {
                window.location.href = $first.attr('href');
            }
        });
    }

    function init() {
        return Templates.render('local_automation/navigation', {})
            .then(function(html) {
                $('body').append(html);
                bindHandlers();   // only this is needed
            })
            .catch(function(e) {
                console.error('Failed to render navigation template:', e);
            });
    }


    return { init: init };
});
