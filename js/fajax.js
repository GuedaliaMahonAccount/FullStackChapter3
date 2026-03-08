// fajax.js — simulates XHR for the in-browser network simulation
// Passes messages through the Network module instead of making real HTTP calls
//
// URL format: "<server-name>:/<path>"
//   e.g. "auth-server:/auth/login"  or  "data-server:/api/contacts"


// FXMLHttpRequest — mimics the real XMLHttpRequest class
class FXMLHttpRequest {

    constructor() {
        // Mirrors real XHR readyState: 0=UNSENT, 1=OPENED, 2=HEADERS_RECEIVED, 3=LOADING, 4=DONE
        this.readyState = 0;
        this.status = 0;
        this.statusText = "";
        this.responseText = "";

        this._headers = {};
        this._method = "";
        this._url = "";          // path portion, e.g. "/auth/login"
        this._serverTarget = ""; // server name, e.g. "auth-server"

        this.onload = null;
        this.onerror = null;
        this.ontimeout = null;

        // Default timeout is 8000ms (covers worst-case 3s out + 3s in + buffer)
        this.timeout = 8000;
        this._timeoutId = null;
        this._completed = false; // guard against double-firing callbacks
    }

    // Prepare the request. Must be called before send().
    // url format: "auth-server:/auth/login"
    open(method, url) {
        this._method = method.toUpperCase();

        // Parse "auth-server:/auth/login" → server="auth-server", path="/auth/login"
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

    setRequestHeader(name, value) {
        this._headers[name] = value;
    }

    // Transmit the request through the Network module
    // The body should already be a JSON string
    send(body) {
        this.readyState = 2; // HEADERS_RECEIVED (simulated)
        this._completed = false;

        console.log(`[FAJAX] 🚀 Sending: ${this._method} ${this._serverTarget}:${this._url}`);

        const message = {
            to: this._serverTarget,
            method: this._method,
            url: this._url,
            headers: { ...this._headers },
            body: body
        };

        // Start the timeout timer — fires if the Network drops both packets
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

        Network.send(message, this);
    }

    // Called by the Network module when it delivers the server response back
    _receiveResponse(response) {
        // Ignore late responses if the timeout already fired
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


// fajaxSend(options, onSuccess, onError) — callback-based wrapper around FXMLHttpRequest
// Handles retries on timeout or error.
//
// options    : { method, url, headers?, body?, timeout?, retries? }
// onSuccess  : function(status, data)  — called when any HTTP response arrives
// onError    : function(message)       — called after all retries are exhausted
function fajaxSend(options, onSuccess, onError) {
    const maxAttempts = options.retries || 2;
    let attempt = 0;

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
            const keys = Object.keys(options.headers);
            for (let i = 0; i < keys.length; i++) {
                xhr.setRequestHeader(keys[i], options.headers[keys[i]]);
            }
        }

        // Override the default timeout if specified
        if (options.timeout) {
            xhr.timeout = options.timeout;
        }

        // Called when the server sends back a response
        xhr.onload = function () {
            let parsed;
            try {
                parsed = JSON.parse(xhr.responseText);
            } catch (e) {
                // Non-JSON response: pass through as-is
                parsed = xhr.responseText;
            }
            onSuccess(xhr.status, parsed);
        };

        // Timeout callback — retry if attempts remain
        xhr.ontimeout = function () {
            console.log(`[FAJAX Helper] Attempt ${attempt} timed out.`);
            if (attempt < maxAttempts) {
                console.log("[FAJAX Helper] ♻️  Retrying...");
                tryRequest();
            } else {
                onError(`Request failed after ${maxAttempts} attempts (network timeout).`);
            }
        };

        // Error callback — retry if attempts remain
        xhr.onerror = function () {
            console.log(`[FAJAX Helper] Attempt ${attempt} errored.`);
            if (attempt < maxAttempts) {
                tryRequest();
            } else {
                onError("Network error — all retry attempts failed.");
            }
        };

        // Serialize the body to JSON before sending
        const body = options.body ? JSON.stringify(options.body) : null;
        xhr.send(body);
    }

    tryRequest();
}
