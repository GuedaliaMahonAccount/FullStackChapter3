// router.js — client-side SPA router
// Shows the active page and hides all others by toggling the "active" CSS class
// Pages are identified by HTML id: "page-<name>" (e.g. id="page-login")

const Router = (function () {

    let currentPage = null;  // name of the page currently displayed
    const pageCallbacks = {}; // pageName → callback, called on each navigation

    // Navigate to a page by name — hides all others, shows the target
    function navigate(pageName) {
        console.log(`[Router] Navigating: "${currentPage || "(none)"}" → "${pageName}"`);

        // Hide every page
        document.querySelectorAll(".page").forEach(page => {
            page.classList.remove("active");
        });

        // Show the target page
        const targetPage = document.getElementById("page-" + pageName);
        if (targetPage) {
            targetPage.classList.add("active");
            currentPage = pageName;

            // Fire the lifecycle callback if one was registered
            if (pageCallbacks[pageName]) {
                pageCallbacks[pageName]();
            }
        } else {
            console.error(`[Router] Page not found: #page-${pageName}`);
        }
    }

    // Register a callback to run every time a specific page is navigated to
    function onNavigate(pageName, callback) {
        pageCallbacks[pageName] = callback;
    }

    // Return the name of the currently active page
    function getCurrentPage() {
        return currentPage;
    }

    // Expose only the public API
    return {
        navigate,
        onNavigate,
        getCurrentPage
    };

})();
