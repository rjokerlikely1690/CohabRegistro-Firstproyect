// Supabase lightweight client wrapper for COHAB app
(function () {
    function getStored(key) {
        try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
    }

    function setStored(key, val) {
        try { localStorage.setItem(key, val); } catch (_) {}
    }

    function isConfigured() {
        const url = getStored('supabaseUrl');
        const anon = getStored('supabaseAnon');
        return /^https?:\/\//i.test(url) && anon.length > 10 && typeof window.supabase !== 'undefined';
    }

    let _client = null;
    function client() {
        if (_client) return _client;
        if (!isConfigured()) return null;
        const url = getStored('supabaseUrl');
        const anon = getStored('supabaseAnon');
        const { createClient } = window.supabase;
        _client = createClient(url, anon);
        return _client;
    }

    async function listAlumnos() {
        const c = client();
        if (!c) return null;
        const { data, error } = await c
            .from('alumnos')
            .select('*')
            .order('nombre', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapFromDb);
    }

    async function upsertAlumno(alumno) {
        const c = client();
        if (!c) return null;
        const payload = mapToDb(alumno);
        const { error } = await c.from('alumnos').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return true;
    }

    async function deleteAlumno(id) {
        const c = client();
        if (!c) return null;
        const { error } = await c.from('alumnos').delete().eq('id', id);
        if (error) throw error;
        return true;
    }

    async function registrarPago(id, fechaISO) {
        const c = client();
        if (!c) return null;
        const { error } = await c.from('alumnos').update({ fecha_pago: fechaISO }).eq('id', id);
        if (error) throw error;
        return true;
    }

    function mapToDb(a) {
        return {
            id: a.id,
            nombre: a.nombre,
            email: a.email || null,
            telefono: a.telefono || null,
            fecha_pago: a.fechaPago,
            dia_pago: a.diaPago,
            monto: a.monto
        };
    }

    function mapFromDb(r) {
        return {
            id: r.id,
            nombre: r.nombre,
            email: r.email || '',
            telefono: r.telefono || '',
            fechaPago: r.fecha_pago,
            diaPago: r.dia_pago,
            monto: Number(r.monto)
        };
    }

    function configure(url, anon) {
        if (url) setStored('supabaseUrl', url.trim());
        if (anon) setStored('supabaseAnon', anon.trim());
        _client = null;
    }

    window.SUPA = {
        isConfigured,
        client,
        listAlumnos,
        upsertAlumno,
        deleteAlumno,
        registrarPago,
        configure
    };
})();


