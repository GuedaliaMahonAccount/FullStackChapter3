# 📇 ContactHub — Fullstack Chapter 3

A fully client-side Single Page Application (SPA) that simulates a complete full-stack architecture entirely inside the browser, using `localStorage` as a database.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                        │
│                       app.js                            │
│          (SPA UI: Login, Register, Contacts)            │
└─────────────────────┬───────────────────────────────────┘
                      │  fajaxRequest()
┌─────────────────────▼───────────────────────────────────┐
│               COMMUNICATION LAYER                       │
│    fajax.js (FXMLHttpRequest + fajaxRequest helper)     │
└─────────────────────┬───────────────────────────────────┘
                      │  Network.send()
┌─────────────────────▼───────────────────────────────────┐
│                  NETWORK LAYER                          │
│   network.js — random delay (1–3s) + packet loss        │
│                   (10%–50%)                             │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────────┐   ┌───────────▼────────────────┐
│    AUTH SERVER       │   │       DATA SERVER           │
│  auth-server.js      │   │     data-server.js          │
│  POST /auth/login    │   │  GET    /api/contacts       │
│  POST /auth/register │   │  GET    /api/contacts/:id   │
│  POST /auth/logout   │   │  POST   /api/contacts       │
│  GET  /auth/validate │   │  PUT    /api/contacts/:id   │
└──────────┬───────────┘   │  DELETE /api/contacts/:id   │
           │               │  GET    /api/contacts/search│
           │               └───────────┬────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼───────────────┐
│     AUTH DB          │   │        DATA DB              │
│   auth-db.js         │   │      data-db.js             │
│  (Users collection)  │   │  (Contacts collection)      │
│     localStorage     │   │     localStorage            │
└─────────────────────-┘   └────────────────────────────┘
```

---

## 📁 Project Structure

```
FullStackChapter3/
│
├── index.html              ← SPA shell (all 3 views in one file)
│
├── css/
│   └── style.css           ← All application styles
│
└── js/
    ├── auth-db.js          ← DB Layer: Users database API
    ├── data-db.js          ← DB Layer: Contacts database API
    ├── auth-server.js      ← Server Layer: Authentication server
    ├── data-server.js      ← Server Layer: Contacts CRUD server
    ├── network.js          ← Network Layer: Latency + packet loss simulation
    ├── fajax.js            ← Communication Layer: FXMLHttpRequest class + fajaxRequest helper
    ├── router.js           ← SPA Router: view switching
    └── app.js              ← Client Layer: All UI logic and async flows
```

---

## 🔑 Core Concepts

### 1. Database Layer (`auth-db.js`, `data-db.js`)
- Stores data in `localStorage` under fixed keys.
- Exposes a clean API (`AuthDB`, `DataDB`) — **servers only** may call these functions.
- Every record gets a unique ID generated from `Date.now()` + random string.

### 2. Server Layer (`auth-server.js`, `data-server.js`)
- Two isolated logical servers, each a JavaScript IIFE module.
- **AuthServer** — login, register, logout, session token management (in-memory).
- **DataServer** — full REST-style CRUD; validates the Bearer token on every request.

### 3. Network Layer (`network.js`)
| Feature | Detail |
|---|---|
| Random latency | 1–3 seconds per packet (both outbound and return) |
| Packet loss | 10%–50% configurable drop rate |
| Drop scope | Drops can happen to the request OR the response independently |
| Monitoring | Live stats panel fixed at the bottom of the screen |

### 4. Communication Layer (`fajax.js`)
- `FXMLHttpRequest` — mimics the real `XMLHttpRequest` API.
- `fajaxRequest(options)` — Promise-based helper with automatic retries on timeout.
- URL format: `"<server-name>:/<path>"` e.g. `"auth-server:/auth/login"`

### 5. Client Layer (`app.js`)
- All server calls go through `fajaxRequest()` — never directly to server or DB modules.
- Buttons are disabled during requests to prevent double-click race conditions.
- Network failures (dropped packets) show user-friendly error messages.
- Debounced live search (400 ms delay) avoids flooding the server.

---

## 🚀 How to Run

Simply open `index.html` in a web browser — no build step or server required.

> **Tip:** Open the browser DevTools console to watch the full request lifecycle logged by each layer.

---

## 🐛 Debugging

| Layer | Console prefix |
|---|---|
| AuthDB | `[AuthDB]` |
| DataDB | `[DataDB]` |
| AuthServer | `[AuthServer]` |
| DataServer | `[DataServer]` |
| Network | `[Network]` |
| FAJAX | `[FAJAX]` |
| Router | `[Router]` |
| App | `[App]` |