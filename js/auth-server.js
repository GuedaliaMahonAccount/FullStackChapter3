// auth-server.js — handles all authentication requests
// Routes: POST /auth/login, POST /auth/register, POST /auth/logout, GET /auth/validate

const AuthServer = (function () {

    // In-memory session store: token → { userId, username, createdAt }
    // Not persisted — sessions reset on page reload (intentional)
    const sessions = {};

    // Generate a unique session token
    function _generateToken() {
        return "tok_" + Date.now() + "_" + Math.random().toString(36).substr(2, 12);
    }

    // Parse a JSON request body (handles both string and object inputs)
    function _parseBody(body) {
        if (!body) return null;
        if (typeof body === "object") return body;
        try { return JSON.parse(body); }
        catch (e) { return null; }
    }

    // Extract the Bearer token from the Authorization header
    function _extractToken(headers) {
        if (!headers) return null;
        const auth = headers["Authorization"] || headers["authorization"];
        if (!auth) return null;
        return auth.startsWith("Bearer ") ? auth.substring(7) : auth;
    }

    // Build a standard HTTP-like response object
    function _response(status, statusText, body) {
        return {
            status: status,
            statusText: statusText,
            body: JSON.stringify(body)
        };
    }

    function _handleLogin(request) {
        const body = _parseBody(request.body);
        if (!body) return _response(400, "Bad Request", { error: "INVALID_BODY" });

        const { username, password } = body;
        if (!username || !password) {
            return _response(400, "Bad Request", { error: "MISSING_FIELDS" });
        }

        // Delegate credential check to the DB layer
        const result = AuthDB.validateCredentials(username, password);

        if (!result.success) {
            if (result.error === "USER_NOT_FOUND") {
                return _response(401, "Unauthorized", {
                    error: "USER_NOT_FOUND",
                    message: "Username not found. Please check your username."
                });
            }
            return _response(401, "Unauthorized", {
                error: "WRONG_PASSWORD",
                message: "Incorrect password. Please try again."
            });
        }

        // Create a new session token
        const token = _generateToken();
        sessions[token] = {
            userId: result.user.id,
            username: result.user.username,
            createdAt: Date.now()
        };

        console.log("[AuthServer] Login successful for:", username, "| Token:", token);
        return _response(200, "OK", {
            message: "Login successful",
            token: token,
            user: result.user
        });
    }

    function _handleRegister(request) {
        const body = _parseBody(request.body);
        if (!body) return _response(400, "Bad Request", { error: "INVALID_BODY" });

        const { username, password, fullName, email } = body;
        if (!username || !password || !fullName || !email) {
            return _response(400, "Bad Request", { error: "MISSING_FIELDS" });
        }

        // Server-side validation
        if (username.length < 3) {
            return _response(400, "Bad Request", { error: "USERNAME_TOO_SHORT" });
        }
        if (password.length < 4) {
            return _response(400, "Bad Request", { error: "PASSWORD_TOO_SHORT" });
        }

        // Delegate to the DB layer
        const result = AuthDB.addUser({ username, password, fullName, email });

        if (!result.success) {
            return _response(409, "Conflict", {
                error: result.error,
                message: "That username is already taken. Please choose another."
            });
        }

        console.log("[AuthServer] Registration successful for:", username);
        return _response(201, "Created", {
            message: "Account created successfully",
            user: result.user
        });
    }

    function _handleLogout(request) {
        const token = _extractToken(request.headers);
        if (token && sessions[token]) {
            delete sessions[token];
            console.log("[AuthServer] Logout — session invalidated.");
        }
        return _response(200, "OK", { message: "Signed out successfully" });
    }

    function _handleValidateToken(request) {
        const token = _extractToken(request.headers);
        if (!token || !sessions[token]) {
            return _response(401, "Unauthorized", { error: "INVALID_TOKEN" });
        }
        return _response(200, "OK", {
            valid: true,
            userId: sessions[token].userId,
            username: sessions[token].username
        });
    }

    // Route an incoming request to the correct handler
    function handleRequest(request) {
        console.log("[AuthServer] Request received:", request.method, request.url);

        const method = request.method.toUpperCase();
        const url = request.url;

        if (method === "POST" && url === "/auth/login") return _handleLogin(request);
        if (method === "POST" && url === "/auth/register") return _handleRegister(request);
        if (method === "POST" && url === "/auth/logout") return _handleLogout(request);
        if (method === "GET" && url === "/auth/validate") return _handleValidateToken(request);

        return _response(404, "Not Found", { error: "ROUTE_NOT_FOUND" });
    }

    // Allow DataServer to validate a token directly (without going through the Network)
    function validateToken(token) {
        if (!token || !sessions[token]) return null;
        return sessions[token];
    }

    // Expose only the public API
    return {
        handleRequest,
        validateToken
    };

})();
