// ============================================================
// COHAB Auth Client - Manejo de autenticación en frontend
// Usa token en localStorage + Authorization header (cross-origin compatible)
// ============================================================

const AUTH = {
    TOKEN_KEY: 'cohabAuthToken',
    
    // Obtener base URL del API (usa COHAB_CONFIG como fuente de verdad)
    getApiUrl: function() {
        if (window.COHAB_CONFIG && window.COHAB_CONFIG.mongodbApiUrl) {
            return window.COHAB_CONFIG.mongodbApiUrl;
        }
        return localStorage.getItem('serverBaseUrl') || 'https://cohabregistro-firstproyect.onrender.com';
    },

    // Obtener token guardado
    getToken: function() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    // Guardar token
    setToken: function(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    },

    // Headers con Authorization
    getAuthHeaders: function() {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    // Iniciar sesión
    login: async function(email, password) {
        const response = await fetch(`${this.getApiUrl()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || data.error || 'Error al iniciar sesión');
        }

        // Guardar token y datos del usuario
        if (data.token) {
            this.setToken(data.token);
        }
        if (data.user) {
            localStorage.setItem('cohabUser', JSON.stringify(data.user));
            localStorage.setItem('cohabUserRole', data.user.role);
        }

        return data;
    },

    // Cerrar sesión
    logout: async function() {
        try {
            const token = this.getToken();
            if (token) {
                await fetch(`${this.getApiUrl()}/auth/logout`, {
                    method: 'POST',
                    headers: this.getAuthHeaders()
                });
            }
        } catch (e) {
            console.warn('Error al cerrar sesión en servidor:', e);
        }

        // Limpiar todo
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem('cohabUser');
        localStorage.removeItem('cohabUserRole');
        localStorage.removeItem('userRole');
        localStorage.removeItem('lastAccess');
    },

    // Verificar si hay sesión activa
    checkAuth: async function() {
        const token = this.getToken();
        if (!token) {
            return null;
        }

        try {
            const response = await fetch(`${this.getApiUrl()}/auth/me`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearLocalAuth();
                }
                return null;
            }

            const data = await response.json();

            if (data.authenticated && data.user) {
                localStorage.setItem('cohabUser', JSON.stringify(data.user));
                localStorage.setItem('cohabUserRole', data.user.role);
                return data.user;
            }

            return null;

        } catch (e) {
            console.warn('Error verificando autenticación:', e);
            // Si hay error de red, confiar en localStorage
            return this.getCurrentUser();
        }
    },

    // Obtener usuario actual desde localStorage
    getCurrentUser: function() {
        try {
            const stored = localStorage.getItem('cohabUser');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    },

    // Verificar si el usuario tiene un rol específico
    hasRole: function(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },

    // Verificar si es admin
    isAdmin: function() {
        return this.hasRole('admin');
    },

    // Limpiar auth local
    clearLocalAuth: function() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem('cohabUser');
        localStorage.removeItem('cohabUserRole');
    },

    // Proteger página
    requireAuth: async function(requiredRole = null, redirectUrl = '/login.html') {
        const user = await this.checkAuth();

        if (!user) {
            window.location.href = redirectUrl + '?redirect=' + encodeURIComponent(window.location.pathname);
            return false;
        }

        if (requiredRole && user.role !== requiredRole) {
            alert('No tienes permisos para acceder a esta página');
            window.location.href = redirectUrl;
            return false;
        }

        return user;
    },

    // Proteger página para admin
    requireAdmin: async function(redirectUrl = '/login.html?role=admin') {
        return this.requireAuth('admin', redirectUrl);
    }
};

window.AUTH = AUTH;
