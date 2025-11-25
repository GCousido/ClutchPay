// frontend/JS/dashboard_usuario.js
document.addEventListener('DOMContentLoaded', async () => {
    const authInstance = new Auth();

    let currentUser = null;

    // Verify session
    const response = await fetch(`${authInstance.API_BASE_URL}/api/auth/session`, { credentials: 'include' });
    if (!response.ok) {
        window.location.href = '../login.html';
        return;
    }
    // Load user data
    const session = await response.json();

    if (!session.user) {
        alert('No se pudo cargar el perfil');
        window.location.href = '../login.html';
        return;
    }

    currentUser = session.user;

    // Fill user data in the dashboard
    function updateDashboardUI() {
        if (currentUser.imageUrl != null && currentUser.imageUrl !== '') {
            document.getElementById('profile-pic').src = currentUser.imageUrl;
        } else {
            document.getElementById('profile-pic').src = '../imagenes/avatar-default.svg';
        }
        document.getElementById('user-name').textContent = `${currentUser.name} ${currentUser.surnames}`;
    }

    updateDashboardUI();

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await authInstance.logout();
    });

    // Edit Profile Modal Logic
    document.getElementById('edit-profile-btn').addEventListener('click', async () => {
        // Rellenar con datos actuales en lugar de vaciar los campos
        document.getElementById('name').value = '';
        document.getElementById('surnames').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('country').value = '';
        document.getElementById('imageUrl').value = '';
        document.getElementById('edit-profile-modal').style.display = 'flex';
    });

    // Close the modal (X button)
    document.getElementById('close-modal').onclick = function () {
        document.getElementById('edit-profile-modal').style.display = 'none';
    };

    // Save changes
    document.getElementById('edit-profile-form').onsubmit = async function (e) {
        e.preventDefault();

        // Get current user data
        const userId = currentUser.id;

        // Prepare the object with all fields, using the current value if the input is empty
        const updatedUser = {
            name: document.getElementById('name').value || currentUser.name,
            surnames: document.getElementById('surnames').value || currentUser.surnames,
            phone: document.getElementById('phone').value || currentUser.phone,
            country: document.getElementById('country').value || currentUser.country,
            imageUrl: document.getElementById('imageUrl').value || currentUser.imageUrl
        };

        // Send the updated data to the server
        const res = await fetch(`${authInstance.API_BASE_URL}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updatedUser)
        });

        // Handle response
        if (res.ok) {
            // save data default and update currentUser
            currentUser = {
                ...currentUser,
                ...updatedUser
            };

            updateDashboardUI();

            showSuccessMessage('Perfil actualizado correctamente');
            document.getElementById('edit-profile-modal').style.display = 'none';
        } else {
            showErrorMessage('Error al actualizar el perfil');
        }
    };

    //Show floating success message function
    function showSuccessMessage(message) {
        showFloatingMessage(message, 'success');
    }
    //Show floating error message function
    function showErrorMessage(message) {
        showFloatingMessage(message, 'error');
    }
    //Show floating message function
    function showFloatingMessage(message, type) {
        let msgDiv = document.createElement('div');
        msgDiv.className = `floating-message ${type}`;
        msgDiv.textContent = message;
        document.body.appendChild(msgDiv);
        setTimeout(() => {
            msgDiv.classList.add('visible');
        }, 10);
        setTimeout(() => {
            msgDiv.classList.remove('visible');
            setTimeout(() => document.body.removeChild(msgDiv), 400);
        }, 2200);
    }


    // ========== Section for Contacts ==========

    let contactsList = [];

    // Helper function: find user by email so we can search by it
    async function findUserByEmail(email) {
        try {
            const res = await fetch(`${authInstance.API_BASE_URL}/api/users?limit=1000`, {
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

    // Load contacts from backend
    async function loadContacts() {
        const contactsListContainer = document.getElementById('contacts-list');
        contactsListContainer.innerHTML = '<div class="loading">Cargando contactos...</div>';

        try {
            const res = await fetch(`${authInstance.API_BASE_URL}/api/users/${currentUser.id}/contacts?limit=1000`, {
                credentials: 'include'
            });

            if (res.ok) {
                const response = await res.json();
                contactsList = response.data || [];
                renderContacts();
            } else {
                showErrorMessage('Error al cargar contactos');
                contactsListContainer.innerHTML = '<div class="empty-contacts"><p>Error al cargar contactos</p></div>';
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            showErrorMessage('Error al cargar contactos');
            contactsListContainer.innerHTML = '<div class="empty-contacts"><p>Error al cargar contactos</p></div>';
        }
    }

    // Render contacts list
    function renderContacts() {
        const contactsListContainer = document.getElementById('contacts-list');

        //when no contacts
        if (contactsList.length === 0) {
            contactsListContainer.innerHTML = `
            <div class="empty-contacts">
                <p>📋 No tienes contactos añadidos aún</p>
                <p style="font-size: 14px;">Haz clic en "Añadir Contacto" para empezar</p>
            </div>
        `;
            return;
        }

        //when there are contacts
        contactsListContainer.innerHTML = contactsList.map(contact => `
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

        // Event listeners for delete buttons
        document.querySelectorAll('.btn-delete-contact').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const contactId = parseInt(e.currentTarget.dataset.contactId);
                const contact = contactsList.find(c => c.id === contactId);
                const contactName = contact ? `${contact.name} ${contact.surnames || ''}` : 'este contacto';
                if (confirm(`¿Estás seguro de que deseas eliminar a ${contactName} de tus contactos?`)) {
                    await deleteContact(contactId);
                }
            });
        });
    }

    // Open modal to add contact
    document.getElementById('add-contact-btn').addEventListener('click', () => {
        document.getElementById('contact-email').value = '';
        document.getElementById('add-contact-modal').style.display = 'flex';
    });

    // Close modal
    document.getElementById('close-contact-modal').onclick = function () {
        document.getElementById('add-contact-modal').style.display = 'none';
    };

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('add-contact-modal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Add contact
    document.getElementById('add-contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('contact-email').value.trim();

        if (!email) {
            showErrorMessage('Por favor introduce un email');
            return;
        }

        // Validate that it is not your own email
        if (email.toLowerCase() === currentUser.email.toLowerCase()) {
            showErrorMessage('No puedes añadirte a ti mismo como contacto');
            return;
        }

        try {
            // 1. look for user by email
            const userToAdd = await findUserByEmail(email);

            if (!userToAdd) {
                showErrorMessage('No se encontró ningún usuario con ese email');
                return;
            }

            // 2. Check if already a contact (including those not deleted in session)
            if (contactsList.some(c => c.id === userToAdd.id)) {
                showErrorMessage('Este usuario ya está en tu lista de contactos');
                return;
            }

            // 3. Add the contact
            const res = await fetch(`${authInstance.API_BASE_URL}/api/users/${currentUser.id}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ contactId: userToAdd.id })
            });

            const data = await res.json();

            if (res.ok) {
                showSuccessMessage(`${userToAdd.name} añadido a tus contactos`);
                document.getElementById('add-contact-modal').style.display = 'none';
                //refresh contacts list
                await loadContacts();
            } else {
                showErrorMessage(data.message || 'Error al añadir contacto');
            }
        } catch (error) {
            console.error('Error adding contact:', error);
            showErrorMessage('Error al añadir contacto');
        }
    });

    // Delete contact (calls backend API)
    async function deleteContact(contactId) {
        try {
            const res = await fetch(
                `${authInstance.API_BASE_URL}/api/users/${currentUser.id}/contacts`, 
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ contactId })
                }
            );

            if (res.ok) {
                showSuccessMessage('Contacto eliminado correctamente');
                // Reload contacts to reflect the change
                await loadContacts();
            } else {
                const data = await res.json();
                showErrorMessage(data.message || 'Error al eliminar contacto');
            }
        } catch (error) {
            console.error('Error deleting contact:', error);
            showErrorMessage('Error al eliminar contacto');
        }
    }

    // Load contacts on start
    loadContacts();
});




