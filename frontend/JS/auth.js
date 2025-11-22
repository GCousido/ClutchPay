//auth.js
class Auth {

    //constructor
    constructor() {
        this.currentUser = null;
        this.API_BASE_URL = 'http://localhost:3000';
    }

    async login(email, password) {
        
        // Llamar al endpoint de NextAuth para credentials
        // Primero obtenemos el CSRF token
        const csrfRes = await fetch(`${this.API_BASE_URL}/api/auth/csrf`, {
            credentials: 'include'
        });
        const { csrfToken } = await csrfRes.json();
        
        // Ahora hacemos el login con el CSRF token
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

        // Intentar parsear la respuesta como JSON
        const result = await response.json();

        // Si hay error en la respuesta
        if (result.error) {
            return { ok: false, error: 'Credenciales incorrectas' };
        }

        // Si la respuesta indica éxito (tiene url de callback)
        if (result.url || response.ok) {
            // Verificar la sesión para confirmar
            await new Promise(resolve => setTimeout(resolve, 100));
            const session = await this.checkSession();
            if (session) {
                return { ok: true };
            } else {
                return { ok: false, error: 'Credenciales incorrectas' };
            }
        }

        // Si llegamos aquí, el login falló
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
        try {
            // Obtener CSRF token para el logout
            const csrfRes = await fetch(`${this.API_BASE_URL}/api/auth/csrf`, {
                credentials: 'include'
            });
            const { csrfToken } = await csrfRes.json();
            
            // Hacer logout con el CSRF token
            const response = await fetch(`${this.API_BASE_URL}/api/auth/signout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ 
                    csrfToken,
                    callbackUrl: 'http://localhost:5050/index.html' 
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











