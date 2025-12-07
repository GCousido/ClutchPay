/**
 * Frontend Configuration
 * 
 * Auto-detects the backend URL based on the current page hostname.
 * No manual configuration needed.
 */

// Backend configuration - Set by installer
const BACKEND_IP = 'localhost';
const BACKEND_PORT = 3000;

// Detect backend URL
function getApiBaseUrl() {
    return `http://${BACKEND_IP}:${BACKEND_PORT}`;
}

// Global configuration
window.CLUTCHPAY_CONFIG = {
    API_BASE_URL: getApiBaseUrl(),
    FRONTEND_URL: window.location.origin
};

