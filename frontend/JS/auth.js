/**
 * Auth Class - User Authentication Management
 * 
 * @class Auth
 * @description Handles all authentication operations including login, registration,
 * session verification and logout. Interacts with NextAuth.js backend via fetch API
 * with CORS and cookies support.
 * 
 * @property {Object|null} currentUser - Current authenticated user data
 * @property {string} API_BASE_URL - Backend API base URL
 */
//auth.js
class Auth {

    /**
     * Auth class constructor
     * 
     * @constructor
     * @description Initializes the instance with default values
     */
    //constructor
    constructor() {
        this.currentUser = null;
        // Use global config if available, otherwise default to localhost
        this.API_BASE_URL = (window.CLUTCHPAY_CONFIG && window.CLUTCHPAY_CONFIG.API_BASE_URL) 
            ? window.CLUTCHPAY_CONFIG.API_BASE_URL 
            : 'http://localhost:3000';
    }

    /**
     * Login method - Authenticates user with credentials
     * 
     * @async
     * @param {string} email - User's email address
     * @param {string} password - User's password
     * @returns {Promise<{ok: boolean, error?: string}>} Operation result object
     * 
     * @description
     * 3-step authentication process:
     * 1. Obtains CSRF token from /api/auth/csrf endpoint
     * 2. Sends credentials + CSRF token to /api/auth/callback/credentials
     * 3. Verifies session with checkSession() if login successful
     * 
     * Uses application/x-www-form-urlencoded to avoid CORS preflight requests
     * Includes credentials: 'include' for session cookie handling
     * 
     * @example
     * const auth = new Auth();
     * const result = await auth.login('user@example.com', 'password123');
     * if (result.ok) {
     *     window.location.href = 'main.html';
     * } else {
     *     showErrorMessage(result.error);
     * }
     */
    async login(email, password) {
        
        // Obtain CSRF token first
        const csrfRes = await fetch(`${this.API_BASE_URL}/api/auth/csrf`, {
            credentials: 'include'
        });
        const { csrfToken } = await csrfRes.json();
        
        // Now we do the login with the CSRF token
        const response = await fetch(`${this.API_BASE_URL}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                csrfToken,
                email,
                password,
                callbackUrl: `${this.API_BASE_URL}/api/auth/session`,
                json: 'true'
            }),
            credentials: 'include'
        });

        // Try to parse the response as JSON
        const result = await response.json();

        // If there is an error in the response
        if (result.error) {
            return { ok: false, error: 'Credenciales incorrectas' };
        }

        // If login was successful
        if (result.url || response.ok) {
            // Verify the session to confirm
            await new Promise(resolve => setTimeout(resolve, 100));
            const session = await this.checkSession();
            if (session) {
                return { ok: true };
            } else {
                return { ok: false, error: 'Credenciales incorrectas' };
            }
        }

        // If we reach here, login failed
        return { ok: false, error: 'Credenciales incorrectas' };
    }

    /**
     * Register method - Registers a new user
     * 
     * @async
     * @param {Object} userData - User data to register
     * @param {string} userData.name - Name (required, minimum 3 letters)
     * @param {string} userData.surnames - Surnames (required, minimum 3 letters)
     * @param {string} userData.email - Email (required, valid format)
     * @param {string} userData.password - Password (required, minimum 8 characters)
     * @param {string} [userData.phone] - International phone (optional, format +[code][number])
     * @param {string} [userData.country] - ISO country code (optional, 2 letters)
     * @param {string} [userData.imageUrl] - Profile image URL (optional)
     * @returns {Promise<{ok: boolean, error?: string}>} Operation result
     * 
     * @description
     * Sends POST request to /api/auth/register with user data.
     * Backend validates with Zod and hashes password with bcrypt.
     * If email already exists, returns specific error.
     * 
     * @example
     * const auth = new Auth();
     * const result = await auth.register({
     *     name: 'John',
     *     surnames: 'Doe Smith',
     *     email: 'john@example.com',
     *     password: 'securePass123',
     *     phone: '+34612345678',
     *     country: 'ES'
     * });
     */
    //register method 
    async register(userData) {
        // Call to custom registration endpoint
        const response = await fetch(`${this.API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        const data = await response.json();
        let message = 'Error during registration';

        // Extract error messages
        if (data.errors && Array.isArray(data.errors)) {
            message = data.errors.map(err => err.message).join('\n');
        } else if (data.message) {
            message = data.message;
        }

        // Return based on response status
        if (response.ok) {
            return { ok: true };
        } else {
            return { ok: false, error: message || 'Error during registration' };
        }
    }

    /**
     * CheckSession method - Verifies active session and gets user data
     * 
     * @async
     * @returns {Promise<Object|null>} User data if valid session, null otherwise
     * 
     * @description
     * Makes GET request to /api/auth/session to verify if an active session exists.
     * Includes credentials: 'include' to automatically send session cookies.
     * Updates this.currentUser with received data or sets it to null.
     * 
     * @property {Object} session.user - Authenticated user data
     * @property {string} session.user.id - User unique ID
     * @property {string} session.user.email - User email
     * @property {string} session.user.name - User name
     * @property {string} session.user.surnames - User surnames
     * @property {string|null} session.user.phone - User phone
     * @property {string|null} session.user.country - User country
     * @property {string|null} session.user.imageUrl - Profile image URL
     * 
     * @example
     * const auth = new Auth();
     * const user = await auth.checkSession();
     * if (!user) {
     *     window.location.href = 'login.html';
     * } else {
     *     console.log('Current user:', user);
     * }
     */
    //check session method
    async checkSession() {
        
        // Call to check session endpoint
        const res = await fetch(`${this.API_BASE_URL}/api/auth/session`, {
            method: 'GET',
            //Include cookies in the request
            credentials: 'include',
        });

        // If session is valid, return user data
        if (res.ok) {
            const session = await res.json();
            
            this.currentUser = (session && session.user) ? session.user : null;
            
            return this.currentUser;
        } else {
            // If session is invalid, clear current user
            this.currentUser = null;
            return null;
        }
    }

    /**
     * Logout method - Closes user session
     * 
     * @async
     * @returns {Promise<void>}
     * 
     * @description
     * Logout process:
     * 1. Obtains CSRF token from /api/auth/csrf
     * 2. Sends POST request to /api/auth/signout with CSRF token
     * 3. Clears this.currentUser
     * 4. Redirects to index.html using window.location.replace()
     * 
     * Uses replace() instead of href to prevent user from going back
     * with browser's back button.
     * 
     * If an error occurs, forces redirection anyway for security.
     * 
     * @example
     * const auth = new Auth();
     * document.getElementById('logout-btn').addEventListener('click', async () => {
     *     await auth.logout();
     * });
     */
    //logout method
    async logout() {
        try {
            // Get CSRF token for logout
            const csrfRes = await fetch(`${this.API_BASE_URL}/api/auth/csrf`, {
                credentials: 'include'
            });
            const { csrfToken } = await csrfRes.json();
            
            // Perform logout with CSRF token
            const response = await fetch(`${this.API_BASE_URL}/api/auth/signout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ 
                    csrfToken,
                    callbackUrl: 'http://localhost:80/index.html' 
                }),
                credentials: 'include',
            });
            
            // Clear current user
            this.currentUser = null;
            
            // Force redirect to clear any cached state
            window.location.replace('/index.html');
        } catch (error) {
            console.error('Error during logout:', error);
            // Force redirect anyway
            window.location.replace('/index.html');
        }
    }
}

