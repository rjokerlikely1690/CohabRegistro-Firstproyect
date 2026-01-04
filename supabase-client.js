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

    // Insert and return generated id (if DB assigns it)
    async function insertAlumnoReturningId(alumnoNoId) {
        const c = client();
        if (!c) return null;
        const payload = mapToDb(alumnoNoId);
        delete payload.id;
        const { data, error } = await c
            .from('alumnos')
            .insert(payload)
            .select('id')
            .single();
        if (error) throw error;
        return data;
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
        const { error} = await c.from('alumnos').update({ fecha_pago: fechaISO }).eq('id', id);
        if (error) throw error;
        return true;
    }
    
    // Función para validar suscripción (equivalente a MongoDB)
    async function validarSuscripcion(id) {
        const c = client();
        if (!c) throw new Error('Supabase no está configurado');
        
        const { data, error } = await c
            .from('alumnos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Alumno no encontrado');
            }
            throw error;
        }
        
        if (!data) {
            throw new Error('Alumno no encontrado');
        }
        
        // Calcular estado (similar a MongoDB)
        const alumno = mapFromDb(data);
        const estado = calcularEstadoSuscripcion(alumno);
        
        return {
            acceso: estado.acceso,
            estado: estado.estado,
            diasRestantes: estado.diasRestantes,
            proximoPago: estado.proximoPago,
            mensaje: estado.mensaje,
            alumno: {
                id: alumno.id,
                nombre: alumno.nombre,
                email: alumno.email || null,
                telefono: alumno.telefono || null,
                monto: alumno.monto || null
            }
        };
    }
    
    // Calcular estado de suscripción (lógica centralizada)
    function calcularEstadoSuscripcion(alumno) {
        if (!alumno || !alumno.fechaPago || !alumno.diaPago) {
            return {
                acceso: false,
                estado: 'VENCIDA',
                diasRestantes: -999,
                proximoPago: '---',
                mensaje: 'Datos incompletos'
            };
        }
        
        const hoy = new Date();
        const fechaPago = new Date(alumno.fechaPago);
        const diaPago = parseInt(alumno.diaPago) || 30;
        
        // Calcular próximo vencimiento
        let proximoVencimiento = new Date(fechaPago);
        proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
        proximoVencimiento.setDate(Math.min(diaPago, new Date(proximoVencimiento.getFullYear(), proximoVencimiento.getMonth() + 1, 0).getDate()));
        
        const diffTime = proximoVencimiento - hoy;
        const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Regla de negocio: diasRestantes >= 0 → ACTIVA
        const acceso = diasRestantes >= 0;
        const estado = acceso ? 'ACTIVA' : 'VENCIDA';
        
        let mensaje;
        if (diasRestantes < 0) {
            mensaje = `❌ Suscripción vencida. ${Math.abs(diasRestantes)} días de atraso.`;
        } else if (diasRestantes === 0) {
            mensaje = `⚠️ Último día de suscripción. Vence hoy.`;
        } else if (diasRestantes <= 7) {
            mensaje = `⚠️ Suscripción próxima a vencer. ${diasRestantes} días restantes.`;
        } else {
            mensaje = `✅ Suscripción activa. ${diasRestantes} días restantes.`;
        }
        
        return {
            acceso,
            estado,
            diasRestantes,
            proximoPago: proximoVencimiento.toISOString().split('T')[0],
            mensaje
        };
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
        insertAlumnoReturningId,
        validarSuscripcion,
        configure
    };
})();


