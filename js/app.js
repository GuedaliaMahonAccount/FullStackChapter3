// app.js — main client module, orchestrates the entire SPA

const App = (function () {

    // Application state
    let authToken = null;        // session token from AuthServer
    let currentUser = null;      // { id, username, fullName, email }
    let contacts = [];           // currently loaded contact list
    let editingContactId = null; // ID of the contact being edited (null = add mode)

    function init() {
        console.log("[App] 🚀 Initializing application...");

        // Initialize both databases
        AuthDB.init();
        DataDB.init();

        // Reload contacts every time the user navigates to the app page
        Router.onNavigate("app", onAppPageLoad);

        _bindEvents();
        _setupNetworkSlider();

        // Start on the login page
        Router.navigate("login");

        console.log("[App] ✅ Application ready.");
    }

    function _bindEvents() {
        document.getElementById("login-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleLogin();
        });

        document.getElementById("register-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleRegister();
        });

        document.getElementById("go-to-register").addEventListener("click", function (e) {
            e.preventDefault();
            _clearMessages();
            Router.navigate("register");
        });

        document.getElementById("go-to-login").addEventListener("click", function (e) {
            e.preventDefault();
            _clearMessages();
            Router.navigate("login");
        });

        document.getElementById("btn-logout").addEventListener("click", handleLogout);
        document.getElementById("btn-add-contact").addEventListener("click", showAddForm);

        document.getElementById("contact-form").addEventListener("submit", function (e) {
            e.preventDefault();
            handleSaveContact();
        });

        document.getElementById("btn-cancel-form").addEventListener("click", hideContactForm);

        // Live search with 400ms debounce to avoid flooding the server
        document.getElementById("search-input").addEventListener(
            "input",
            _debounce(handleSearch, 400)
        );
    }

    // AUTH — LOGIN
    function handleLogin() {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        if (!username || !password) {
            _showMessage("login-message", "Please fill in all fields.", "error");
            return;
        }

        _showMessage("login-message", "⏳ Signing in...", "loading");
        _setButtonLoading("login-btn", true);

        fajaxSend(
            {
                method: "POST",
                url: "auth-server:/auth/login",
                body: { username: username, password: password },
                retries: 3
            },
            function (status, data) {
                _setButtonLoading("login-btn", false);
                if (status === 200) {
                    authToken = data.token;
                    currentUser = data.user;
                    _showMessage("login-message", "✅ Signed in successfully!", "success");
                    setTimeout(function () { Router.navigate("app"); }, 500);
                } else {
                    _showMessage(
                        "login-message",
                        "❌ " + (data.message || "Login failed. Please try again."),
                        "error"
                    );
                }
            },
            function (errorMessage) {
                _setButtonLoading("login-btn", false);
                _showMessage(
                    "login-message",
                    "⚠️ Network problem: " + errorMessage + ". Please retry.",
                    "error"
                );
            }
        );
    }

    // AUTH — REGISTER
    function handleRegister() {
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

        fajaxSend(
            {
                method: "POST",
                url: "auth-server:/auth/register",
                body: { username: username, password: password, fullName: fullName, email: email },
                retries: 3
            },
            function (status, data) {
                _setButtonLoading("reg-btn", false);
                if (status === 201) {
                    _showMessage("reg-message", "✅ Account created! You can now sign in.", "success");
                    setTimeout(function () { Router.navigate("login"); }, 1500);
                } else {
                    _showMessage(
                        "reg-message",
                        "❌ " + (data.message || "Registration failed."),
                        "error"
                    );
                }
            },
            function (errorMessage) {
                _setButtonLoading("reg-btn", false);
                _showMessage("reg-message", "⚠️ Network problem: " + errorMessage, "error");
            }
        );
    }

    // AUTH — LOGOUT
    function handleLogout() {
        // Best-effort: fire-and-forget — clear client state regardless of outcome
        fajaxSend(
            {
                method: "POST",
                url: "auth-server:/auth/logout",
                headers: { "Authorization": "Bearer " + authToken },
                retries: 1
            },
            function () { /* response ignored */ },
            function () { /* error ignored */ }
        );

        authToken = null;
        currentUser = null;
        contacts = [];
        document.getElementById("login-form").reset();
        _clearMessages();
        Router.navigate("login");
    }

    // Called every time the user navigates to the app page
    function onAppPageLoad() {
        if (!authToken) {
            Router.navigate("login");
            return;
        }
        document.getElementById("user-display-name").textContent = currentUser.fullName;
        loadContacts();
    }

    // Load all contacts from the server
    function loadContacts() {
        _showAppStatus("⏳ Loading contacts...");

        fajaxSend(
            {
                method: "GET",
                url: "data-server:/api/contacts",
                headers: { "Authorization": "Bearer " + authToken },
                retries: 3
            },
            function (status, data) {
                if (status === 200) {
                    contacts = data.data;
                    _renderContacts(contacts);
                    _showAppStatus("");
                } else if (status === 401) {
                    // Session expired — auto sign out
                    _showAppStatus("⚠️ Session expired. Signing out...");
                    setTimeout(function () { handleLogout(); }, 2000);
                } else {
                    _showAppStatus("❌ Failed to load contacts. Please try again.");
                }
            },
            function (errorMessage) {
                _showAppStatus("⚠️ Network problem: " + errorMessage);
            }
        );
    }

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

        // Scroll the form into view
        document.getElementById("contact-form-section").scrollIntoView({ behavior: "smooth" });
    }

    function hideContactForm() {
        document.getElementById("contact-form-section").classList.add("hidden");
        document.getElementById("contact-form").reset();
        editingContactId = null;
    }

    // Save contact (add or edit)
    function handleSaveContact() {
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

        fajaxSend(
            {
                method: method,
                url: url,
                headers: { "Authorization": "Bearer " + authToken },
                body: contactData,
                retries: 3
            },
            function (status, data) {
                if (status === 200 || status === 201) {
                    _showAppStatus(isEdit ? "✅ Contact updated!" : "✅ Contact added!");
                    hideContactForm();
                    loadContacts(); // Reload from server to avoid stale state
                } else {
                    _showAppStatus("❌ " + (data.message || "An error occurred."));
                }
            },
            function (errorMessage) {
                _showAppStatus("⚠️ Network problem: " + errorMessage);
            }
        );
    }

    // Delete a contact by ID
    function handleDeleteContact(contactId) {
        if (!confirm("Are you sure you want to delete this contact?")) return;

        _showAppStatus("⏳ Deleting...");

        fajaxSend(
            {
                method: "DELETE",
                url: `data-server:/api/contacts/${contactId}`,
                headers: { "Authorization": "Bearer " + authToken },
                retries: 3
            },
            function (status, data) {
                if (status === 200) {
                    _showAppStatus("✅ Contact deleted.");
                    loadContacts();
                } else {
                    _showAppStatus("❌ " + (data.message || "An error occurred."));
                }
            },
            function (errorMessage) {
                _showAppStatus("⚠️ Network problem: " + errorMessage);
            }
        );
    }

    // Search contacts
    function handleSearch() {
        const query = document.getElementById("search-input").value.trim();

        if (!query) {
            loadContacts(); // Empty search → show all
            return;
        }

        _showAppStatus("🔍 Searching...");

        fajaxSend(
            {
                method: "GET",
                url: `data-server:/api/contacts/search?q=${encodeURIComponent(query)}`,
                headers: { "Authorization": "Bearer " + authToken },
                retries: 2
            },
            function (status, data) {
                if (status === 200) {
                    _renderContacts(data.data);
                    _showAppStatus(`🔍 ${data.count} result(s) for "${query}"`);
                }
            },
            function () {
                _showAppStatus("⚠️ Search failed. Please try again.");
            }
        );
    }

    // Render the contacts list into the DOM
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

    // Show a status message inside a message element
    function _showMessage(elementId, text, type) {
        const el = document.getElementById(elementId);
        el.textContent = text;
        el.className = "message " + type;
    }

    // Clear all message elements on the page
    function _clearMessages() {
        document.querySelectorAll(".message").forEach(el => {
            el.textContent = "";
            el.className = "message";
        });
    }

    // Update the app status bar and auto-clear after 5 seconds
    function _showAppStatus(text) {
        const el = document.getElementById("app-status");
        el.textContent = text;
        if (text) {
            setTimeout(() => {
                if (el.textContent === text) el.textContent = "";
            }, 5000);
        }
    }

    // Disable or re-enable a button while a request is in flight
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

    // Wire up the network drop-rate slider
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

    // Escape a string for safe insertion into innerHTML (prevents XSS)
    function _escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Returns a debounced version of func that fires after 'wait' ms
    function _debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Expose only the methods needed by the HTML (onclick attributes)
    return {
        init,
        showEditForm,
        handleDeleteContact
    };

})();

// Start the app once the DOM is ready
document.addEventListener("DOMContentLoaded", App.init);
