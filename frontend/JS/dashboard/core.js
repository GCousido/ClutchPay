/**
 * Dashboard Core Module
 * 
 * @module dashboard/core
 * @description Shared utilities, API calls, notifications, and state management
 * used by all dashboard modules (profile, contacts, invoices, mobile).
 * 
 * Exports:
 * - DashboardCore: Main class with user state and utilities
 * 
 * Features:
 * - Session verification and user data management
 * - Notification system (success/error/confirm)
 * - User profile updates
 * - localStorage management
 * - API base URL and credentials handling
 */

class DashboardCore {
    /**
     * Creates DashboardCore instance
     * 
     * @param {Auth} authInstance - Auth instance for API calls
     */
    constructor(authInstance) {
        this.authInstance = authInstance;
        this.currentUser = null;
    }

    /**
     * Verifies session and loads user data
     * 
     * @async
     * @returns {Promise<boolean>} true if session valid, false if redirected to login
     * 
     * @description
     * 1. Verifies active session with /api/auth/session
     * 2. If unauthorized, redirects to login.html
     * 3. Loads user data from session response
     * 4. Checks localStorage for updated profile data
     * 5. Merges localStorage data with session data
     */
    async initSession() {
        try {
            const response = await fetch(`${this.authInstance.API_BASE_URL}/api/auth/session`, { 
                credentials: 'include' 
            });
            
            if (!response.ok) {
                window.location.href = '../login.html';
                return false;
            }

            const session = await response.json();

            if (!session.user) {
                this.showErrorMessage('Could not load profile');
                setTimeout(() => {
                    window.location.href = '../login.html';
                }, 2000);
                return false;
            }

            this.currentUser = session.user;

            // Check localStorage for updated profile data
            const localStorageKey = `userProfile_${this.currentUser.id}`;
            const localUserData = localStorage.getItem(localStorageKey);
            if (localUserData) {
                const parsedData = JSON.parse(localUserData);
                this.currentUser = { ...this.currentUser, ...parsedData };
            }

            return true;
        } catch (error) {
            console.error('Error initializing session:', error);
            this.showErrorMessage('Error loading session');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return false;
        }
    }

    /**
     * Updates user profile in backend and localStorage
     * 
     * @async
     * @param {Object} updatedUser - Updated user data
     * @param {string} updatedUser.name - User's first name
     * @param {string} updatedUser.surnames - User's last names
     * @param {string} updatedUser.phone - Phone number
     * @param {string} updatedUser.country - Country code
     * @param {string} updatedUser.imageUrl - Avatar URL
     * @returns {Promise<Object|null>} Updated user object or null if error
     * 
     * @description
     * 1. Sends PUT to /api/users/${userId}
     * 2. If success: Updates currentUser and localStorage
     * 3. Returns updated user object
     * 4. If error: Returns null
     */
    async updateUserProfile(updatedUser) {
        try {
            const res = await fetch(`${this.authInstance.API_BASE_URL}/api/users/${this.currentUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedUser)
            });

            if (res.ok) {
                const responseData = await res.json();
                
                // Update currentUser with response data
                this.currentUser = {
                    ...this.currentUser,
                    ...responseData
                };

                // Save to localStorage with user-specific key
                const localStorageKey = `userProfile_${this.currentUser.id}`;
                const dataToSave = {
                    name: this.currentUser.name,
                    surnames: this.currentUser.surnames,
                    phone: this.currentUser.phone,
                    country: this.currentUser.country,
                    imageUrl: this.currentUser.imageUrl
                };
                localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));

                return this.currentUser;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            return null;
        }
    }

    /**
     * Clears user data from localStorage
     * 
     * @description
     * Removes user-specific and generic localStorage keys
     */
    clearUserData() {
        const localStorageKey = `userProfile_${this.currentUser.id}`;
        localStorage.removeItem(localStorageKey);
        localStorage.removeItem('userProfile'); // Old generic key
    }

    /**
     * Logs out user
     * 
     * @async
     * @description
     * 1. Clears localStorage
     * 2. Calls authInstance.logout()
     */
    async logout() {
        this.clearUserData();
        await this.authInstance.logout();
    }

    /**
     * Shows success notification toast
     * 
     * @param {string} message - Message to display
     */
    showSuccessMessage(message) {
        this.showFloatingMessage(message, 'success');
    }

    /**
     * Shows error notification toast
     * 
     * @param {string} message - Message to display
     */
    showErrorMessage(message) {
        this.showFloatingMessage(message, 'error');
    }

    /**
     * Shows warning notification toast
     * 
     * @param {string} message - Message to display
     */
    showWarningMessage(message) {
        this.showFloatingMessage(message, 'warning');
    }

    /**
     * Shows floating toast notification
     * 
     * @param {string} message - Message to display
     * @param {string} type - 'success' | 'error'
     * 
     * @description
     * Creates temporary toast notification:
     * - Adds .floating-message div to body
     * - Fades in after 10ms (.visible class)
     * - Fades out after 2200ms
     * - Removes from DOM after 2600ms
     */
    showFloatingMessage(message, type) {
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

    /**
     * Shows confirmation modal and waits for user response
     * 
     * @param {string} title - Modal title
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} true if accepted, false if canceled
     * 
     * @description
     * Promise-based confirmation modal:
     * 1. Shows #confirm-modal with title and message
     * 2. Translates cancel/accept buttons via i18n
     * 3. Waits for user click
     * 4. Resolves promise with true (accept) or false (cancel)
     * 5. Cleans up event listeners
     */
    showConfirmModal(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const cancelBtn = document.getElementById('confirm-cancel');
            const acceptBtn = document.getElementById('confirm-accept');

            titleEl.textContent = title;
            messageEl.textContent = message;
            cancelBtn.textContent = i18n.t('userDashboard.cancel') || 'Cancel';
            acceptBtn.textContent = i18n.t('userDashboard.accept') || 'Accept';

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
}
