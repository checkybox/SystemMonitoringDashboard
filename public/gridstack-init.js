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

    // Save layout to localStorage on change
    grid.on('change', function(event, items) {
        const layout = items.map(item => ({
            id: item.id,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h
        }));
        localStorage.setItem('dashboard-layout', JSON.stringify(layout));
    });

    // Load saved layout from localStorage
    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
        try {
            const layout = JSON.parse(savedLayout);
            // Apply saved layout
            grid.batchUpdate();
            layout.forEach(item => {
                const element = document.querySelector(`[gs-id="${item.id}"]`);
                if (element) {
                    grid.update(element, {
                        x: item.x,
                        y: item.y,
                        w: item.w,
                        h: item.h
                    });
                }
            });
            grid.commit();
        } catch (e) {
            console.error('Failed to load saved layout:', e);
        }
    }

    // Add reset button functionality (you can add this to UI later)
    window.resetDashboardLayout = function() {
        localStorage.removeItem('dashboard-layout');
        location.reload();
    };
});
