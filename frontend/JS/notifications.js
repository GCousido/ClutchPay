/**
 * Notification System - Toast Messages
 * 
 * @module notifications
 * @description Floating notification system (toast) that displays temporary
 * messages with CSS animations. Functions are exposed globally in window.
 */

/**
 * Displays a floating message with specific style and duration
 * 
 * @function showFloatingMessage
 * @global
 * @param {string} message - Message text to display
 * @param {string} [type='success'] - Message type ('success' | 'error')
 * @returns {void}
 * 
 * @description
 * Creates a div element with fade in/out animation.
 * 
 * Animation flow:
 * 1. Creates div with class 'floating-message {type}'
 * 2. Adds to body with opacity: 0
 * 3. After 10ms: adds 'visible' class (fade in)
 * 4. After 2200ms: removes 'visible' class (fade out)
 * 5. After 400ms more: removes element from DOM
 * 
 * Total visible duration: ~2.6 seconds
 * 
 * Types:
 * - 'success': Green background, for successful operations
 * - 'error': Red background, for errors and validations
 * 
 * @example
 * showFloatingMessage('Profile updated successfully', 'success');
 * showFloatingMessage('Error processing request', 'error');
 */
// notifications.js - Global notification functions

// Show floating message function
window.showFloatingMessage = function(message, type = 'success') {
    let msgDiv = document.createElement('div');
    msgDiv.className = `floating-message ${type}`;
    msgDiv.textContent = message;
    document.body.appendChild(msgDiv);
    setTimeout(() => {
        msgDiv.classList.add('visible');
    }, 10);
    setTimeout(() => {
        msgDiv.classList.remove('visible');
        setTimeout(() => {
            if (msgDiv.parentNode) {
                document.body.removeChild(msgDiv);
            }
        }, 400);
    }, 2200);
};

/**
 * Displays a success message
 * 
 * @function showSuccessMessage
 * @global
 * @param {string} message - Message text
 * @returns {void}
 * 
 * @description
 * Shortcut for showFloatingMessage(message, 'success').
 * Displays a toast with success style (green background).
 * 
 * @example
 * showSuccessMessage('User registered successfully');
 * showSuccessMessage(i18n.t('userDashboard.profileUpdated'));
 */
// Show success message
window.showSuccessMessage = function(message) {
    window.showFloatingMessage(message, 'success');
};

/**
 * Displays an error message
 * 
 * @function showErrorMessage
 * @global
 * @param {string} message - Message text
 * @returns {void}
 * 
 * @description
 * Shortcut for showFloatingMessage(message, 'error').
 * Displays a toast with error style (red background).
 * 
 * @example
 * showErrorMessage('Could not connect to server');
 * showErrorMessage(i18n.t('general.connectionError'));
 */
// Show error message
window.showErrorMessage = function(message) {
    window.showFloatingMessage(message, 'error');
};
