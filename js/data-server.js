// ============================================================
// DATA-SERVER.js — Contacts Data Server (Server Layer)
// ============================================================
// This logical server handles all CRUD operations on the Contacts resource.
// Every request MUST include a valid Bearer token in the Authorization header.
// The token is verified by calling AuthServer.validateToken() directly
// (without going through the Network, to avoid infinite loops).
//
// REST Endpoints:
//   GET    /api/contacts                  → Get all contacts for the logged-in user
//   GET    /api/contacts/:id              → Get a specific contact
//   POST   /api/contacts                  → Create a new contact
//   PUT    /api/contacts/:id              → Update an existing contact
//   DELETE /api/contacts/:id              → Delete a contact
//   GET    /api/contacts/search?q=<text>  → Search contacts by name/phone/email
//
// IMPORTANT: This server only reads/writes data via DataDB. It never
//            touches localStorage directly.
// ============================================================

const DataServer = (function () {

    // ----------------------------------------------------------
    // Internal helpers (private)
    // ----------------------------------------------------------

    /** Parse a JSON request body (handles both string and object inputs) */
    function _parseBody(body) {
        if (!body) return null;
        if (typeof body === "object") return body;
        try { return JSON.parse(body); }
        catch (e) { return null; }
    }

    /** Extract the Bearer token from the Authorization header */
    function _extractToken(headers) {
        if (!headers) return null;
        const auth = headers["Authorization"] || headers["authorization"];
        if (!auth) return null;
        return auth.startsWith("Bearer ") ? auth.substring(7) : auth;
    }

    /** Build a standard HTTP-like response object */
    function _response(status, statusText, body) {
        return {
            status: status,
            statusText: statusText,
            body: JSON.stringify(body)
        };
    }

    /**
     * Parse a URL into its base path and optional resource ID.
     * Examples:
     *   "/api/contacts"          → { path: "/api/contacts", id: null }
     *   "/api/contacts/c_123"    → { path: "/api/contacts", id: "c_123" }
     *   "/api/contacts/search"   → { path: "/api/contacts/search", id: null }
     */
    function _parseUrl(url) {
        const parts = url.split("?")[0].split("/").filter(Boolean);
        // parts could be: ["api", "contacts"] or ["api", "contacts", "c_123"]
        if (
            parts.length >= 3 &&
            parts[0] === "api" &&
            parts[1] === "contacts" &&
            parts[2] !== "search"
        ) {
            return { path: "/api/contacts", id: parts[2] };
        }
        return { path: "/" + parts.join("/"), id: null };
    }

    /** Extract the ?q= query parameter from a URL string */
    function _extractSearchQuery(url) {
        const match = url.match(/[?&]q=([^&]*)/);
        return match ? decodeURIComponent(match[1]) : "";
    }

    // ----------------------------------------------------------
    // Route handlers (private)
    // ----------------------------------------------------------

    function _handleGetAll(userId) {
        const contacts = DataDB.getAllByUser(userId);
        console.log("[DataServer] Returning", contacts.length, "contacts for user:", userId);
        return _response(200, "OK", {
            count: contacts.length,
            data: contacts
        });
    }

    function _handleGetOne(userId, contactId) {
        const contact = DataDB.getById(userId, contactId);
        if (!contact) {
            return _response(404, "Not Found", { error: "CONTACT_NOT_FOUND" });
        }
        return _response(200, "OK", { data: contact });
    }

    function _handleCreate(userId, request) {
        const body = _parseBody(request.body);
        if (!body) return _response(400, "Bad Request", { error: "INVALID_BODY" });

        if (!body.firstName || !body.lastName) {
            return _response(400, "Bad Request", {
                error: "MISSING_FIELDS",
                message: "First name and last name are required."
            });
        }

        const newContact = DataDB.add(userId, body);
        console.log("[DataServer] Contact created:", newContact.id);
        return _response(201, "Created", {
            message: "Contact created successfully",
            data: newContact
        });
    }

    function _handleUpdate(userId, contactId, request) {
        const body = _parseBody(request.body);
        if (!body) return _response(400, "Bad Request", { error: "INVALID_BODY" });

        const updated = DataDB.update(userId, contactId, body);
        if (!updated) {
            return _response(404, "Not Found", { error: "CONTACT_NOT_FOUND" });
        }

        console.log("[DataServer] Contact updated:", contactId);
        return _response(200, "OK", {
            message: "Contact updated successfully",
            data: updated
        });
    }

    function _handleDelete(userId, contactId) {
        const removed = DataDB.remove(userId, contactId);
        if (!removed) {
            return _response(404, "Not Found", { error: "CONTACT_NOT_FOUND" });
        }
        console.log("[DataServer] Contact deleted:", contactId);
        return _response(200, "OK", { message: "Contact deleted successfully" });
    }

    function _handleSearch(userId, query) {
        if (!query) {
            return _response(400, "Bad Request", { error: "MISSING_QUERY" });
        }
        const results = DataDB.search(userId, query);
        return _response(200, "OK", {
            query: query,
            count: results.length,
            data: results
        });
    }

    // ----------------------------------------------------------
    // PUBLIC — Entry point called by the Network module
    // ----------------------------------------------------------

    /**
     * Route an incoming request to the correct handler.
     * Step 1: Authenticate the request (validate Bearer token).
     * Step 2: Parse the URL and dispatch to the right handler.
     *
     * @param {object} request - { method, url, headers, body }
     * @returns {object} response - { status, statusText, body }
     */
    function handleRequest(request) {
        console.log("[DataServer] Request received:", request.method, request.url);

        // ── Step 1: Authentication ──────────────────────────────
        const token = _extractToken(request.headers);
        const session = AuthServer.validateToken(token);

        if (!session) {
            console.log("[DataServer] Invalid token — access denied.");
            return _response(401, "Unauthorized", {
                error: "UNAUTHORIZED",
                message: "Invalid or expired token. Please sign in again."
            });
        }

        // ── Step 2: Route the request ───────────────────────────
        const userId = session.userId;
        const method = request.method.toUpperCase();
        const { path, id } = _parseUrl(request.url);

        if (method === "GET" && path === "/api/contacts" && !id) return _handleGetAll(userId);
        if (method === "GET" && path === "/api/contacts" && id) return _handleGetOne(userId, id);
        if (method === "POST" && path === "/api/contacts" && !id) return _handleCreate(userId, request);
        if (method === "PUT" && path === "/api/contacts" && id) return _handleUpdate(userId, id, request);
        if (method === "DELETE" && path === "/api/contacts" && id) return _handleDelete(userId, id);

        // Search route: GET /api/contacts/search?q=...
        if (method === "GET" && request.url.startsWith("/api/contacts/search")) {
            return _handleSearch(userId, _extractSearchQuery(request.url));
        }

        return _response(404, "Not Found", { error: "ROUTE_NOT_FOUND" });
    }

    // Expose only the public API
    return {
        handleRequest
    };

})();
