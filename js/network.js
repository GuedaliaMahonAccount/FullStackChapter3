// network.js — simulates a real-world network between client and servers
// Adds random latency and packet loss to every request and response
//
// Flow: Client (FAJAX) → Network.send() → [delay + drop?] → Server
//                                                              ↓
//       Client (FAJAX._receiveResponse) ← [delay + drop?] ← response

const Network = (function () {

    let dropRate = 0.15; // 15% packet loss by default (range: 0.10 – 0.50)
    const MIN_DELAY_MS = 1000; // minimum one-way delay (ms)
    const MAX_DELAY_MS = 3000; // maximum one-way delay (ms)

    // Routing table — maps server names to server objects
    const servers = {
        "auth-server": AuthServer,
        "data-server": DataServer
    };

    // Real-time statistics
    let stats = {
        totalSent: 0,
        totalDropped: 0,
        totalDelivered: 0
    };

    // Return a random delay between MIN_DELAY_MS and MAX_DELAY_MS
    function _randomDelay() {
        return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    }

    // Return true if this packet should be dropped
    function _shouldDrop() {
        return Math.random() < dropRate;
    }

    let statsChangeCallback = null;

    function onStatsChange(callback) {
        statsChangeCallback = callback;
    }

    // Notify listeners when stats or drop rate change
    function _notifyChange() {
        if (statsChangeCallback) {
            statsChangeCallback(stats, dropRate);
        }
    }

    // Send a request packet from the client to a server
    function send(message, fajaxObj) {
        stats.totalSent++;
        const msgId = stats.totalSent;

        console.log(
            `[Network] 📤 Packet #${msgId} → ${message.to}` +
            ` (${message.method} ${message.url})`
        );

        const requestDelay = _randomDelay();

        // Check if the request packet is dropped
        if (_shouldDrop()) {
            stats.totalDropped++;
            console.log(
                `[Network] ❌ Packet #${msgId} DROPPED before reaching server.` +
                ` (delay would have been ${requestDelay}ms, drop rate: ${(dropRate * 100).toFixed(0)}%)`
            );
            // Packet is silently lost — FAJAX timeout will fire eventually
            _notifyChange();
            return;
        }

        // Simulate request travel time
        setTimeout(function () {
            console.log(
                `[Network] 📨 Packet #${msgId} arrived at ${message.to}` +
                ` after ${requestDelay}ms`
            );

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

            // Check if the response packet is dropped
            if (_shouldDrop()) {
                stats.totalDropped++;
                console.log(
                    `[Network] ❌ Response #${msgId} DROPPED on its way back to client.` +
                    ` (delay would have been ${responseDelay}ms)`
                );
                _notifyChange();
                return;
            }

            // Simulate response travel time
            setTimeout(function () {
                stats.totalDelivered++;
                console.log(
                    `[Network] 📬 Response #${msgId} delivered to client` +
                    ` (status: ${response.status}, delay: ${responseDelay}ms)`
                );

                fajaxObj._receiveResponse(response);
                _notifyChange();

            }, responseDelay);

        }, requestDelay);

        _notifyChange();
    }

    // Set the packet drop probability, clamped to [0.10, 0.50]
    function setDropRate(rate) {
        dropRate = Math.max(0.10, Math.min(0.50, rate));
        console.log(`[Network] Drop rate set to ${(dropRate * 100).toFixed(0)}%`);
        _notifyChange();
    }

    // Return the current drop probability
    function getDropRate() {
        return dropRate;
    }

    // Return a snapshot of the current network statistics
    function getStats() {
        return { ...stats };
    }

    // Expose only the public API
    return {
        send,
        setDropRate,
        getDropRate,
        getStats,
        onStatsChange
    };

})();
