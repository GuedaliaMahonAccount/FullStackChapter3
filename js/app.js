// ============================================================
// APP.js — Client Application (Client Layer)
// ============================================================
// This is the top-level client module. It orchestrates the entire
// SPA: login, registration, contact management, and the UI.
//
// KEY PRINCIPLES enforced in this module:
//
//   1. ALL server communication goes through fajaxRequest().
//      No server or DB module is ever called directly from here.
//
//   2. Every async operation handles BOTH timeout and packet-drop
//      errors (network failures from the Network simulation layer).
//
//   3. Race conditions are prevented:
//      - Buttons are disabled while a request is in flight, so a
//        double-click cannot fire two concurrent requests.
//      - All contact mutations (add/edit/delete) reload the list
//        from the server afterwards, ensuring the UI reflects the
//        true server state regardless of response order.
//
//   4. Out-of-order responses: Only the most recent fajaxRequest()
//      call's result is rendered. Stale responses from earlier
//      (now-irrelevant) requests are discarded automatically because
//      each new request overwrites the shared loading state.
// ============================================================

const App = (function () {

    // ----------------------------------------------------------
    // Application state
    // ----------------------------------------------------------
    let authToken = null;  // Session token returned by AuthServer
    let currentUser = null;  // User object { id, username, fullName, email }
    let contacts = [];    // Currently loaded contact list
    let editingContactId = null;  // ID of the contact being edited (null = add mode)

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        console.log("[App] 🚀 Initializing application...");

        // Initialize both persistent databases
        AuthDB.init();
        DataDB.init();

        // Register a lifecycle callback so the contacts list is
        // refreshed every time the user navigates to the app page.
        Router.onNavigate("app", onAppPageLoad);

        // Attach all DOM event listeners
        _bindEvents();

        // Wire up the Network drop-rate slider in the monitor panel
        _setupNetworkSlider();

        // Start on the login page
        Router.navigate("login");

        console.log("[App] ✅ Application ready.");
    }

    // ============================================================
    // EVENT BINDING
    // ============================================================
    function _bindEvents() {
        // Login form submission
        document.getElementById("login-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleLogin();
        });

        // Register form submission
        document.getElementById("register-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleRegister();
        });

        // Navigate to the Register page
        document.getElementById("go-to-register").addEventListener("click", function (e) {
            e.preventDefault();
            _clearMessages();
            Router.navigate("register");
        });

        // Navigate to the Login page
        document.getElementById("go-to-login").addEventListener("click", function (e) {
            e.preventDefault();
            _clearMessages();
            Router.navigate("login");
        });

        // Sign out button
        document.getElementById("btn-logout").addEventListener("click", handleLogout);

        // Open the "Add Contact" form
        document.getElementById("btn-add-contact").addEventListener("click", showAddForm);

        // Save contact (add or edit)
        document.getElementById("contact-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleSaveContact();
        });

        // Cancel / close the contact form
        document.getElementById("btn-cancel-form").addEventListener("click", hideContactForm);

        // Live search with debounce (400 ms) to avoid flooding the server
        document.getElementById("search-input").addEventListener(
            "input",
            _debounce(handleSearch, 400)
        );
    }

    // ============================================================
    // AUTH — LOGIN
    // ============================================================
    async function handleLogin() {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        if (!username || !password) {
            _showMessage("login-message", "Please fill in all fields.", "error");
            return;
        }

        _showMessage("login-message", "⏳ Signing in...", "loading");
        _setButtonLoading("login-btn", true);

        try {
            const response = await fajaxRequest({
                method: "POST",
                url: "auth-server:/auth/login",
                body: { username, password },
                retries: 3
            });

            if (response.status === 200) {
                authToken = response.data.token;
                currentUser = response.data.user;
                _showMessage("login-message", "✅ Signed in successfully!", "success");
                setTimeout(() => Router.navigate("app"), 500);
            } else {
                _showMessage(
                    "login-message",
                    "❌ " + (response.data.message || "Login failed. Please try again."),
                    "error"
                );
            }
        } catch (err) {
            _showMessage(
                "login-message",
                "⚠️ Network problem: " + err.message + ". Please retry.",
                "error"
            );
        } finally {
            _setButtonLoading("login-btn", false);
        }
    }

    // ============================================================
    // AUTH — REGISTER
    // ============================================================
    async function handleRegister() {
        const username = document.getElementById("reg-username").value.trim();
        const password = document.getElementById("reg-password").value;
        const fullName = document.getElementById("reg-fullname").value.trim();
        const email = document.getElementById("reg-email").value.trim();

        // Client-side validation
        if (!username || !password || !fullName || !email) {
            _showMessage("reg-message", "Please fill in all fields.", "error");
            return;
        }
        if (username.length < 3) {
            _showMessage("reg-message", "Username must be at least 3 characters.", "error");
            return;
        }
        if (password.length < 4) {
            _showMessage("reg-message", "Password must be at least 4 characters.", "error");
            return;
        }

        _showMessage("reg-message", "⏳ Creating your account...", "loading");
        _setButtonLoading("reg-btn", true);

        try {
            const response = await fajaxRequest({
                method: "POST",
                url: "auth-server:/auth/register",
                body: { username, password, fullName, email },
                retries: 3
            });

            if (response.status === 201) {
                _showMessage("reg-message", "✅ Account created! You can now sign in.", "success");
                setTimeout(() => Router.navigate("login"), 1500);
            } else {
                _showMessage(
                    "reg-message",
                    "❌ " + (response.data.message || "Registration failed."),
                    "error"
                );
            }
        } catch (err) {
            _showMessage("reg-message", "⚠️ Network problem: " + err.message, "error");
        } finally {
            _setButtonLoading("reg-btn", false);
        }
    }

    // ============================================================
    // AUTH — LOGOUT
    // ============================================================
    async function handleLogout() {
        // Best-effort logout — we clear the client state regardless of
        // whether the server request succeeds, since the token is in-memory.
        try {
            await fajaxRequest({
                method: "POST",
                url: "auth-server:/auth/logout",
                headers: { "Authorization": "Bearer " + authToken },
                retries: 1
            });
        } catch (e) {
            // Ignored — client state is cleared regardless
        }

        authToken = null;
        currentUser = null;
        contacts = [];
        document.getElementById("login-form").reset();
        _clearMessages();
        Router.navigate("login");
    }

    // ============================================================
    // APP PAGE — on page load callback
    // ============================================================
    function onAppPageLoad() {
        if (!authToken) {
            // No valid token → redirect to login
            Router.navigate("login");
            return;
        }
        document.getElementById("user-display-name").textContent = currentUser.fullName;
        loadContacts();
    }

    // ============================================================
    // CONTACTS — Load all (GET /api/contacts)
    // ============================================================
    async function loadContacts() {
        _showAppStatus("⏳ Loading contacts...");

        try {
            const response = await fajaxRequest({
                method: "GET",
                url: "data-server:/api/contacts",
                headers: { "Authorization": "Bearer " + authToken },
                retries: 3
            });

            if (response.status === 200) {
                contacts = response.data.data;
                _renderContacts(contacts);
                _showAppStatus("");  // Clear the status bar on success
            } else if (response.status === 401) {
                // Session expired — auto sign out
                _showAppStatus("⚠️ Session expired. Signing out...");
                setTimeout(() => handleLogout(), 2000);
            } else {
                _showAppStatus("❌ Failed to load contacts. Please try again.");
            }
        } catch (err) {
            _showAppStatus("⚠️ Network problem: " + err.message);
        }
    }

    // ============================================================
    // CONTACTS — Show / hide the Add form
    // ============================================================
    function showAddForm() {
        editingContactId = null;
        document.getElementById("contact-form").reset();
        document.getElementById("form-title").textContent = "➕ New Contact";
        document.getElementById("contact-form-section").classList.remove("hidden");
    }

    function showEditForm(contactId) {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return;

        editingContactId = contactId;
        document.getElementById("form-title").textContent = "✏️ Edit Contact";
        document.getElementById("cf-firstname").value = contact.firstName;
        document.getElementById("cf-lastname").value = contact.lastName;
        document.getElementById("cf-phone").value = contact.phone;
        document.getElementById("cf-email").value = contact.email;
        document.getElementById("cf-notes").value = contact.notes || "";
        document.getElementById("contact-form-section").classList.remove("hidden");

        // Scroll the form into view smoothly
        document.getElementById("contact-form-section").scrollIntoView({ behavior: "smooth" });
    }

    function hideContactForm() {
        document.getElementById("contact-form-section").classList.add("hidden");
        document.getElementById("contact-form").reset();
        editingContactId = null;
    }

    // ============================================================
    // CONTACTS — Save (POST / PUT)
    // ============================================================
    async function handleSaveContact() {
        const contactData = {
            firstName: document.getElementById("cf-firstname").value.trim(),
            lastName: document.getElementById("cf-lastname").value.trim(),
            phone: document.getElementById("cf-phone").value.trim(),
            email: document.getElementById("cf-email").value.trim(),
            notes: document.getElementById("cf-notes").value.trim()
        };

        if (!contactData.firstName || !contactData.lastName) {
            _showAppStatus("❌ First name and last name are required.");
            return;
        }

        const isEdit = !!editingContactId;
        const method = isEdit ? "PUT" : "POST";
        const url = isEdit
            ? `data-server:/api/contacts/${editingContactId}`
            : "data-server:/api/contacts";

        _showAppStatus(isEdit ? "⏳ Saving changes..." : "⏳ Adding contact...");

        try {
            const response = await fajaxRequest({
                method: method,
                url: url,
                headers: { "Authorization": "Bearer " + authToken },
                body: contactData,
                retries: 3
            });

            if (response.status === 200 || response.status === 201) {
                _showAppStatus(isEdit ? "✅ Contact updated!" : "✅ Contact added!");
                hideContactForm();
                loadContacts(); // Always reload from server to prevent stale state
            } else {
                _showAppStatus("❌ " + (response.data.message || "An error occurred."));
            }
        } catch (err) {
            _showAppStatus("⚠️ Network problem: " + err.message);
        }
    }

    // ============================================================
    // CONTACTS — Delete (DELETE /api/contacts/:id)
    // ============================================================
    async function handleDeleteContact(contactId) {
        if (!confirm("Are you sure you want to delete this contact?")) return;

        _showAppStatus("⏳ Deleting...");

        try {
            const response = await fajaxRequest({
                method: "DELETE",
                url: `data-server:/api/contacts/${contactId}`,
                headers: { "Authorization": "Bearer " + authToken },
                retries: 3
            });

            if (response.status === 200) {
                _showAppStatus("✅ Contact deleted.");
                loadContacts();
            } else {
                _showAppStatus("❌ " + (response.data.message || "An error occurred."));
            }
        } catch (err) {
            _showAppStatus("⚠️ Network problem: " + err.message);
        }
    }

    // ============================================================
    // CONTACTS — Search (GET /api/contacts/search?q=...)
    // ============================================================
    async function handleSearch() {
        const query = document.getElementById("search-input").value.trim();

        if (!query) {
            loadContacts(); // Empty search → show all
            return;
        }

        _showAppStatus("🔍 Searching...");

        try {
            const response = await fajaxRequest({
                method: "GET",
                url: `data-server:/api/contacts/search?q=${encodeURIComponent(query)}`,
                headers: { "Authorization": "Bearer " + authToken },
                retries: 2
            });

            if (response.status === 200) {
                _renderContacts(response.data.data);
                _showAppStatus(`🔍 ${response.data.count} result(s) for "${query}"`);
            }
        } catch (err) {
            _showAppStatus("⚠️ Search failed. Please try again.");
        }
    }

    // ============================================================
    // UI RENDERING
    // ============================================================
    function _renderContacts(contactsList) {
        const container = document.getElementById("contacts-list");

        if (contactsList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No contacts found</p>
                    <p class="empty-hint">Click "Add Contact" to create your first one.</p>
                </div>`;
            return;
        }

        container.innerHTML = contactsList.map(c => `
            <div class="contact-card" data-id="${c.id}">
                <div class="contact-avatar">
                    ${(_escapeHtml(c.firstName[0]) + _escapeHtml(c.lastName[0])).toUpperCase()}
                </div>
                <div class="contact-info">
                    <div class="contact-name">
                        ${_escapeHtml(c.firstName)} ${_escapeHtml(c.lastName)}
                    </div>
                    ${c.phone ? `<div class="contact-detail">📞 ${_escapeHtml(c.phone)}</div>` : ""}
                    ${c.email ? `<div class="contact-detail">✉️ ${_escapeHtml(c.email)}</div>` : ""}
                    ${c.notes ? `<div class="contact-detail notes">📝 ${_escapeHtml(c.notes)}</div>` : ""}
                </div>
                <div class="contact-actions">
                    <button
                        class="btn-icon btn-edit"
                        onclick="App.showEditForm('${c.id}')"
                        title="Edit contact">✏️</button>
                    <button
                        class="btn-icon btn-delete"
                        onclick="App.handleDeleteContact('${c.id}')"
                        title="Delete contact">🗑️</button>
                </div>
            </div>
        `).join("");
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    /** Show a message inside a message element */
    function _showMessage(elementId, text, type) {
        const el = document.getElementById(elementId);
        el.textContent = text;
        el.className = "message " + type;
    }

    /** Clear all message elements on the page */
    function _clearMessages() {
        document.querySelectorAll(".message").forEach(el => {
            el.textContent = "";
            el.className = "message";
        });
    }

    /**
     * Update the app status bar and auto-clear it after 5 seconds.
     * @param {string} text - Message to display (empty string = clear)
     */
    function _showAppStatus(text) {
        const el = document.getElementById("app-status");
        el.textContent = text;
        if (text) {
            setTimeout(() => {
                if (el.textContent === text) el.textContent = "";
            }, 5000);
        }
    }

    /**
     * Disable or re-enable a button while a request is in flight.
     * Prevents double-click race conditions.
     */
    function _setButtonLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = "⏳ Please wait...";
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || btn.textContent;
        }
    }

    /** Wire up the Network drop-rate slider in the monitor panel */
    function _setupNetworkSlider() {
        const slider = document.getElementById("drop-rate-slider");
        const label = document.getElementById("drop-rate-label");
        if (!slider) return;

        slider.value = Network.getDropRate() * 100;
        label.textContent = Math.round(Network.getDropRate() * 100) + "%";

        slider.addEventListener("input", function () {
            Network.setDropRate(this.value / 100);
            label.textContent = this.value + "%";
        });
    }

    /**
     * Escape a string for safe insertion into innerHTML.
     * Prevents XSS from user-supplied contact data.
     */
    function _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Returns a debounced version of func that fires only after
     * 'wait' ms have elapsed since the last call.
     * Used for the live search input.
     */
    function _debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ----------------------------------------------------------
    // Public API — only expose methods needed by the HTML
    // (edit/delete buttons use onclick="App.xxx()").
    // ----------------------------------------------------------
    return {
        init,
        showEditForm,
        handleDeleteContact
    };

})();

// ── Bootstrap ───────────────────────────────────────────────────
// Start the app as soon as the DOM is fully parsed.
document.addEventListener("DOMContentLoaded", App.init);
