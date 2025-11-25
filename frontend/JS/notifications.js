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

// Show success message
window.showSuccessMessage = function(message) {
    window.showFloatingMessage(message, 'success');
};

// Show error message
window.showErrorMessage = function(message) {
    window.showFloatingMessage(message, 'error');
};
