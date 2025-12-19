/**
 * Internal Notifications System
 * 
 * @module internal-notifications
 * @description Manages in-app notifications system, including fetching,
 * displaying, marking as read, and deleting notifications.
 */

class InternalNotifications {
    /**
     * Creates an instance of InternalNotifications
     * @param {Auth} authInstance - Auth instance for API communication
     */
    constructor(authInstance) {
        this.API_BASE_URL = authInstance.API_BASE_URL;
        this.authInstance = authInstance;
        this.notifications = [];
        this.unreadCount = 0;
        this.isModalOpen = false;
        this.pollingInterval = null;
        this.POLL_INTERVAL = 30000; // 30 seconds
    }

    /**
     * Initialize the notifications system
     * @returns {Promise<void>}
     */
    async init() {
        this.setupEventListeners();
        await this.fetchNotifications();
        this.startPolling();
    }

    /**
     * Setup event listeners for notification UI
     */
    setupEventListeners() {
        // Desktop notification button
        const notifBtn = document.getElementById('notifications-btn');
        if (notifBtn) {
            notifBtn.addEventListener('click', () => this.openModal());
        }

        // Mobile notification button
        const notifBtnMobile = document.getElementById('notifications-btn-mobile');
        if (notifBtnMobile) {
            notifBtnMobile.addEventListener('click', () => this.openModal());
        }

        // Close modal button
        const closeBtn = document.getElementById('notifications-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close modal on overlay click
        const modal = document.getElementById('notifications-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Mark all as read button
        const markAllBtn = document.getElementById('notifications-mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }

        // Delete all read button
        const deleteAllBtn = document.getElementById('notifications-delete-all');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => this.deleteAllRead());
        }
    }

    /**
     * Fetch notifications from the API
     * @param {Object} options - Fetch options
     * @param {number} options.page - Page number
     * @param {number} options.limit - Items per page
     * @returns {Promise<void>}
     */
    async fetchNotifications({ page = 1, limit = 50 } = {}) {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/api/notifications?page=${page}&limit=${limit}&sortBy=createdAt&sortOrder=desc`,
                {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const data = await response.json();
            this.notifications = data.notifications || [];
            this.unreadCount = data.unreadCount || 0;
            
            this.updateUI();
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    /**
     * Update the UI with current notification data
     */
    updateUI() {
        // Update badge indicators
        this.updateBadge();
        
        // Update notification list if modal is open
        if (this.isModalOpen) {
            this.renderNotificationList();
        }
    }

    /**
     * Update the notification badge indicator
     */
    updateBadge() {
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            if (this.unreadCount > 0) {
                badge.style.display = 'block';
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            } else {
                badge.style.display = 'none';
            }
        });
    }

    /**
     * Open the notifications modal
     */
    openModal() {
        const modal = document.getElementById('notifications-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.isModalOpen = true;
            this.renderNotificationList();
        }
    }

    /**
     * Close the notifications modal
     */
    closeModal() {
        const modal = document.getElementById('notifications-modal');
        if (modal) {
            modal.style.display = 'none';
            this.isModalOpen = false;
        }
    }

    /**
     * Render the notification list in the modal
     */
    renderNotificationList() {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="notifications-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <p data-i18n="notifications.noNotifications">No tienes notificaciones</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notifications.map(notification => {
            const isUnread = !notification.read;
            const date = new Date(notification.createdAt);
            const formattedDate = this.formatDate(date);

            return `
                <div class="notification-item ${isUnread ? 'unread' : 'read'}" data-id="${notification.id}">
                    <div class="notification-content" data-notification-id="${notification.id}">
                        ${isUnread ? '<span class="notification-unread-dot"></span>' : ''}
                        <div class="notification-header">
                            <span class="notification-type">${this.getNotificationTypeLabel(notification.type)}</span>
                            <span class="notification-date">${formattedDate}</span>
                        </div>
                        <div class="notification-message">${notification.message}</div>
                    </div>
                    <button class="notification-delete-btn" data-delete-notification-id="${notification.id}" aria-label="Delete notification">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Add event listeners using event delegation
        container.querySelectorAll('.notification-content').forEach(element => {
            element.addEventListener('click', (e) => {
                const notificationId = e.currentTarget.dataset.notificationId;
                if (notificationId) {
                    this.openNotification(notificationId);
                }
            });
        });

        container.querySelectorAll('.notification-delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering notification open
                const notificationId = e.currentTarget.dataset.deleteNotificationId;
                if (notificationId) {
                    this.deleteNotification(notificationId);
                }
            });
        });
    }

    /**
     * Get notification type label
     * @param {string} type - Notification type
     * @returns {string} Localized type label
     */
    getNotificationTypeLabel(type) {
        const typeLabels = {
            PAYMENT_DUE: window.i18n ? i18n.t('notifications.types.paymentDue') : 'Pago próximo',
            PAYMENT_OVERDUE: window.i18n ? i18n.t('notifications.types.paymentOverdue') : 'Pago vencido',
            PAYMENT_RECEIVED: window.i18n ? i18n.t('notifications.types.paymentReceived') : 'Pago recibido',
            INVOICE_CREATED: window.i18n ? i18n.t('notifications.types.invoiceCreated') : 'Factura creada',
        };
        return typeLabels[type] || type;
    }

    /**
     * Format date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return window.i18n ? i18n.t('notifications.justNow') : 'Ahora mismo';
        } else if (diffMins < 60) {
            return window.i18n ? i18n.t('notifications.minutesAgo', { count: diffMins }) : `Hace ${diffMins} min`;
        } else if (diffHours < 24) {
            return window.i18n ? i18n.t('notifications.hoursAgo', { count: diffHours }) : `Hace ${diffHours}h`;
        } else if (diffDays < 7) {
            return window.i18n ? i18n.t('notifications.daysAgo', { count: diffDays }) : `Hace ${diffDays}d`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Open a notification (mark as read and show details)
     * @param {string} notificationId - ID of the notification to open
     */
    async openNotification(notificationId) {
        try {
            console.log('Opening notification:', notificationId, 'type:', typeof notificationId);
            console.log('Available notifications:', this.notifications.map(n => ({ id: n.id, type: typeof n.id })));
            
            // Try both string and number comparison
            const notification = this.notifications.find(n => n.id == notificationId);
            if (!notification) {
                console.log('Notification not found');
                return;
            }

            console.log('Notification found:', notification);
            console.log('Is unread?', !notification.read);

            // Mark as read if unread
            if (!notification.read) {
                console.log('Marking as read...');
                await this.markAsRead([notification.id]); // Use the actual ID from the object
            }

            // Show notification details
            this.showNotificationDetails(notification);
        } catch (error) {
            console.error('Error opening notification:', error);
        }
    }

    /**
     * Show notification details in a modal or expanded view
     * @param {Object} notification - Notification object
     */
    showNotificationDetails(notification) {
        const detailsModal = document.createElement('div');
        detailsModal.className = 'notification-details-modal';
        detailsModal.innerHTML = `
            <div class="notification-details-content">
                <div class="notification-details-header">
                    <h3>${this.getNotificationTypeLabel(notification.type)}</h3>
                    <button class="notification-details-close" onclick="this.closest('.notification-details-modal').remove()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="notification-details-body">
                    <p class="notification-details-message">${notification.message}</p>
                    <p class="notification-details-date">${new Date(notification.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `;

        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                detailsModal.remove();
            }
        });

        document.body.appendChild(detailsModal);
    }

    /**
     * Mark notifications as read
     * @param {string[]} notificationIds - Array of notification IDs to mark as read
     * @returns {Promise<void>}
     */
    async markAsRead(notificationIds) {
        try {
            console.log('Calling API to mark as read:', notificationIds);
            const response = await fetch(
                `${this.API_BASE_URL}/api/notifications`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ notificationIds }),
                }
            );

            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error('Failed to mark notifications as read');
            }

            const data = await response.json();
            console.log('API response:', data);

            // Update local state
            this.notifications = this.notifications.map(n => 
                notificationIds.includes(n.id) ? { ...n, read: true } : n
            );
            this.unreadCount = Math.max(0, this.unreadCount - notificationIds.length);
            
            console.log('Updated notifications:', this.notifications);
            console.log('New unread count:', this.unreadCount);
            
            this.updateUI();
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            if (window.showErrorMessage) {
                showErrorMessage(window.i18n ? i18n.t('notifications.errorMarkingRead') : 'Error al marcar como leída');
            }
        }
    }

    /**
     * Mark all notifications as read
     * @returns {Promise<void>}
     */
    async markAllAsRead() {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/api/notifications`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ markAllAsRead: true }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to mark all notifications as read');
            }

            // Update local state
            this.notifications = this.notifications.map(n => ({ ...n, read: true }));
            this.unreadCount = 0;
            
            this.updateUI();

            if (window.showSuccessMessage) {
                showSuccessMessage(window.i18n ? i18n.t('notifications.allMarkedRead') : 'Todas las notificaciones marcadas como leídas');
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            if (window.showErrorMessage) {
                showErrorMessage(window.i18n ? i18n.t('notifications.errorMarkingAllRead') : 'Error al marcar todas como leídas');
            }
        }
    }

    /**
     * Delete a notification
     * @param {string} notificationId - ID of the notification to delete
     * @returns {Promise<void>}
     */
    async deleteNotification(notificationId) {
        try {
            console.log('Deleting notification:', notificationId, 'type:', typeof notificationId);
            
            // Find the actual notification to get its real ID
            const notification = this.notifications.find(n => n.id == notificationId);
            if (!notification) {
                console.error('Notification not found for deletion');
                return;
            }
            
            const actualId = notification.id;
            console.log('Using actual ID:', actualId, 'type:', typeof actualId);
            
            const response = await fetch(
                `${this.API_BASE_URL}/api/notifications`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ notificationIds: [actualId] }),
                }
            );

            console.log('Delete response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Delete error response:', errorText);
                throw new Error('Failed to delete notification');
            }

            // Update local state
            if (!notification.read) {
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
            this.notifications = this.notifications.filter(n => n.id != actualId);
            
            console.log('Notification deleted successfully');
            this.updateUI();

            if (window.showSuccessMessage) {
                showSuccessMessage(window.i18n ? i18n.t('notifications.deleted') : 'Notificación eliminada');
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
            if (window.showErrorMessage) {
                showErrorMessage(window.i18n ? i18n.t('notifications.errorDeleting') : 'Error al eliminar notificación');
            }
        }
    }

    /**
     * Delete all read notifications
     * @returns {Promise<void>}
     */
    async deleteAllRead() {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/api/notifications`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ deleteAllRead: true }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete all read notifications');
            }

            const data = await response.json();

            // Update local state
            this.notifications = this.notifications.filter(n => !n.read);
            
            this.updateUI();

            if (window.showSuccessMessage) {
                showSuccessMessage(window.i18n ? i18n.t('notifications.allReadDeleted', { count: data.deletedCount }) : `${data.deletedCount} notificaciones eliminadas`);
            }
        } catch (error) {
            console.error('Error deleting all read notifications:', error);
            if (window.showErrorMessage) {
                showErrorMessage(window.i18n ? i18n.t('notifications.errorDeletingAll') : 'Error al eliminar notificaciones');
            }
        }
    }

    /**
     * Start polling for new notifications
     */
    startPolling() {
        // Clear existing interval if any
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        // Poll every 30 seconds
        this.pollingInterval = setInterval(() => {
            this.fetchNotifications();
        }, this.POLL_INTERVAL);
    }

    /**
     * Stop polling for notifications
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Cleanup - stop polling and remove event listeners
     */
    destroy() {
        this.stopPolling();
    }
}

// Make it globally accessible
window.InternalNotifications = InternalNotifications;
