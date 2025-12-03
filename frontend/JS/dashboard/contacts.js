/**
 * Dashboard Contacts Module
 * 
 * @module dashboard/contacts
 * @description Manages user contacts functionality including
 * add, delete, load, and render contacts.
 * 
 * Exports:
 * - DashboardContacts: Contacts management class
 * 
 * Features:
 * - Load contacts from API
 * - Add contact by email
 * - Delete contact with confirmation
 * - Render contacts in desktop and mobile lists
 * - Search user by email
 * - Modal management
 */

class DashboardContacts {
    /**
     * Creates DashboardContacts instance
     * 
     * @param {DashboardCore} core - Dashboard core instance
     */
    constructor(core) {
        this.core = core;
        this.contactsList = [];
    }

    /**
     * Initializes contacts module
     * 
     * @description
     * Sets up:
     * - Add contact button handlers (desktop + mobile)
     * - Close modal handlers
     * - Add contact form submission
     * - Initial contacts load
     */
    init() {
        this.initAddContactButtons();
        this.initModalHandlers();
        this.initAddContactForm();
        this.loadContacts();
    }

    /**
     * Finds user by email address
     * 
     * @async
     * @param {string} email - Email to search
     * @returns {Promise<Object|null>} User object or null if not found
     * 
     * @description
     * Searches all users in system:
     * 1. Fetches /api/users?limit=1000
     * 2. Finds user with matching email (case-insensitive)
     * 3. Returns user object or null
     */
    async findUserByEmail(email) {
        try {
            const res = await fetch(`${this.core.authInstance.API_BASE_URL}/api/users?limit=1000`, {
                credentials: 'include'
            });

            if (!res.ok) return null;

            const response = await res.json();
            const users = response.data || [];

            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            return user || null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    /**
     * Loads contacts from backend API
     * 
     * @async
     * @description
     * Fetches user's contacts:
     * 1. Shows loading state
     * 2. Fetches /api/users/${userId}/contacts?limit=1000
     * 3. If success: Updates contactsList and renders
     * 4. If error: Shows error message and error state
     */
    async loadContacts() {
        const contactsListContainer = document.getElementById('contacts-list');
        contactsListContainer.innerHTML = '<div class="loading">Loading contacts...</div>';

        try {
            const res = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/users/${this.core.currentUser.id}/contacts?limit=1000`,
                { credentials: 'include' }
            );

            if (res.ok) {
                const response = await res.json();
                this.contactsList = response.data || [];
                this.renderContacts();
            } else {
                this.core.showErrorMessage('Error al cargar contactos');
                contactsListContainer.innerHTML = '<div class="empty-contacts"><p>Error al cargar contactos</p></div>';
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.core.showErrorMessage('Error al cargar contactos');
            contactsListContainer.innerHTML = '<div class="empty-contacts"><p>Error al cargar contactos</p></div>';
        }
    }

    /**
     * Deletes contact from user's contact list
     * 
     * @async
     * @param {number} contactId - ID of contact to delete
     * 
     * @description
     * 1. Sends DELETE to /api/users/${userId}/contacts with contactId
     * 2. If success: Shows success message and reloads contacts
     * 3. If error: Shows backend error message
     */
    async deleteContact(contactId) {
        try {
            const res = await fetch(
                `${this.core.authInstance.API_BASE_URL}/api/users/${this.core.currentUser.id}/contacts`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ contactId })
                }
            );

            if (res.ok) {
                this.core.showSuccessMessage('Contacto eliminado correctamente');
                await this.loadContacts();
            } else {
                const data = await res.json();
                this.core.showErrorMessage(data.message || 'Error al eliminar contacto');
            }
        } catch (error) {
            console.error('Error deleting contact:', error);
            this.core.showErrorMessage('Error al eliminar contacto');
        }
    }

    /**
     * Renders contacts list in both desktop and mobile views
     * 
     * @description
     * Updates contacts UI:
     * - If empty: Shows "no contacts" message
     * - If has contacts: Renders list with avatar, name, email, delete button
     * 
     * Updates both:
     * - #contacts-list (desktop)
     * - #contacts-list-mobile (mobile)
     */
    renderContacts() {
        const desktopList = document.getElementById('contacts-list');
        const mobileList = document.getElementById('contacts-list-mobile');

        const emptyHTML = `
        <div class="empty-contacts">
            <p>📋 ${i18n.t('userDashboard.noContacts')}</p>
            <p style="font-size: 14px;">${i18n.t('userDashboard.clickToAdd')}</p>
        </div>
    `;

        if (this.contactsList.length === 0) {
            desktopList.innerHTML = emptyHTML;
            mobileList.innerHTML = emptyHTML;
            return;
        }

        const contactsHTML = this.contactsList.map(contact => `
        <div class="contact-item" data-contact-id="${contact.id}">
            <div class="contact-info">
                <img src="${contact.imageUrl || '../imagenes/avatar-default.svg'}" 
                     alt="${contact.name}" 
                     class="contact-avatar"
                     onerror="this.src='../imagenes/avatar-default.svg'">
                <div class="contact-details">
                    <h4>${contact.name} ${contact.surnames || ''}</h4>
                    <p>${contact.email}</p>
                </div>
            </div>
            <button class="btn-delete-contact" data-contact-id="${contact.id}" title="Eliminar contacto">
                🗑️
            </button>
        </div>
    `).join('');

        desktopList.innerHTML = contactsHTML;
        mobileList.innerHTML = contactsHTML;

        // Event listeners for delete buttons
        document.querySelectorAll('.btn-delete-contact').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const contactId = parseInt(e.currentTarget.dataset.contactId);
                const contact = this.contactsList.find(c => c.id === contactId);
                const contactName = contact ? `${contact.name} ${contact.surnames || ''}` : 'este contacto';

                const confirmed = await this.core.showConfirmModal(
                    i18n.t('userDashboard.deleteConfirm') || 'Confirm deletion',
                    `Are you sure you want to remove ${contactName} from your contacts?`
                );

                if (confirmed) {
                    await this.deleteContact(contactId);
                }
            });
        });
    }

    /**
     * Initializes add contact button handlers
     * 
     * @description
     * Sets up click handlers for:
     * - #add-contact-btn (desktop)
     * - #add-contact-btn-mobile (mobile)
     */
    initAddContactButtons() {
        const openModal = () => {
            const emailInput = document.getElementById('contact-email');
            const modal = document.getElementById('add-contact-modal');
            if (emailInput) emailInput.value = '';
            if (modal) modal.style.display = 'flex';
        };

        const addContactBtn = document.getElementById('add-contact-btn');
        if (addContactBtn) {
            addContactBtn.addEventListener('click', openModal);
        }

        const addContactBtnMobile = document.getElementById('add-contact-btn-mobile');
        if (addContactBtnMobile) {
            addContactBtnMobile.addEventListener('click', openModal);
        }
    }

    /**
     * Initializes modal close handlers
     * 
     * @description
     * Sets up:
     * - Close button (X)
     * - Click outside modal to close
     */
    initModalHandlers() {
        const closeContactModal = document.getElementById('close-add-contact-modal');
        if (closeContactModal) {
            closeContactModal.onclick = () => {
                const modal = document.getElementById('add-contact-modal');
                if (modal) modal.style.display = 'none';
            };
        }

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('add-contact-modal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    /**
     * Initializes add contact form submission
     * 
     * @description
     * Process to add contact:
     * 1. Validates email not empty
     * 2. Validates not adding self
     * 3. Searches user by email
     * 4. Validates user exists and not already in contacts
     * 5. POST to /api/users/${userId}/contacts
     * 6. If success: Shows message, closes modal, reloads contacts
     */
    initAddContactForm() {
        const form = document.getElementById('add-contact-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('contact-email').value.trim();

                if (!email) {
                    this.core.showErrorMessage('Por favor introduce un email');
                    return;
                }

                if (email.toLowerCase() === this.core.currentUser.email.toLowerCase()) {
                    this.core.showErrorMessage('No puedes añadirte a ti mismo como contacto');
                    return;
                }

                try {
                    const userToAdd = await this.findUserByEmail(email);

                    if (!userToAdd) {
                        this.core.showErrorMessage('No se encontró ningún usuario con ese email');
                        return;
                    }

                    if (this.contactsList.some(c => c.id === userToAdd.id)) {
                        this.core.showErrorMessage('Este usuario ya está en tu lista de contactos');
                        return;
                    }

                    const res = await fetch(
                        `${this.core.authInstance.API_BASE_URL}/api/users/${this.core.currentUser.id}/contacts`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ contactId: userToAdd.id })
                        }
                    );

                    const data = await res.json();

                    if (res.ok) {
                        this.core.showSuccessMessage(`${userToAdd.name} añadido a tus contactos`);
                        document.getElementById('add-contact-modal').style.display = 'none';
                        await this.loadContacts();
                    } else {
                        this.core.showErrorMessage(data.message || 'Error al añadir contacto');
                    }
                } catch (error) {
                    console.error('Error adding contact:', error);
                    this.core.showErrorMessage('Error al añadir contacto');
                }
            });
        }
    }
}
