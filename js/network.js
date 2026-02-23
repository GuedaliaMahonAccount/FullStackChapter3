// ============================================================
// NETWORK.js — Network Simulation Layer
// ============================================================
// This module simulates a real-world network between the client
// (FAJAX) and the servers (AuthServer, DataServer).
//
// It introduces two key behaviours:
//
//   1. RANDOM LATENCY
//      Every message (request AND response) is delayed by a
//      random amount between MIN_DELAY and MAX_DELAY milliseconds.
//      This forces the client to handle asynchronous responses
//      instead of relying on immediate, synchronous results.
//
//   2. PACKET LOSS (Drop Rate)
//      Each packet has a configurable probability of being
//      silently "dropped" — the message simply never arrives.
//      The drop rate can be set between 10% and 50% via the
//      slider in the UI. When a packet is dropped, no error is
//      returned; the FAJAX timeout handler takes care of it.
//
// How a request travels through this module:
//   Client (FAJAX) → Network.send() → [delay + drop?] → Server
//                                                         ↓
//   Client (FAJAX._receiveResponse) ← [delay + drop?] ← response
//
// Public API:
//   Network.send(message, fajaxObj)   → Send a request packet
//   Network.setDropRate(rate)         → Set drop probability (0.1–0.5)
//   Network.getDropRate()             → Get current drop probability
//   Network.getStats()                → Get { totalSent, totalDropped, totalDelivered }
// ============================================================

const Network = (function () {

    // ----------------------------------------------------------
    // Configuration
    // ----------------------------------------------------------
    let dropRate = 0.15;  // 15% packet loss by default (range: 0.10 – 0.50)
    const MIN_DELAY_MS = 1000;  // Minimum one-way network delay (1 second)
    const MAX_DELAY_MS = 3000;  // Maximum one-way network delay (3 seconds)

    // ----------------------------------------------------------
    // Routing table — maps server names to server objects
    // ----------------------------------------------------------
    const servers = {
        "auth-server": AuthServer,
        "data-server": DataServer
    };

    // ----------------------------------------------------------
    // Real-time statistics
    // ----------------------------------------------------------
    let stats = {
        totalSent: 0,
        totalDropped: 0,
        totalDelivered: 0
    };

    // ----------------------------------------------------------
    // Internal helpers (private)
    // ----------------------------------------------------------

    /** Return a random delay in ms between MIN_DELAY_MS and MAX_DELAY_MS */
    function _randomDelay() {
        return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    }

    /** Return true if this packet should be dropped, based on dropRate */
    function _shouldDrop() {
        return Math.random() < dropRate;
    }

    /** Update the network stats panel in the DOM (if it exists) */
    function _updateUI() {
        const el = document.getElementById("network-stats");
        if (el) {
            el.innerHTML =
                `📡 Network — ` +
                `Sent: ${stats.totalSent} | ` +
                `Delivered: ${stats.totalDelivered} | ` +
                `Dropped: ${stats.totalDropped} | ` +
                `Drop rate: ${(dropRate * 100).toFixed(0)}%`;
        }
    }

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    /**
     * Send a request packet from the client to a server.
     *
     * @param {object} message - {
     *   to:      "auth-server" | "data-server",
     *   method:  HTTP method string,
     *   url:     path string,
     *   headers: key-value object,
     *   body:    JSON string or null
     * }
     * @param {FXMLHttpRequest} fajaxObj - The FAJAX object waiting for the response.
     */
    function send(message, fajaxObj) {
        stats.totalSent++;
        const msgId = stats.totalSent;

        console.log(
            `[Network] 📤 Packet #${msgId} → ${message.to}` +
            ` (${message.method} ${message.url})`
        );

        const requestDelay = _randomDelay();

        // ── Check if the REQUEST packet is dropped ────────────
        if (_shouldDrop()) {
            stats.totalDropped++;
            console.log(
                `[Network] ❌ Packet #${msgId} DROPPED before reaching server.` +
                ` (delay would have been ${requestDelay}ms, drop rate: ${(dropRate * 100).toFixed(0)}%)`
            );
            // Packet is silently lost — FAJAX timeout will fire eventually.
            _updateUI();
            return;
        }

        // ── Simulate request travel time ──────────────────────
        setTimeout(function () {
            console.log(
                `[Network] 📨 Packet #${msgId} arrived at ${message.to}` +
                ` after ${requestDelay}ms`
            );

            // Locate the target server
            const server = servers[message.to];
            if (!server) {
                console.error("[Network] Unknown server:", message.to);
                return;
            }

            // Deliver the request to the server (synchronous processing)
            const response = server.handleRequest({
                method: message.method,
                url: message.url,
                headers: message.headers,
                body: message.body
            });

            const responseDelay = _randomDelay();

            // ── Check if the RESPONSE packet is dropped ───────
            if (_shouldDrop()) {
                stats.totalDropped++;
                console.log(
                    `[Network] ❌ Response #${msgId} DROPPED on its way back to client.` +
                    ` (delay would have been ${responseDelay}ms)`
                );
                _updateUI();
                return;
            }

            // ── Simulate response travel time ─────────────────
            setTimeout(function () {
                stats.totalDelivered++;
                console.log(
                    `[Network] 📬 Response #${msgId} delivered to client` +
                    ` (status: ${response.status}, delay: ${responseDelay}ms)`
                );

                // Hand the response back to the FAJAX object
                fajaxObj._receiveResponse(response);
                _updateUI();

            }, responseDelay);

        }, requestDelay);

        _updateUI();
    }

    /**
     * Set the packet drop probability.
     * Clamped to the allowed range [0.10, 0.50].
     * @param {number} rate - A value between 0.10 and 0.50.
     */
    function setDropRate(rate) {
        dropRate = Math.max(0.10, Math.min(0.50, rate));
        console.log(`[Network] Drop rate set to ${(dropRate * 100).toFixed(0)}%`);
        _updateUI();
    }

    /** Return the current drop probability */
    function getDropRate() {
        return dropRate;
    }

    /** Return a snapshot of the current network statistics */
    function getStats() {
        return { ...stats };
    }

    // Expose only the public API
    return {
        send,
        setDropRate,
        getDropRate,
        getStats
    };

})();
