// Gridstack initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize gridstack
    const grid = GridStack.init({
        column: 12,
        cellHeight: '80px',
        margin: '0px', // Margins handled by CSS inset
        float: false, // Disable float to enable auto-compacting
        animate: true,
        resizable: {
            handles: 'e, se, s, sw, w'
        },
        draggable: {
            handle: '.card-floating',
            scroll: true
        }
    });

    // Expose grid for debugging
    window.dashboardGrid = grid;
});
