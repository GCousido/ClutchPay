/**
 * Frontend Configuration
 * 
 * Auto-detects the backend URL based on the current page hostname.
 * No manual configuration needed.
 */

// Detect backend URL based on current hostname
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    // Backend runs on port 3000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    return `http://${hostname}:3000`;
}

// Global configuration
window.CLUTCHPAY_CONFIG = {
    API_BASE_URL: getApiBaseUrl(),
    FRONTEND_URL: window.location.origin
};

