define(['jquery', 'core/ajax', 'core/templates'], function($, Ajax, Templates) {

    /**
     * Bind UI event handlers for navigation helper.
     */
    function bindHandlers() {
        // Toggle modal on button click
        $('#nav-helper-button').on('click', function() {
            $('#nav-helper-modal').toggleClass('hidden');
            $('#nav-helper-input').trigger('focus');
        });

        // Handle search input
        $('#nav-helper-input').on('keyup', function() {
            const query = $(this).val().trim();
            if (query.length < 3) {
                $('#nav-helper-results').empty();
                return;
            }

            Ajax.call([{
                methodname: 'local_automation_navsearch',
                args: {
                    query: query
                },
                done: function(results) {
                    const $list = $('#nav-helper-results');
                    $list.empty();
                    if (!results || results.length === 0) {
                        $list.append('<li>No matches found</li>');
                    } else {
                        results.forEach(r => {
                            const name = $('<div/>').text(r.name).html();
                            const url  = $('<div/>').text(r.url).html();
                            $list.append(`<li><a href="${url}">${name}</a></li>`);
                        });
                    }
                },
                fail: function(err) {
                    console.error('navsearch failed:', err);
                }
            }]);
        });

        $('#nav-helper-input').on('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const $firstLink = $('#nav-helper-results li a').first();
                if ($firstLink.length) {
                    window.location.href = $firstLink.attr('href');
                }
            }
        });

        // Search button click navigates to first result
        $('#nav-helper-search-btn').on('click', function() {
            const $firstLink = $('#nav-helper-results li a').first();
            if ($firstLink.length) {
                window.location.href = $firstLink.attr('href');
            }
        });
    }

    /**
     * Initialise the navigation helper modal.
     */
    function init() {
        // Render mustache and append to body once.
        return Templates.render('local_automation/navigation', {})
            .then(function(html, js) {
                $('body').append(html);
                Templates.runTemplateJS(js);
                bindHandlers();
            })
            .catch(function(e) {
                // eslint-disable-next-line no-console
                console.error('Failed to render navigation template:', e);
            });
    }

    return {init: init};
});
