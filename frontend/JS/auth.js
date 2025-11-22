//auth.js
class Auth {

    //constructor
    constructor() {
        this.currentUser = null;
        this.API_BASE_URL = 'http://localhost:3000';
    }

    async login(email, password) {
        const response = await fetch(`${this.API_BASE_URL}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email, password }),
            credentials: 'include',
            redirect: 'manual' // Don't follow redirects automatically
        });

        // NextAuth returns 302 redirect on success, 401 on failure
        if (response.status === 0 || response.type === 'opaqueredirect') {
            // Redirect means success (302)
            return { ok: true };
        }

        // Check if we got a JSON error response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return { ok: false, error: data.error || 'Credenciales incorrectas' };
        }

        // If not redirect and not JSON, it's an error
        return { ok: false, error: 'Credenciales incorrectas' };
    }

    //register method 
    async register(userData) {
        // Call to custom registration endpoint
        const response = await fetch(`${this.API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        let message = 'Error al registrar';

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
            return { ok: false, error: message || 'Error al registrar' };
        }
    }

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

    //logout method
    async logout() {
        // Call to signout endpoint
        await fetch(`${this.API_BASE_URL}/api/auth/signout`, {
            method: 'POST',
            //Include cookies in the request
            credentials: 'include',
        });
        // Clear current user and redirect to homepage
        this.currentUser = null;
        window.location.href = '/index.html';
    }
}