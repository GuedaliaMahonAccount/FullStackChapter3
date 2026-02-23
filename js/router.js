// ============================================================
// ROUTER.js — Client-Side SPA Router
// ============================================================
// This module manages navigation between the application's views.
// Since this is a Single Page Application (SPA), all "pages" are
// already present in the DOM. The router simply shows the active
// page and hides all others by toggling the "active" CSS class.
//
// Pages are identified by their HTML id attribute in the format
// "page-<name>". For example, the login page has id="page-login".
//
// Lifecycle callbacks can be registered per page — they fire every
// time the router navigates to that page.
//
// Public API:
//   Router.navigate(pageName)              → Show a page by name
//   Router.onNavigate(pageName, callback)  → Register a lifecycle callback
//   Router.getCurrentPage()               → Get the currently active page name
// ============================================================

const Router = (function () {

    // Name of the page currently displayed ("login", "register", or "app")
    let currentPage = null;

    // Map of pageName → callback function, executed on each navigation
    const pageCallbacks = {};

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    /**
     * Navigate to a page identified by its name.
     * Hides all other pages and shows the requested one.
     *
     * @param {string} pageName - e.g. "login", "register", "app"
     */
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

            // Fire the per-page lifecycle callback if one was registered
            if (pageCallbacks[pageName]) {
                pageCallbacks[pageName]();
            }
        } else {
            console.error(`[Router] Page not found: #page-${pageName}`);
        }
    }

    /**
     * Register a callback to be called every time a specific page is navigated to.
     * Useful for triggering data loads when a page becomes active.
     *
     * @param {string}   pageName - Page to observe (e.g. "app")
     * @param {Function} callback - Function to call on each navigation to this page
     */
    function onNavigate(pageName, callback) {
        pageCallbacks[pageName] = callback;
    }

    /**
     * Return the name of the currently active page.
     * @returns {string|null}
     */
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
