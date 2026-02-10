/**
 * ========================================
 * MONGODB CLIENT WRAPPER - ACCESO A BASE DE DATOS
 * ========================================
 * 
 * PROPÓSITO: Cliente centralizado para todas las operaciones en MongoDB
 * Actúa como intermediario entre frontend y backend API
 * 
 * OPERACIONES SOPORTADAS:
 * - CRUD completo de alumnos (create, read, update, delete)
 * - Búsqueda por ID
 * - Validación de suscripción y estado de pago
 * - Cálculo de próxima fecha de vencimiento
 * - Listado filtrado de alumnos
 * 
 * SEGURIDAD:
 * - NUNCA exponer credenciales MongoDB al frontend
 * - SIEMPRE usar backend API como intermediario
 * - Backend valida autenticación y autorización
 * - Frontend solo puede ver datos propios (alumno) o admin panel
 * 
 * CONFIGURACIÓN:
 * - URL del API se obtiene de COHAB_CONFIG.mongodbApiUrl
 * - Fallback a Render.com en producción
 * - Localhost en desarrollo local (http://localhost:3000)
 * 
 * ÚLTIMA ACTUALIZACIÓN: 2026-02-06
 * ========================================
 */

// MongoDB client wrapper for COHAB app
// Requires a backend API endpoint to handle MongoDB operations securely
(function () {
    /**
     * getStored(key)
     * 
     * Lee valor de localStorage de forma segura (sin errores si localStorage no disponible)
     * Usado para guardar configuración temporal
     * 
     * @param {string} key - Clave a leer
     * @returns {string} - Valor guardado o string vacío si no existe
     */
    function getStored(key) {
        try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
    }

    /**
     * setStored(key, val)
     * 
     * Guarda valor en localStorage de forma segura
     * No lanza errores si localStorage no disponible (silenciosamente falla)
     * 
     * @param {string} key - Clave a guardar
     * @param {string} val - Valor a guardar
     */
    function setStored(key, val) {
        try { localStorage.setItem(key, val); } catch (_) {}
    }

    /**
     * isConfigured()
     * 
     * Verifica si el API está correctamente configurado
     * Necesario antes de hacer cualquier llamada a MongoDB
     * 
     * @returns {boolean} - true si API URL es válida
     */
    function isConfigured() {
        const apiUrl = getApiUrl(); // Usa getApiUrl() que incluye el valor por defecto
        return /^https?:\/\//i.test(apiUrl) && apiUrl.length > 10;
    }

    /**
     * getConfiguredFromGlobal()
     * 
     * Lee URL del API desde COHAB_CONFIG (configuración global)
     * Esta es la FUENTE DE VERDAD para la URL del backend
     * Se define en cohab-config.js antes de cargar este script
     * 
     * @returns {string} - URL del API o string vacío si no configurado
     */
    function getConfiguredFromGlobal() {
        try {
            const cfg = window.COHAB_CONFIG;
            const url = cfg && typeof cfg.mongodbApiUrl === 'string' ? cfg.mongodbApiUrl.trim() : '';
            return url || '';
        } catch (_) {
            return '';
        }
    }

    /**
     * getDefaultApiUrlByHost()
     * 
     * Determina URL por defecto basado en el host actual
     * 
     * LÓGICA:
     * - Si está en localhost → http://localhost:3000 (desarrollo)
     * - Si está en producción → https://cohabregistro-firstproyect.onrender.com
     * 
     * @returns {string} - URL del API a usar como default
     */
    function getDefaultApiUrlByHost() {
        // En producción, siempre usar el backend de Render
        const PRODUCTION_API = 'https://cohabregistro-firstproyect.onrender.com';
        
        const host = (window.location && window.location.hostname) ? window.location.hostname : '';
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        
        // Solo usar localhost si realmente estamos en desarrollo local
        if (isLocal) return 'http://localhost:3000';
        
        // En cualquier otro caso, usar producción
        return PRODUCTION_API;
    }

    /**
     * getApiUrl()
     * 
     * Obtiene URL del API con prioridades:
     * 1. COHAB_CONFIG.mongodbApiUrl (configuración global - PRINCIPAL)
     * 2. localStorage.mongodbApiUrl (fallback admin)
     * 3. Default por entorno (localhost o Render)
     * 
     * @returns {string} - URL completa del API "https://api.example.com"
     */
    function getApiUrl() {
        // 1) Configuración global (funciona para TODOS los dispositivos)
        const globalCfg = getConfiguredFromGlobal();
        if (globalCfg) return globalCfg;

        // 2) Fallback por navegador (útil para admin/dev)
        const stored = getStored('mongodbApiUrl');
        if (stored) return stored;

        // 3) Default por entorno
        return getDefaultApiUrlByHost();
    }

    async function apiCall(endpoint, method = 'GET', body = null) {
        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error('MongoDB API URL no configurada');

        const url = `${apiUrl.replace(/\/$/, '')}${endpoint}`;
        if (typeof console !== 'undefined' && console.log) {
            console.log('[MONGO]', method, url.replace(/^(https?:\/\/[^/]+).*/, '$1...'));
        }
        
        // Obtener token de localStorage si existe
        const token = localStorage.getItem('cohabAuthToken');
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        // Agregar Authorization header si hay token
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        // Validar: no guardar respuesta en caché (evita "65 días" viejo en Chrome/Safari)
        if (endpoint.indexOf('/validar') !== -1) {
            options.cache = 'no-store';
            options.headers['Cache-Control'] = 'no-cache';
            options.headers['Pragma'] = 'no-cache';
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const text = await response.text();
            let errMsg = response.statusText;
            try {
                const json = JSON.parse(text);
                errMsg = json.error || json.message || errMsg;
            } catch (_) {}
            if (text && text.length < 200 && !text.startsWith('{')) errMsg = text;
            throw new Error(errMsg + ' (HTTP ' + response.status + ')');
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_) {
            throw new Error('La API no devolvió JSON válido');
        }
    }

    async function listAlumnos() {
        const result = await apiCall('/alumnos?_=' + Date.now(), 'GET');
        const raw = result && (Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []));
        return raw.map(function (r) {
            try {
                return mapFromDb(r);
            } catch (e) {
                console.warn('[MONGO] mapFromDb error:', e);
                return { id: (r && (r.id || r._id)) ? String(r.id || r._id) : '', nombre: (r && r.nombre) ? String(r.nombre) : '', email: '', telefono: '', fechaPago: r && r.fechaPago, diaPago: r && r.diaPago, monto: Number(r && r.monto) || 0 };
            }
        });
    }

    async function upsertAlumno(alumno) {
        const payload = mapToDb(alumno);
        await apiCall('/alumnos', 'PUT', payload);
        return true;
    }

    async function insertAlumnoReturningId(alumnoNoId) {
        const payload = mapToDb(alumnoNoId);
        delete payload.id;
        const result = await apiCall('/alumnos', 'POST', payload);
        return { id: result.id || result.data?.id || payload.id };
    }

    async function deleteAlumno(id) {
        await apiCall(`/alumnos/${id}`, 'DELETE');
        return true;
    }

    async function registrarPago(id, fechaISO) {
        await apiCall(`/alumnos/${id}/pago`, 'PATCH', { fechaPago: fechaISO });
        return true;
    }

    async function enviarQr(id) {
        await apiCall(`/alumnos/${id}/enviar-qr`, 'POST');
        return true;
    }

    // Validar suscripción - ENDPOINT ÚNICO DE VALIDACIÓN (cache-bust para datos siempre sincronizados)
    async function validarSuscripcion(id) {
        return await apiCall(`/alumnos/${id}/validar?_=${Date.now()}`, 'GET');
    }

    function mapToDb(a) {
        return {
            id: a.id,
            nombre: a.nombre,
            email: a.email || null,
            telefono: a.telefono || null,
            fechaPago: a.fechaPago,
            diaPago: a.diaPago,
            monto: parseFloat(a.monto)
        };
    }

    function mapFromDb(r) {
        if (!r || typeof r !== 'object') return { id: '', nombre: '', email: '', telefono: '', fechaPago: null, diaPago: null, monto: 0 };
        var id = r.id != null ? String(r.id) : (r._id != null ? String(r._id) : '');
        var out = {
            id: id,
            nombre: r.nombre != null ? String(r.nombre) : '',
            email: r.email != null ? String(r.email) : '',
            telefono: r.telefono != null ? String(r.telefono) : '',
            fechaPago: r.fechaPago || r.fecha_pago || null,
            diaPago: r.diaPago != null ? r.diaPago : (r.dia_pago != null ? r.dia_pago : null),
            monto: Number(r.monto) || 0
        };
        // Estado calculado por el backend (fuente única de verdad para fechas)
        if (r.estado !== undefined) out.estado = r.estado;
        if (r.acceso !== undefined) out.acceso = r.acceso;
        if (r.diasRestantes !== undefined) out.diasRestantes = r.diasRestantes;
        if (r.proximoPago !== undefined && r.proximoPago !== null) out.proximoPago = r.proximoPago;
        if (r.mensaje !== undefined) out.mensaje = r.mensaje;
        if (r.clase !== undefined) out.clase = r.clase;
        if (r.texto !== undefined) out.texto = r.texto;
        if (r.diasDelMesVencido !== undefined) out.diasDelMesVencido = r.diasDelMesVencido;
        return out;
    }

    function configure(apiUrl) {
        if (apiUrl) setStored('mongodbApiUrl', apiUrl.trim());
    }

    window.MONGO = {
        isConfigured,
        getApiUrl,
        listAlumnos,
        upsertAlumno,
        deleteAlumno,
        registrarPago,
        enviarQr,
        validarSuscripcion,
        insertAlumnoReturningId,
        configure
    };
})();

