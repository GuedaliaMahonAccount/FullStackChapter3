// ============================================================
// AUTH-DB.js — Users Database (DB Layer)
// ============================================================
// This module manages the Users collection stored in localStorage.
// IMPORTANT: This module must only be called by server-layer modules.
//            The client layer must NEVER access the database directly.
//
// Public API:
//   AuthDB.init()                          → Initialize the database
//   AuthDB.findByUsername(username)        → Find a user by username
//   AuthDB.addUser(userData)              → Register a new user
//   AuthDB.validateCredentials(u, p)      → Check login credentials
// ============================================================

const AuthDB = (function () {

    // The key used to store the users array in localStorage
    const DB_KEY = "contacthub_users_db";

    // ----------------------------------------------------------
    // INIT — Create the database if it does not exist yet
    // ----------------------------------------------------------
    function init() {
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify([]));
            console.log("[AuthDB] Users database initialized.");
        }
    }

    // ----------------------------------------------------------
    // Internal helpers (private)
    // ----------------------------------------------------------

    /** Read and parse the full users array from localStorage */
    function _readAll() {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : [];
    }

    /** Serialize and write the users array back to localStorage */
    function _writeAll(users) {
        localStorage.setItem(DB_KEY, JSON.stringify(users));
    }

    /** Generate a unique user ID (e.g. "u_1700000000000_ab3f2") */
    function _generateId() {
        return "u_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    /**
     * Find a user record by username.
     * @returns {object|null} The user object, or null if not found.
     */
    function findByUsername(username) {
        const users = _readAll();
        return users.find(u => u.username === username) || null;
    }

    /**
     * Add a new user to the database.
     * @param {object} userData - { username, password, fullName, email }
     * @returns {{ success: boolean, user?: object, error?: string }}
     */
    function addUser(userData) {
        const users = _readAll();

        // Reject if the username is already taken
        if (users.find(u => u.username === userData.username)) {
            return { success: false, error: "USERNAME_EXISTS" };
        }

        const newUser = {
            id: _generateId(),
            username: userData.username,
            password: userData.password,   // NOTE: In a real app, always hash passwords!
            fullName: userData.fullName,
            email: userData.email,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        _writeAll(users);
        console.log("[AuthDB] User added:", newUser.username);

        // Return the user record without the password
        const { password, ...safeUser } = newUser;
        return { success: true, user: safeUser };
    }

    /**
     * Validate a username + password combination.
     * @returns {{ success: boolean, user?: object, error?: string }}
     */
    function validateCredentials(username, password) {
        const user = findByUsername(username);

        if (!user) {
            return { success: false, error: "USER_NOT_FOUND" };
        }
        if (user.password !== password) {
            return { success: false, error: "WRONG_PASSWORD" };
        }

        // Return the user record without the password
        const { password: pwd, ...safeUser } = user;
        return { success: true, user: safeUser };
    }

    // Expose only the public API
    return {
        init,
        findByUsername,
        addUser,
        validateCredentials
    };

})();
