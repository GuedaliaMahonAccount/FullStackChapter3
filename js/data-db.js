// data-db.js — manages the contacts collection in localStorage
// Each contact is scoped to a specific user (isolated by userId)
// Only server-layer modules should call this directly

const DataDB = (function () {

    const DB_KEY = "contacthub_contacts_db";

    // Create the database if it doesn't exist yet
    function init() {
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify([]));
            console.log("[DataDB] Contacts database initialized.");
        }
    }

    // Read all contacts from localStorage
    function _readAll() {
        const data = localStorage.getItem(DB_KEY);
        return data ? JSON.parse(data) : [];
    }

    // Write contacts array back to localStorage
    function _writeAll(contacts) {
        localStorage.setItem(DB_KEY, JSON.stringify(contacts));
    }

    // Generate a unique contact ID
    function _generateId() {
        return "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }

    // Return all contacts belonging to a specific user
    function getAllByUser(userId) {
        const contacts = _readAll();
        return contacts.filter(c => c.userId === userId);
    }

    // Return a single contact by ID, scoped to the given user
    function getById(userId, contactId) {
        const contacts = _readAll();
        return contacts.find(c => c.id === contactId && c.userId === userId) || null;
    }

    // Add a new contact for the given user
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

    // Update an existing contact, only changing the provided fields
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

    // Delete a contact by ID, returns true if deleted, false if not found
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

    // Search contacts by name, phone, or email (case-insensitive)
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
