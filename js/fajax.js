// ============================================================
// FAJAX.js — Fake AJAX (Communication Layer)
// ============================================================
// This module simulates the browser's XMLHttpRequest API for use
// in our in-browser network simulation. Rather than making real
// HTTP calls, it passes messages through the Network module, which
// adds realistic latency and packet loss.
//
// Two exports:
//
//   class FXMLHttpRequest
//     Mimics the real XMLHttpRequest class. Use it the same way:
//       const xhr = new FXMLHttpRequest();
//       xhr.open("POST", "auth-server:/auth/login");
//       xhr.setRequestHeader("Content-Type", "application/json");
//       xhr.onload = function() { ... };
//       xhr.ontimeout = function() { ... };
//       xhr.send(JSON.stringify({ username, password }));
//
//   function fajaxRequest(options) → Promise
//     A convenience wrapper around FXMLHttpRequest that:
//       - Returns a Promise (works with async/await)
//       - Automatically retries on timeout/error (configurable)
//       - Parses the JSON response body automatically
//
// URL format used by this project:
//   "<server-name>:/<path>"
//   Examples:
//     "auth-server:/auth/login"
//     "data-server:/api/contacts"
//     "data-server:/api/contacts/c_17000_abc12"
// ============================================================


// ============================================================
// CLASS: FXMLHttpRequest
// ============================================================
class FXMLHttpRequest {

    constructor() {
        // ── State ─────────────────────────────────────────────
        // Mirrors the real XHR readyState values:
        //   0 = UNSENT, 1 = OPENED, 2 = HEADERS_RECEIVED,
        //   3 = LOADING, 4 = DONE
        this.readyState = 0;
        this.status = 0;      // HTTP status code (e.g. 200, 404)
        this.statusText = "";     // HTTP status text (e.g. "OK", "Not Found")
        this.responseText = "";    // Raw response body (JSON string)

        // ── Request details ───────────────────────────────────
        this._headers = {};   // Request headers
        this._method = "";
        this._url = "";   // Path portion (e.g. "/auth/login")
        this._serverTarget = "";   // Server name (e.g. "auth-server")

        // ── Callbacks (set by the caller) ─────────────────────
        this.onload = null;     // Called when a response is received successfully
        this.onerror = null;     // Called on a network error
        this.ontimeout = null;     // Called when the request times out

        // ── Timeout configuration ─────────────────────────────
        // Default is 8 000 ms — enough to survive worst-case round-trip
        // (up to 3 s outbound + 3 s inbound = 6 s, plus some buffer).
        this.timeout = 8000;
        this._timeoutId = null;
        this._completed = false;  // Guard against double-firing callbacks
    }

    // ----------------------------------------------------------
    // open(method, url)
    // ----------------------------------------------------------
    // Prepare the request. Must be called before send().
    //
    // @param {string} method - HTTP verb: "GET", "POST", "PUT", "DELETE"
    // @param {string} url    - Server + path: "auth-server:/auth/login"
    // ----------------------------------------------------------
    open(method, url) {
        this._method = method.toUpperCase();

        // Parse: "auth-server:/auth/login" → server="auth-server", path="/auth/login"
        const sep = url.indexOf(":/");
        if (sep > 0) {
            this._serverTarget = url.substring(0, sep);
            this._url = url.substring(sep + 1);
        } else {
            // No server prefix → default to data-server
            this._serverTarget = "data-server";
            this._url = url;
        }

        this.readyState = 1; // OPENED
        console.log(`[FAJAX] Request prepared: ${this._method} ${this._serverTarget}:${this._url}`);
    }

    // ----------------------------------------------------------
    // setRequestHeader(name, value)
    // ----------------------------------------------------------
    setRequestHeader(name, value) {
        this._headers[name] = value;
    }

    // ----------------------------------------------------------
    // send(body)
    // ----------------------------------------------------------
    // Transmit the request through the Network module.
    // The body should already be a JSON string (use JSON.stringify).
    // ----------------------------------------------------------
    send(body) {
        this.readyState = 2;     // HEADERS_RECEIVED (simulated)
        this._completed = false;

        console.log(`[FAJAX] 🚀 Sending: ${this._method} ${this._serverTarget}:${this._url}`);

        // Build the network message packet
        const message = {
            to: this._serverTarget,
            method: this._method,
            url: this._url,
            headers: { ...this._headers },
            body: body
        };

        // ── Start the timeout timer ───────────────────────────
        // If the Network drops both outbound and return packets, the
        // timeout is the only signal the client will ever receive.
        this._timeoutId = setTimeout(() => {
            if (!this._completed) {
                this._completed = true;
                this.readyState = 4;
                this.status = 0;
                this.statusText = "Timeout";
                console.log(
                    `[FAJAX] ⏰ TIMEOUT after ${this.timeout}ms` +
                    ` for ${this._method} ${this._url}`
                );
                if (this.ontimeout) {
                    this.ontimeout();
                } else if (this.onerror) {
                    this.onerror({ type: "timeout" });
                }
            }
        }, this.timeout);

        // ── Hand off to the Network ───────────────────────────
        Network.send(message, this);
    }

    // ----------------------------------------------------------
    // _receiveResponse(response)  [called by the Network module]
    // ----------------------------------------------------------
    // This method is called by Network when it delivers the server
    // response back to this FAJAX object after the simulated delay.
    //
    // @param {object} response - { status, statusText, body }
    // ----------------------------------------------------------
    _receiveResponse(response) {
        // If the timeout already fired, ignore this late response
        if (this._completed) {
            console.log("[FAJAX] Late response ignored (timeout already fired).");
            return;
        }

        this._completed = true;

        // Cancel the pending timeout
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }

        // Populate XHR-like properties
        this.readyState = 4; // DONE
        this.status = response.status;
        this.statusText = response.statusText;
        this.responseText = response.body;

        console.log(`[FAJAX] ✅ Response received: ${this.status} ${this.statusText}`);

        if (this.onload) {
            this.onload();
        }
    }
}


// ============================================================
// HELPER FUNCTION: fajaxRequest(options) → Promise
// ============================================================
// A Promise-based convenience wrapper that handles retries on
// timeout or error. The client layer uses this with async/await.
//
// @param {object} options - {
//   method:   string        (required) — "GET", "POST", "PUT", "DELETE"
//   url:      string        (required) — "auth-server:/auth/login"
//   headers:  object        (optional) — e.g. { Authorization: "Bearer tok_..." }
//   body:     object|null   (optional) — will be JSON.stringify-ed automatically
//   timeout:  number        (optional) — ms before a single attempt times out
//   retries:  number        (optional) — max number of attempts (default: 2)
// }
//
// @returns Promise<{ status, statusText, data }>
//   Resolves when any attempt succeeds (regardless of HTTP status code).
//   Rejects with { type, message } after all retries are exhausted.
// ============================================================
function fajaxRequest(options) {
    const maxAttempts = options.retries || 2;
    let attempt = 0;

    return new Promise(function (resolve, reject) {

        function tryRequest() {
            attempt++;
            console.log(
                `[FAJAX Helper] Attempt ${attempt}/${maxAttempts}` +
                ` — ${options.method} ${options.url}`
            );

            const xhr = new FXMLHttpRequest();
            xhr.open(options.method, options.url);

            // Set optional request headers
            if (options.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    xhr.setRequestHeader(key, value);
                }
            }

            // Override the default timeout if specified
            if (options.timeout) {
                xhr.timeout = options.timeout;
            }

            // ── Success callback ──────────────────────────────
            xhr.onload = function () {
                let parsed;
                try {
                    parsed = JSON.parse(xhr.responseText);
                } catch (e) {
                    // If the server returned non-JSON, pass it through as-is
                    parsed = xhr.responseText;
                }
                resolve({
                    status: xhr.status,
                    statusText: xhr.statusText,
                    data: parsed
                });
            };

            // ── Timeout callback — retry if attempts remain ───
            xhr.ontimeout = function () {
                console.log(`[FAJAX Helper] Attempt ${attempt} timed out.`);
                if (attempt < maxAttempts) {
                    console.log("[FAJAX Helper] ♻️  Retrying...");
                    tryRequest();
                } else {
                    reject({
                        type: "timeout",
                        message: `Request failed after ${maxAttempts} attempts (network timeout).`
                    });
                }
            };

            // ── Error callback — retry if attempts remain ─────
            xhr.onerror = function (err) {
                console.log(`[FAJAX Helper] Attempt ${attempt} errored.`);
                if (attempt < maxAttempts) {
                    tryRequest();
                } else {
                    reject({
                        type: "error",
                        message: "Network error — all retry attempts failed."
                    });
                }
            };

            // Serialize the body to JSON before sending
            const body = options.body ? JSON.stringify(options.body) : null;
            xhr.send(body);
        }

        tryRequest();
    });
}
