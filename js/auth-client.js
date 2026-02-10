/**
 * ========================================
 * COHAB AUTH CLIENT - GESTIÓN DE AUTENTICACIÓN
 * ========================================
 * 
 * PROPÓSITO: Manejo centralizado de autenticación para acceso al admin
 * - Login con email y contraseña
 * - Gestión de tokens JWT
 * - Almacenamiento seguro de credenciales
 * - Integración con MongoDB API backend
 * 
 * SEGURIDAD:
 * - Usa tokens JWT almacenados en localStorage
 * - Envía token en header Authorization: Bearer <token>
 * - Cross-origin compatible (soporta CORS)
 * 
 * TOKENS:
 * - Admin puede iniciar sesión con credenciales
 * - Token se guarda y se usa en todas las llamadas API subsecuentes
 * - Token caduca automáticamente (server-side validation)
 * 
 * ÚLTIMO ACTUALIZADO: 2026-02-06
 * ========================================
 */

const AUTH = {
    /**
     * TOKEN_KEY: Clave para almacenar el JWT en localStorage
     */
    TOKEN_KEY: 'cohabAuthToken',
    
    /**
     * getApiUrl()
     * 
     * Obtiene URL del backend MongoDB API
     * Prioridades:
     * 1. URL configurada en COHAB_CONFIG.mongodbApiUrl
     * 2. URL en localStorage (fallback)
     * 3. URL por defecto en Render.com
     * 
     * @returns {string} - URL base del API "https://api.example.com"
     */
    getApiUrl: function() {
        if (window.COHAB_CONFIG && window.COHAB_CONFIG.mongodbApiUrl) {
            return window.COHAB_CONFIG.mongodbApiUrl;
        }
        return localStorage.getItem('serverBaseUrl') || 'https://cohabregistro-firstproyect.onrender.com';
    },

    /**
     * getToken()
     * 
     * Obtiene el JWT almacenado en localStorage
     * 
     * @returns {string|null} - Token JWT o null si no está logueado
     */
    getToken: function() {
        return localStorage.getItem(this.TOKEN_KEY);
    },

    /**
     * setToken(token)
     * 
     * Guarda el JWT en localStorage para futuras llamadas API
     * 
     * @param {string} token - JWT obtenido del servidor en login
     */
    setToken: function(token) {
        localStorage.setItem(this.TOKEN_KEY, token);
    },

    /**
     * getAuthHeaders()
     * 
     * Prepara headers HTTP con autorización
     * Incluye el token en el header "Authorization: Bearer <token>"
     * Necesario para todas las llamadas API autenticadas
     * 
     * @returns {Object} - Headers con Content-Type y Authorization
     * @example
     * {
     *   'Content-Type': 'application/json',
     *   'Authorization': 'Bearer eyJhbGc...'
     * }
     */
    getAuthHeaders: function() {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    /**
     * login(email, password) — credentials: 'include' para cookies cross-origin
     * Autentica admin contra el backend; guarda token JWT en localStorage.
     */
    login: async function(email, password) {
        let response;
        try {
            response = await fetch(`${this.getApiUrl()}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });
        } catch (err) {
            throw new Error('No se pudo conectar con el servidor. Comprueba la URL del API (cohab-config.js) y que el backend esté en ejecución.');
        }

        let data;
        try {
            data = await response.json();
        } catch (_) {
            throw new Error(response.status === 503 ? 'Base de datos no disponible. Revisa MONGODB_URI en el backend.' : 'Error inesperado del servidor.');
        }

        if (!response.ok) {
            const msg = data.mensaje || data.error || 'Error al iniciar sesión';
            if (response.status === 503) {
                throw new Error('Servidor o base de datos no disponible. Si usas Render, espera ~1 min (cold start) y vuelve a intentar. Revisa MONGODB_URI.');
            }
            throw new Error(msg);
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
                    headers: this.getAuthHeaders(),
                    credentials: 'include'
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
                headers: this.getAuthHeaders(),
                credentials: 'include'
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

    // Proteger página (redirectUrl se construye desde pathname si no se pasa)
    requireAuth: async function(requiredRole = null, redirectUrl) {
        const path = window.location.pathname;
        const base = path.substring(0, path.lastIndexOf('/') + 1);
        const loginUrl = redirectUrl != null ? redirectUrl : (base + 'login.html');

        const user = await this.checkAuth();

        if (!user) {
            window.location.href = loginUrl + (loginUrl.indexOf('?') >= 0 ? '&' : '?') + 'redirect=' + encodeURIComponent(path);
            return false;
        }

        if (requiredRole && user.role !== requiredRole) {
            alert('No tienes permisos para acceder a esta página');
            window.location.href = loginUrl;
            return false;
        }

        return user;
    },

    // Proteger página para admin
    requireAdmin: async function(redirectUrl) {
        const path = window.location.pathname;
        const base = path.substring(0, path.lastIndexOf('/') + 1);
        const defaultLogin = base + 'login.html?role=admin';
        return this.requireAuth('admin', redirectUrl != null ? redirectUrl : defaultLogin);
    }
};

window.AUTH = AUTH;
