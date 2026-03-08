// auth-db.js — manages the users collection in localStorage
// Only server-layer modules should call this directly

const AuthDB = (function () {

    const DB_KEY = "contacthub_users_db";

    // Create the database if it doesn't exist yet
    function init() {
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify([]));
            console.log("[AuthDB] Users database initialized.");
        }
    }

    // Read all users from localStorage
    function _readAll() {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : [];
    }

    // Write users array back to localStorage
    function _writeAll(users) {
        localStorage.setItem(DB_KEY, JSON.stringify(users));
    }

    // Generate a unique user ID
    function _generateId() {
        return "u_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }

    // Find a user by username, returns null if not found
    function findByUsername(username) {
        const users = _readAll();
        return users.find(u => u.username === username) || null;
    }

    // Add a new user to the database
    function addUser(userData) {
        const users = _readAll();

        // Reject if the username is already taken
        if (users.find(u => u.username === userData.username)) {
            return { success: false, error: "USERNAME_EXISTS" };
        }

        const newUser = {
            id: _generateId(),
            username: userData.username,
            password: userData.password,   // NOTE: hash passwords in a real app
            fullName: userData.fullName,
            email: userData.email,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        _writeAll(users);
        console.log("[AuthDB] User added:", newUser.username);

        // Return the user without exposing the password
        const { password, ...safeUser } = newUser;
        return { success: true, user: safeUser };
    }

    // Check if a username + password combination is valid
    function validateCredentials(username, password) {
        const user = findByUsername(username);

        if (!user) {
            return { success: false, error: "USER_NOT_FOUND" };
        }
        if (user.password !== password) {
            return { success: false, error: "WRONG_PASSWORD" };
        }

        // Return the user without exposing the password
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
