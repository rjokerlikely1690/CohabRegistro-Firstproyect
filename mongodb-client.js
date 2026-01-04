// MongoDB client wrapper for COHAB app
// Requires a backend API endpoint to handle MongoDB operations securely
(function () {
    function getStored(key) {
        try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
    }

    function setStored(key, val) {
        try { localStorage.setItem(key, val); } catch (_) {}
    }

    function isConfigured() {
        const apiUrl = getApiUrl(); // Usa getApiUrl() que incluye el valor por defecto
        return /^https?:\/\//i.test(apiUrl) && apiUrl.length > 10;
    }

    function getApiUrl() {
        const stored = getStored('mongodbApiUrl');
        if (stored) return stored;
        // URL por defecto de Railway (se puede sobrescribir en admin.html)
        return 'https://cohabregistro-firstproyect-production.up.railway.app';
    }

    async function apiCall(endpoint, method = 'GET', body = null) {
        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error('MongoDB API URL no configurada');

        const url = `${apiUrl.replace(/\/$/, '')}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    }

    async function listAlumnos() {
        const result = await apiCall('/alumnos', 'GET');
        return (result.data || []).map(mapFromDb);
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

    // Validar suscripción - ENDPOINT ÚNICO DE VALIDACIÓN
    // Devuelve: { acceso: boolean, estado: string, diasRestantes: number, ... }
    async function validarSuscripcion(id) {
        return await apiCall(`/alumnos/${id}/validar`, 'GET');
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
        return {
            id: r.id || r._id,
            nombre: r.nombre,
            email: r.email || '',
            telefono: r.telefono || '',
            fechaPago: r.fechaPago || r.fecha_pago,
            diaPago: r.diaPago || r.dia_pago,
            monto: Number(r.monto)
        };
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

