// ============================================================
// DATA-DB.js — Contacts Database (DB Layer)
// ============================================================
// This module manages the Contacts collection stored in localStorage.
// Each contact is scoped to a specific user (isolated by userId).
// IMPORTANT: This module must only be called by server-layer modules.
//            The client layer must NEVER access the database directly.
//
// Public API:
//   DataDB.init()                              → Initialize the database
//   DataDB.getAllByUser(userId)                → Get all contacts for a user
//   DataDB.getById(userId, contactId)         → Get a specific contact
//   DataDB.add(userId, contactData)           → Create a new contact
//   DataDB.update(userId, contactId, data)    → Update an existing contact
//   DataDB.remove(userId, contactId)          → Delete a contact
//   DataDB.search(userId, query)              → Search contacts by text
// ============================================================

const DataDB = (function () {

    // The key used to store the contacts array in localStorage
    const DB_KEY = "contacthub_contacts_db";

    // ----------------------------------------------------------
    // INIT — Create the database if it does not exist yet
    // ----------------------------------------------------------
    function init() {
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify([]));
            console.log("[DataDB] Contacts database initialized.");
        }
    }

    // ----------------------------------------------------------
    // Internal helpers (private)
    // ----------------------------------------------------------

    /** Read and parse the full contacts array from localStorage */
    function _readAll() {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : [];
    }

    /** Serialize and write the contacts array back to localStorage */
    function _writeAll(contacts) {
        localStorage.setItem(DB_KEY, JSON.stringify(contacts));
    }

    /** Generate a unique contact ID (e.g. "c_1700000000000_xy9k1") */
    function _generateId() {
        return "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }

    // ----------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------

    /**
     * Return all contacts belonging to a specific user.
     * @param {string} userId
     * @returns {object[]}
     */
    function getAllByUser(userId) {
        const contacts = _readAll();
        return contacts.filter(c => c.userId === userId);
    }

    /**
     * Return a single contact by its ID, scoped to the given user.
     * @returns {object|null}
     */
    function getById(userId, contactId) {
        const contacts = _readAll();
        return contacts.find(c => c.id === contactId && c.userId === userId) || null;
    }

    /**
     * Add a new contact for the given user.
     * @param {string} userId
     * @param {object} contactData - { firstName, lastName, phone?, email?, notes? }
     * @returns {object} The newly created contact record.
     */
    function add(userId, contactData) {
        const contacts = _readAll();

        const newContact = {
            id: _generateId(),
            userId: userId,
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            phone: contactData.phone || "",
            email: contactData.email || "",
            notes: contactData.notes || "",
            createdAt: new Date().toISOString()
        };

        contacts.push(newContact);
        _writeAll(contacts);
        console.log("[DataDB] Contact added:", newContact.firstName, newContact.lastName);
        return newContact;
    }

    /**
     * Update an existing contact. Only fields provided in contactData are changed.
     * @returns {object|null} The updated contact, or null if not found.
     */
    function update(userId, contactId, contactData) {
        const contacts = _readAll();
        const index = contacts.findIndex(c => c.id === contactId && c.userId === userId);

        if (index === -1) {
            return null;
        }

        // Merge new data into the existing record, preserving id / userId / createdAt
        contacts[index] = {
            ...contacts[index],
            firstName: contactData.firstName ?? contacts[index].firstName,
            lastName: contactData.lastName ?? contacts[index].lastName,
            phone: contactData.phone ?? contacts[index].phone,
            email: contactData.email ?? contacts[index].email,
            notes: contactData.notes ?? contacts[index].notes,
            updatedAt: new Date().toISOString()
        };

        _writeAll(contacts);
        console.log("[DataDB] Contact updated:", contactId);
        return contacts[index];
    }

    /**
     * Delete a contact by ID, scoped to the given user.
     * @returns {boolean} True if deleted, false if not found.
     */
    function remove(userId, contactId) {
        const contacts = _readAll();
        const index = contacts.findIndex(c => c.id === contactId && c.userId === userId);

        if (index === -1) {
            return false;
        }

        contacts.splice(index, 1);
        _writeAll(contacts);
        console.log("[DataDB] Contact deleted:", contactId);
        return true;
    }

    /**
     * Search a user's contacts by a text query (name, phone, or email).
     * @param {string} userId
     * @param {string} query - Case-insensitive search string.
     * @returns {object[]}
     */
    function search(userId, query) {
        const contacts = getAllByUser(userId);
        const q = query.toLowerCase();

        return contacts.filter(c =>
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.email.toLowerCase().includes(q)
        );
    }

    // Expose only the public API
    return {
        init,
        getAllByUser,
        getById,
        add,
        update,
        remove,
        search
    };

})();
