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
        showErrorMessage('No se pudo cargar el perfil');
        setTimeout(() => {
            window.location.href = '../login.html';
        }, 2000);
        return;
    }

    currentUser = session.user;

    // Check if there are updated values in localStorage for THIS specific user
    const localStorageKey = `userProfile_${currentUser.id}`;
    const localUserData = localStorage.getItem(localStorageKey);
    if (localUserData) {
        const parsedData = JSON.parse(localUserData);
        currentUser = { ...currentUser, ...parsedData };
    }

    // Fill user data in the dashboard
    function updateDashboardUI() {
        const profilePic = document.getElementById('profile-pic');
        
        // Set image with fallback
        if (currentUser.imageUrl && currentUser.imageUrl.trim() !== '') {
            profilePic.src = currentUser.imageUrl;
            // Fallback to default if image fails to load
            profilePic.onerror = function() {
                this.onerror = null; // Prevent infinite loop
                this.src = '../imagenes/avatar-default.svg';
            };
        } else {
            profilePic.src = '../imagenes/avatar-default.svg';
        }
        
        document.getElementById('user-name').textContent = `${currentUser.name} ${currentUser.surnames}`;
        
        // Update email if exists
        const emailElement = document.getElementById('user-email');
        if (emailElement) {
            emailElement.textContent = currentUser.email;
        }
    }

    updateDashboardUI();

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        // Clean up localStorage for this user before logout
        const localStorageKey = `userProfile_${currentUser.id}`;
        localStorage.removeItem(localStorageKey);
        
        // Also clean up old generic key if it exists
        localStorage.removeItem('userProfile');
        
        await authInstance.logout();
    });

    // Edit Profile Modal Logic
    document.getElementById('edit-profile-btn').addEventListener('click', async () => {
        // Fill form with current user data
        document.getElementById('name').value = currentUser.name || '';
        document.getElementById('surnames').value = currentUser.surnames || '';
        document.getElementById('phone').value = currentUser.phone || '';
        document.getElementById('country').value = currentUser.country || '';
        document.getElementById('imageUrl').value = currentUser.imageUrl || '';
        
        // Update preview image
        const previewImg = document.getElementById('image-preview');
        if (currentUser.imageUrl && currentUser.imageUrl.trim() !== '') {
            previewImg.src = currentUser.imageUrl;
            previewImg.onerror = function() {
                this.onerror = null;
                this.src = '../imagenes/avatar-default.svg';
            };
        } else {
            previewImg.src = '../imagenes/avatar-default.svg';
        }
        
        document.getElementById('edit-profile-modal').style.display = 'flex';
    });

    // Image URL input listener for live preview
    const imageUrlInput = document.getElementById('imageUrl');
    const previewImg = document.getElementById('image-preview');
    
    imageUrlInput.addEventListener('input', function() {
        const url = this.value.trim();
        if (url !== '') {
            previewImg.src = url;
            previewImg.onerror = function() {
                this.onerror = null;
                this.src = '../imagenes/avatar-default.svg';
            };
        } else {
            previewImg.src = '../imagenes/avatar-default.svg';
        }
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
            // Get the updated data from the response
            const responseData = await res.json();
            
            // Update currentUser with response data (backend returns the full updated user)
            currentUser = {
                ...currentUser,
                ...responseData
            };

            // Save updated user to localStorage with user-specific key
            const localStorageKey = `userProfile_${currentUser.id}`;
            const dataToSave = {
                name: currentUser.name,
                surnames: currentUser.surnames,
                phone: currentUser.phone,
                country: currentUser.country,
                imageUrl: currentUser.imageUrl
            };
            localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));

            updateDashboardUI();

            showSuccessMessage(i18n.t('userDashboard.profileUpdated'));
            document.getElementById('edit-profile-modal').style.display = 'none';
        } else {
            showErrorMessage(i18n.t('userDashboard.profileError'));
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

    // Show confirmation modal
    function showConfirmModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const cancelBtn = document.getElementById('confirm-cancel');
            const acceptBtn = document.getElementById('confirm-accept');

            titleEl.textContent = title;
            messageEl.textContent = message;
            cancelBtn.textContent = i18n.t('userDashboard.cancel') || 'Cancelar';
            acceptBtn.textContent = i18n.t('userDashboard.accept') || 'Aceptar';

            modal.style.display = 'flex';

            const handleCancel = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(false);
            };

            const handleAccept = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(true);
            };

            const cleanup = () => {
                cancelBtn.removeEventListener('click', handleCancel);
                acceptBtn.removeEventListener('click', handleAccept);
            };

            cancelBtn.addEventListener('click', handleCancel);
            acceptBtn.addEventListener('click', handleAccept);
        });
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

    // Open modal to add contact
    const addContactBtn = document.getElementById('add-contact-btn');
    if (addContactBtn) {
        addContactBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('contact-email');
            const modal = document.getElementById('add-contact-modal');
            if (emailInput) emailInput.value = '';
            if (modal) modal.style.display = 'flex';
        });
    }

    // Close modal
    const closeContactModal = document.getElementById('close-add-contact-modal');
    if (closeContactModal) {
        closeContactModal.onclick = function () {
            const modal = document.getElementById('add-contact-modal');
            if (modal) modal.style.display = 'none';
        };
    }

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



    // ===== TOGGLE MENÚ MÓVIL =====
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            console.log('Menu toggled:', mobileMenu.classList.contains('active'));
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar && !sidebar.contains(e.target) && !mobileMenu.contains(e.target)) {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
            }
        });

        mobileMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn') || e.target.closest('.btn')) {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
            }
        });
    }

    // ===== Buttons on mobile =====
    // Edit profile mobile
    const editProfileBtnMobile = document.getElementById('edit-profile-btn-mobile');
    if (editProfileBtnMobile) {
        editProfileBtnMobile.addEventListener('click', () => {
            // Fill form with current user data
            document.getElementById('name').value = currentUser.name || '';
            document.getElementById('surnames').value = currentUser.surnames || '';
            document.getElementById('phone').value = currentUser.phone || '';
            document.getElementById('country').value = currentUser.country || '';
            document.getElementById('imageUrl').value = currentUser.imageUrl || '';
            
            // Update preview image
            const previewImg = document.getElementById('image-preview');
            if (currentUser.imageUrl && currentUser.imageUrl.trim() !== '') {
                previewImg.src = currentUser.imageUrl;
                previewImg.onerror = function() {
                    this.onerror = null;
                    this.src = '../imagenes/avatar-default.svg';
                };
            } else {
                previewImg.src = '../imagenes/avatar-default.svg';
            }
            
            document.getElementById('edit-profile-modal').style.display = 'flex';
        });
    }

    // Logout móvil
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', async () => {
            await authInstance.logout();
            window.location.href = '../login.html';
        });
    }

    // Añadir contacto móvil
    const addContactBtnMobile = document.getElementById('add-contact-btn-mobile');
    if (addContactBtnMobile) {
        addContactBtnMobile.addEventListener('click', () => {
            document.getElementById('add-contact-modal').style.display = 'flex';
        });
    }

    // ===== Synchronize contact list =====
    // When you load contacts, update both lists:
    function renderContacts() {
        const desktopList = document.getElementById('contacts-list');
        const mobileList = document.getElementById('contacts-list-mobile');

        // HTML cuando no hay contactos
        const emptyHTML = `
        <div class="empty-contacts">
            <p>📋 ${i18n.t('userDashboard.noContacts')}</p>
            <p style="font-size: 14px;">${i18n.t('userDashboard.clickToAdd')}</p>
        </div>
    `;

        // Si no hay contactos, mostrar mensaje en ambas listas
        if (contactsList.length === 0) {
            desktopList.innerHTML = emptyHTML;
            mobileList.innerHTML = emptyHTML;
            return;
        }

        // HTML de los contactos
        const contactsHTML = contactsList.map(contact => `
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

        // Actualizar ambas listas (desktop y móvil)
        desktopList.innerHTML = contactsHTML;
        mobileList.innerHTML = contactsHTML;

        // Event listeners para botones de eliminar en AMBAS listas
        document.querySelectorAll('.btn-delete-contact').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const contactId = parseInt(e.currentTarget.dataset.contactId);
                const contact = contactsList.find(c => c.id === contactId);
                const contactName = contact ? `${contact.name} ${contact.surnames || ''}` : 'este contacto';

                const confirmed = await showConfirmModal(
                    i18n.t('userDashboard.deleteConfirm') || 'Confirmar eliminación',
                    `¿Estás seguro de que deseas eliminar a ${contactName} de tus contactos?`
                );

                if (confirmed) {
                    await deleteContact(contactId);
                }
            });
        });
    }

    // ===== INVOICES FUNCTIONALITY =====
    let allInvoices = [];
    let currentFilter = 'all';

    // Load invoices
    async function loadInvoices() {
        try {
            const response = await fetch(`${authInstance.API_BASE_URL}/api/invoices?userId=${currentUser.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Error loading invoices');
            }

            allInvoices = await response.json();
            renderInvoices(currentFilter);
        } catch (error) {
            console.error('Error loading invoices:', error);
            showErrorMessage(i18n.t('invoices.errorLoading'));
            document.querySelector('.loading-spinner').style.display = 'none';
            document.getElementById('empty-invoices').style.display = 'flex';
        }
    }

    // Render invoices based on filter
    function renderInvoices(filter) {
        const grid = document.getElementById('invoices-grid');
        const emptyState = document.getElementById('empty-invoices');
        
        let filteredInvoices = allInvoices;
        
        if (filter === 'pending') {
            filteredInvoices = allInvoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');
        } else if (filter === 'paid') {
            filteredInvoices = allInvoices.filter(inv => inv.status === 'PAID');
        }

        if (filteredInvoices.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        
        const invoicesHTML = filteredInvoices.map(invoice => {
            const isIssued = invoice.issuerUserId === currentUser.id;
            const statusClass = invoice.status.toLowerCase();
            const statusLabel = i18n.t(`invoices.status${invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}`);
            const typeLabel = isIssued ? i18n.t('invoices.issued') : i18n.t('invoices.received');
            
            const issueDate = new Date(invoice.issueDate).toLocaleDateString();
            const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-';
            
            return `
                <div class="invoice-card status-${statusClass}" data-invoice-id="${invoice.id}">
                    <div class="invoice-header">
                        <span class="invoice-number">#${invoice.invoiceNumber}</span>
                        <span class="invoice-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    
                    <div class="invoice-type-badge">
                        ${isIssued ? '📤' : '📥'} ${typeLabel}
                    </div>
                    
                    <h3 class="invoice-subject">${invoice.subject}</h3>
                    <p class="invoice-description">${invoice.description}</p>
                    
                    <div class="invoice-amount">€${parseFloat(invoice.amount).toFixed(2)}</div>
                    
                    <div class="invoice-details">
                        <div class="invoice-detail-row">
                            <span class="invoice-detail-label">${i18n.t('invoices.issueDate')}:</span>
                            <span class="invoice-detail-value">${issueDate}</span>
                        </div>
                        ${invoice.dueDate ? `
                        <div class="invoice-detail-row">
                            <span class="invoice-detail-label">${i18n.t('invoices.dueDate')}:</span>
                            <span class="invoice-detail-value">${dueDate}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        grid.innerHTML = invoicesHTML;
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderInvoices(currentFilter);
        });
    });

    // Load invoices on page load
    loadInvoices();

});








