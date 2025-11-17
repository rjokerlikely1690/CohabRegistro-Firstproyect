// Sistema COHAB - Academia de BJJ
// Versión limpia sin funciones problemáticas
// VERSIÓN: 17 - Fechas normalizadas usando UTC para evitar desfases
console.log('✅ App.js cargado - Versión 17 - Fechas normalizadas con UTC');

let alumnos = JSON.parse(localStorage.getItem('alumnos')) || [];
let editingAlumno = null;
let diaPagoGlobal = parseInt(localStorage.getItem('diaPagoGlobal')) || 30;

function parseFechaLocal(valor) {
    if (!valor) {
        return null;
    }

    if (valor instanceof Date) {
        return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    }

    if (typeof valor === 'string') {
        const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            return new Date(year, month, day);
        }
        if (valor.includes('T')) {
            const parsedIso = new Date(valor);
            if (!isNaN(parsedIso.getTime())) {
                return new Date(parsedIso.getUTCFullYear(), parsedIso.getUTCMonth(), parsedIso.getUTCDate());
            }
        }
        const parsed = new Date(valor);
        if (!isNaN(parsed.getTime())) {
            return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
        return null;
    }

    const parsed = new Date(valor);
    if (!isNaN(parsed.getTime())) {
        return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    }

    return null;
}

function formatFechaLocal(fecha) {
    if (!(fecha instanceof Date) || isNaN(fecha.getTime())) {
        return '---';
    }
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

// Obtener URL base del servidor para generar enlaces que funcionen en móviles
function getServerBaseUrl() {
    // Prioridad 1: URL configurada manualmente
    let configured = localStorage.getItem('serverBaseUrl');
    if (configured && /^https?:\/\//i.test(configured)) {
        const base = configured.replace(/\/$/, '');
        return base + '/';
    }
    
    // Prioridad 2: Detectar Cloudflare Pages automáticamente
    const hostname = window.location.hostname;
    if (hostname.includes('.pages.dev')) {
        const cloudflareUrl = `https://${hostname}`;
        try {
            localStorage.setItem('serverBaseUrl', cloudflareUrl);
        } catch (_) {}
        return cloudflareUrl + '/';
    }
    
    // Prioridad 3: Detectar Netlify automáticamente
    if (hostname.includes('.netlify.app')) {
        const netlifyUrl = `https://${hostname}`;
        try {
            localStorage.setItem('serverBaseUrl', netlifyUrl);
        } catch (_) {}
        return netlifyUrl + '/';
    }
    
    // Prioridad 4: Si no es localhost, usar la URL actual
    const isLoopback = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/i.test(hostname);
    if (!isLoopback) {
        const currentUrl = window.location.origin;
        try {
            localStorage.setItem('serverBaseUrl', currentUrl);
        } catch (_) {}
        return currentUrl + '/';
    }
    
    // Prioridad 5: Localhost - usar URL configurada o pedir al usuario
    // Si estamos en localhost, intentar usar la URL configurada si existe
    if (configured && configured.includes('pages.dev')) {
        return configured.replace(/\/$/, '') + '/';
    }
    
    // Fallback: URL local (solo para desarrollo)
    const base = window.location.origin + window.location.pathname.replace(/[^/]*\.html$/, '').replace(/[^/]*$/, '');
    return base.replace(/\/$/, '') + '/';
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadAlumnos();
    updateDiaPagoButtons();
    
    // Actualizar automáticamente los estados cada minuto
    setInterval(function() {
        loadAlumnos(); // Recargar alumnos recalcula todos los estados
    }, 60000); // Cada 60 segundos (1 minuto)
    
    // Actualizar cuando la ventana recupera el foco (cuando vuelves a la pestaña)
    window.addEventListener('focus', function() {
        loadAlumnos();
    });
    
    // Actualizar cuando la página se vuelve visible (cambio de pestaña)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            loadAlumnos();
        }
    });
    
});

// Establecer fecha de hoy
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fechaPago');
    if (fechaInput) {
        fechaInput.value = today;
    }
}

// Establecer día de pago global
function setDiaPago(dia) {
    diaPagoGlobal = dia;
    localStorage.setItem('diaPagoGlobal', dia.toString());
    updateDiaPagoButtons();
}

// Actualizar botones de día de pago
function updateDiaPagoButtons() {
    const btn30 = document.getElementById('btnDia30');
    const btn31 = document.getElementById('btnDia31');
    
    if (btn30 && btn31) {
        btn30.className = diaPagoGlobal === 30 ? 'btn btn-primary' : 'btn btn-secondary';
        btn31.className = diaPagoGlobal === 31 ? 'btn btn-primary' : 'btn btn-secondary';
    }
}

// Generar ID único (UUID si está disponible)
function generateId() {
    try {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (_) {}
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calcular estado de pago
// LÓGICA CORREGIDA: Los pagos hechos antes del día de vencimiento cuentan para el mes anterior
// Ejemplo: Si vence el 30/31 y pagas el 2 de noviembre, ese pago corresponde a OCTUBRE
function calcularEstado(alumno) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    // Obtener la fecha de último pago del alumno (la que el usuario ingresó)
    // Asegurar que la fecha esté en formato correcto (YYYY-MM-DD o Date)
    let fechaPago = parseFechaLocal(alumno.fechaPago);
    if (!fechaPago) {
        console.warn('⚠️ Fecha de pago inválida para', alumno.nombre, 'valor recibido:', alumno.fechaPago);
        fechaPago = new Date();
    }
    fechaPago.setHours(0, 0, 0, 0);
    
    // Usar el día de pago del alumno (30 o 31)
    const diaPagoAlumno = parseInt(alumno.diaPago) || diaPagoGlobal;
    
    // PASO 1: Determinar a qué mes corresponde realmente el último pago
    let vencimientoMesActual = new Date(fechaPago.getFullYear(), fechaPago.getMonth(), diaPagoAlumno);
    if (vencimientoMesActual.getDate() !== diaPagoAlumno) {
        // Si el día no existe (ej: 31 en febrero) ajustar al último día del mes
        vencimientoMesActual = new Date(fechaPago.getFullYear(), fechaPago.getMonth() + 1, 0);
    }

    let mesVencimientoPago;
    if (fechaPago < vencimientoMesActual) {
        // Pago realizado antes del día de vencimiento → corresponde al mes anterior
        mesVencimientoPago = new Date(fechaPago.getFullYear(), fechaPago.getMonth() - 1, diaPagoAlumno);
        if (mesVencimientoPago.getDate() !== diaPagoAlumno) {
            mesVencimientoPago = new Date(fechaPago.getFullYear(), fechaPago.getMonth(), 0);
        }
    } else {
        // Pago realizado el mismo día o después del vencimiento → corresponde al mes actual
        mesVencimientoPago = new Date(vencimientoMesActual);
    }

    // PASO 2: Calcular el próximo vencimiento (mes siguiente al mes efectivo del pago)
    let proximoPago = new Date(mesVencimientoPago.getFullYear(), mesVencimientoPago.getMonth() + 1, diaPagoAlumno);
    if (proximoPago.getDate() !== diaPagoAlumno) {
        proximoPago = new Date(mesVencimientoPago.getFullYear(), mesVencimientoPago.getMonth() + 2, 0);
    }

    // PASO 3: Si el próximo vencimiento ya pasó, seguir avanzando
    while (proximoPago < hoy) {
        proximoPago = new Date(proximoPago.getFullYear(), proximoPago.getMonth() + 1, diaPagoAlumno);
        if (proximoPago.getDate() !== diaPagoAlumno) {
            proximoPago = new Date(proximoPago.getFullYear(), proximoPago.getMonth() + 1, 0);
        }
    }

    proximoPago.setHours(0, 0, 0, 0);

    // Calcular días restantes
    const diasRestantes = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));

    // Debug detallado
    console.log(`📅 CALCULANDO ESTADO - ${alumno.nombre || 'Alumno'}:`);
    console.log(`   - Fecha pago ingresada: ${alumno.fechaPago}`);
    console.log(`   - Fecha pago normalizada: ${formatFechaLocal(fechaPago)}`);
    console.log(`   - Día de pago: ${diaPagoAlumno}`);
    console.log(`   - Vencimiento mes actual: ${vencimientoMesActual.toLocaleDateString('es-ES')}`);
    console.log(`   - Mes efectivo del pago: ${mesVencimientoPago.toLocaleDateString('es-ES')}`);
    console.log(`   - Próximo vencimiento calculado: ${proximoPago.toLocaleDateString('es-ES')}`);
    console.log(`   - Días restantes: ${diasRestantes}`);
    
    if (diasRestantes < 0) {
        return {
            clase: 'atrasado',
            texto: `${Math.abs(diasRestantes)}d atrasado`,
            proximo: proximoPago.toLocaleDateString('es-ES')
        };
    } else if (diasRestantes <= 5) {
        return {
            clase: 'proximo',
            texto: `${diasRestantes}d restantes`,
            proximo: proximoPago.toLocaleDateString('es-ES')
        };
    } else {
        return {
            clase: 'al-dia',
            texto: `${diasRestantes}d restantes`,
            proximo: proximoPago.toLocaleDateString('es-ES')
        };
    }
}

// Cargar alumnos - VERSIÓN LIMPIA CON ACTUALIZACIÓN AUTOMÁTICA
async function loadAlumnos() {
    const grid = document.getElementById('alumnosGrid');
    if (!grid) {
        return;
    }
    
    grid.innerHTML = '';
    
    // Si hay MongoDB configurado, priorizar MongoDB
    try {
        if (window.MONGO && MONGO.isConfigured()) {
            const nube = await MONGO.listAlumnos();
            if (Array.isArray(nube)) {
                alumnos = nube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
            }
        }
    } catch (e) {}
    
    // Si hay Supabase configurado (fallback o alternativo)
    try {
        if (alumnos.length === 0 && window.SUPA && SUPA.isConfigured()) {
            const nube = await SUPA.listAlumnos();
            if (Array.isArray(nube)) {
                alumnos = nube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
            }
        }
    } catch (e) {}
    
    if (alumnos.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">📚</div>
                <h3>No hay alumnos registrados</h3>
                <p>Haz clic en "Agregar Alumno" para comenzar</p>
            </div>
        `;
        return;
    }
    
    alumnos.forEach(alumno => {
        // El estado se calcula automáticamente cada vez que se carga
        // Esto asegura que siempre esté actualizado con la fecha actual
        const estado = calcularEstado(alumno);

        let ultimoPagoTexto = '---';
        const fechaUltimoPago = parseFechaLocal(alumno.fechaPago);
        if (fechaUltimoPago) {
            ultimoPagoTexto = formatFechaLocal(fechaUltimoPago);
        }
        const card = document.createElement('div');
        card.className = `alumno-card estado-${estado.clase}`;
        
        // Icono según estado
        let estadoIcon = '';
        let estadoColor = '';
        if (estado.clase === 'atrasado') {
            estadoIcon = '🔴';
            estadoColor = '#ef4444';
        } else if (estado.clase === 'proximo') {
            estadoIcon = '🟠';
            estadoColor = '#f59e0b';
        } else {
            estadoIcon = '🟢';
            estadoColor = '#10b981';
        }
        
        card.innerHTML = `
            <div class="card-header-new">
                <div class="card-status-badge status-${estado.clase}">
                    <span class="status-icon">${estadoIcon}</span>
                    <span class="status-text">${estado.texto}</span>
                </div>
                <h3 class="card-name">${alumno.nombre}</h3>
            </div>
            <div class="card-body-new">
                <div class="card-info-compact">
                    <div class="info-item-compact">
                        <span class="info-icon">💰</span>
                        <span class="info-text">$${parseFloat(alumno.monto).toFixed(2)}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon">🧾</span>
                        <span class="info-text">Último: ${ultimoPagoTexto}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon">📅</span>
                        <span class="info-text">${estado.proximo}</span>
                    </div>
                    ${alumno.email ? `
                    <div class="info-item-compact">
                        <span class="info-icon">📧</span>
                        <span class="info-text">${alumno.email}</span>
                    </div>
                    ` : ''}
                    ${alumno.telefono ? `
                    <div class="info-item-compact">
                        <span class="info-icon">📱</span>
                        <span class="info-text">${alumno.telefono}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions-new">
                <button class="action-btn-new btn-primary-action" onclick="showQR('${alumno.id}')" title="Ver QR">
                    <span class="btn-icon">🔲</span>
                    <span class="btn-text">QR</span>
                </button>
                <button class="action-btn-new btn-secondary-action" onclick="editAlumno('${alumno.id}')" title="Editar">
                    <span class="btn-icon">✏️</span>
                    <span class="btn-text">Editar</span>
                </button>
                <button class="action-btn-new btn-danger-action" onclick="deleteAlumno('${alumno.id}')" title="Eliminar">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Eliminar</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Abrir modal para agregar alumno
function openModal() {
    console.log('🔓 Abriendo modal para agregar alumno...');
    editingAlumno = null;

    const modal = document.getElementById('alumnoModal');
    const form = document.getElementById('alumnoForm');
    const title = document.getElementById('modalTitle');

    if (!modal) {
        console.error('❌ No se encontró el elemento #alumnoModal');
        alert('Error: No se encontró el formulario. Verifica que la página esté cargada correctamente.');
        return;
    }
    
    if (!form) {
        console.error('❌ No se encontró el elemento #alumnoForm');
        alert('Error: No se encontró el formulario. Verifica que la página esté cargada correctamente.');
        return;
    }
    
    if (!title) {
        console.error('❌ No se encontró el elemento #modalTitle');
        alert('Error: No se encontró el título del modal. Verifica que la página esté cargada correctamente.');
        return;
    }

    console.log('✅ Elementos del modal encontrados correctamente');

    // Limpiar formulario
    form.reset();
    const alumnoIdInput = document.getElementById('alumnoId');
    if (alumnoIdInput) {
        alumnoIdInput.value = '';
    }
    title.textContent = 'Agregar Nuevo Alumno';

    // Establecer valores iniciales
    try {
        setTodayDate();
        updateDiaPagoButtons();
        console.log('✅ Valores iniciales establecidos');
    } catch (e) {
        console.error('⚠️ Error al establecer valores iniciales:', e);
    }

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    console.log('✅ Modal mostrado');

    // Enfocar primer campo
    setTimeout(() => {
        const firstInput = document.getElementById('nombre');
        if (firstInput) {
            firstInput.focus();
            console.log('✅ Campo nombre enfocado');
        } else {
            console.warn('⚠️ No se encontró el campo nombre');
        }
    }, 50);
}

// Cerrar modal - VERSIÓN SIMPLE
function closeModal() {
    const modal = document.getElementById('alumnoModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    editingAlumno = null;
}

// Guardar alumno - VERSIÓN LIMPIA CON PREVENCIÓN DE DUPLICADOS
async function saveAlumno(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevenir múltiples envíos
    
    const isEditing = Boolean(editingAlumno);
    
    // Prevenir múltiples envíos simultáneos
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton && submitButton.disabled) {
        return;
    }
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';
    }

    try {
        // Obtener la fecha directamente del input (el usuario puede cambiarla libremente)
        const fechaPagoInput = document.getElementById('fechaPago');
        const fechaPagoValue = fechaPagoInput ? fechaPagoInput.value.trim() : '';
        
        // Validar que la fecha sea válida
        if (!fechaPagoValue) {
            alert('La fecha de pago es obligatoria');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        // Validar formato de fecha (YYYY-MM-DD)
        const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!fechaRegex.test(fechaPagoValue)) {
            alert('El formato de fecha no es válido. Use YYYY-MM-DD');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        // Validar que la fecha sea una fecha válida
        const fechaTest = new Date(fechaPagoValue);
        if (isNaN(fechaTest.getTime())) {
            alert('La fecha ingresada no es válida');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        const formData = {
            id: editingAlumno || null,
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            fechaPago: fechaPagoValue, // Guardar exactamente la fecha que el usuario ingresó (YYYY-MM-DD)
            diaPago: diaPagoGlobal, // Usar el día de pago actual (puede ser del alumno si está editando)
            monto: parseFloat(document.getElementById('monto').value)
        };
        
        console.log('💾 Guardando alumno - Fecha ingresada:', fechaPagoValue, 'Día de pago:', diaPagoGlobal);
        console.log('💾 Modo:', isEditing ? 'EDITANDO' : 'AGREGANDO', 'ID:', editingAlumno);
        
        // Validaciones
        if (!formData.nombre) {
            alert('El nombre es obligatorio');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        if (formData.monto <= 0 || isNaN(formData.monto)) {
            alert('El monto debe ser mayor a 0');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        // Verificar duplicados solo si no está editando
        if (!isEditing) {
            const existeDuplicado = alumnos.some(a => 
                a.nombre.toLowerCase() === formData.nombre.toLowerCase() &&
                a.email === formData.email &&
                a.email !== '' // Solo verificar si tiene email
            );
            if (existeDuplicado) {
                alert('⚠️ Ya existe un alumno con el mismo nombre y email. Por favor verifica.');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Guardar';
                }
                return;
            }
        }
        
        if (editingAlumno) {
            // Editar alumno existente
            const index = alumnos.findIndex(a => a.id === editingAlumno);
            if (index !== -1) {
                const fechaAnterior = alumnos[index].fechaPago;
                console.log('🔄 ACTUALIZANDO ALUMNO:');
                console.log('   - ID:', editingAlumno);
                console.log('   - Nombre:', formData.nombre);
                console.log('   - Fecha ANTERIOR:', fechaAnterior);
                console.log('   - Fecha NUEVA:', formData.fechaPago);
                
                formData.id = editingAlumno; // Mantener el ID original
                alumnos[index] = { ...formData }; // Crear copia
                
                // Guardar en MongoDB/Supabase
                try {
                    if (window.MONGO && MONGO.isConfigured()) {
                        console.log('💾 Guardando en MongoDB...');
                        await MONGO.upsertAlumno(formData);
                        console.log('✅ Guardado exitoso en MongoDB');
                    } else if (window.SUPA && SUPA.isConfigured()) {
                        console.log('💾 Guardando en Supabase...');
                        await SUPA.upsertAlumno(formData);
                        console.log('✅ Guardado exitoso en Supabase');
                    }
                } catch (e) {
                    console.error('❌ ERROR al guardar:', e);
                }
            } else {
                console.error('❌ No se encontró el alumno con ID:', editingAlumno);
            }
        } else {
            // Agregar nuevo alumno - solo una vez
            console.log('➕ AGREGANDO NUEVO ALUMNO...');
            let nuevoId = null;
            
            try {
                if (window.MONGO && MONGO.isConfigured()) {
                    console.log('💾 Intentando guardar en MongoDB...');
                    // Priorizar MongoDB - solo insert, no upsert después
                    const payload = { ...formData };
                    delete payload.id;
                    console.log('📦 Payload a enviar:', payload);
                    const inserted = await MONGO.insertAlumnoReturningId(payload);
                    console.log('📥 Respuesta de MongoDB:', inserted);
                    if (inserted && inserted.id) {
                        nuevoId = inserted.id;
                        console.log('✅ ID obtenido de MongoDB:', nuevoId);
                    } else {
                        console.warn('⚠️ MongoDB no devolvió ID, generando uno local');
                    }
                } else if (window.SUPA && SUPA.isConfigured()) {
                    console.log('💾 Intentando guardar en Supabase...');
                    // Fallback a Supabase
                    const payload = { ...formData };
                    delete payload.id;
                    console.log('📦 Payload a enviar:', payload);
                    const inserted = await SUPA.insertAlumnoReturningId(payload);
                    console.log('📥 Respuesta de Supabase:', inserted);
                    if (inserted && inserted.id) {
                        nuevoId = inserted.id;
                        console.log('✅ ID obtenido de Supabase:', nuevoId);
                    } else {
                        console.warn('⚠️ Supabase no devolvió ID, generando uno local');
                    }
                } else {
                    console.log('ℹ️ MongoDB/Supabase no configurado, usando almacenamiento local');
                }
            } catch (e) {
                console.error('❌ Error al guardar en la nube:', e);
                console.log('⚠️ Continuando con almacenamiento local...');
            }
            
            // Si no se obtuvo ID de la nube, generar uno local
            if (!nuevoId) {
                nuevoId = generateId();
                console.log('🆔 ID generado localmente:', nuevoId);
            }
            
            formData.id = nuevoId;
            
            // Verificar que no se haya duplicado antes de agregar
            const yaExiste = alumnos.some(a => a.id === nuevoId);
            if (yaExiste) {
                console.warn('⚠️ El ID ya existe, saltando duplicado');
            } else {
                alumnos.push(formData);
                console.log('✅ Alumno agregado a la lista local. Total:', alumnos.length);
            }
        }
        
        // Guardar en localStorage
        localStorage.setItem('alumnos', JSON.stringify(alumnos));
        
        // Forzar actualización: recargar alumnos desde MongoDB si está configurado
        // Esto asegura que los datos estén sincronizados
        try {
            if (window.MONGO && MONGO.isConfigured()) {
                const alumnosActualizados = await MONGO.listAlumnos();
                if (Array.isArray(alumnosActualizados) && alumnosActualizados.length > 0) {
                    alumnos = alumnosActualizados;
                    localStorage.setItem('alumnos', JSON.stringify(alumnos));
                    console.log('✅ Sincronizado desde MongoDB - Total alumnos:', alumnos.length);
                    // Verificar que la fecha se guardó correctamente
                    const alumnoGuardado = alumnos.find(a => a.id === formData.id || a.nombre === formData.nombre);
                    if (alumnoGuardado) {
                        console.log('✅ Alumno guardado encontrado:', alumnoGuardado.nombre, 'Fecha:', alumnoGuardado.fechaPago);
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error al sincronizar:', e);
        }
        
        // Recargar vista con los datos actualizados
        console.log('🔄 Recargando vista de alumnos...');
        await loadAlumnos();

        if (formData.email) {
            try {
                if (window.MONGO && MONGO.isConfigured()) {
                    await MONGO.enviarQr(formData.id);
                    console.log(`📧 Email con QR enviado a ${formData.email}`);
                }
            } catch (e) {
                console.warn('⚠️ No se pudo enviar el email con el QR:', e);
            }
        }

        closeModal();

        // Mostrar mensaje de éxito
        const message = isEditing ? 'Alumno actualizado correctamente' : 'Alumno agregado correctamente';
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        } else {
            alert(message);
        }

    } catch (error) {
        console.error('❌ ERROR completo al guardar alumno:', error);
        console.error('❌ Stack trace:', error.stack);
        
        let errorMessage = 'Error al guardar el alumno: ' + error.message;
        
        // Mensajes más específicos según el tipo de error
        if (error.message.includes('fetch')) {
            errorMessage = '❌ Error de conexión. Verifica que MongoDB/Supabase esté configurado correctamente.';
        } else if (error.message.includes('network')) {
            errorMessage = '❌ Error de red. Verifica tu conexión a internet.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = '❌ Error de autenticación. Verifica las credenciales de MongoDB/Supabase.';
        } else if (error.message.includes('500')) {
            errorMessage = '❌ Error del servidor. Verifica que el backend esté funcionando.';
        }
        
        alert(errorMessage + '\n\nRevisa la consola del navegador (F12) para más detalles.');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Guardar';
        }
    }
}

// Editar alumno
function editAlumno(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    editingAlumno = id;
    
    console.log('✏️ Editando alumno:', alumno.nombre, 'Fecha actual:', alumno.fechaPago);
    
    document.getElementById('modalTitle').textContent = 'Editar Alumno';
    document.getElementById('alumnoId').value = alumno.id;
    document.getElementById('nombre').value = alumno.nombre;
    document.getElementById('email').value = alumno.email || '';
    document.getElementById('telefono').value = alumno.telefono || '';
    
    // Asegurar que la fecha esté en formato YYYY-MM-DD para el input type="date"
    let fechaParaInput = alumno.fechaPago;
    if (fechaParaInput) {
        // Si es un string en formato ISO o similar, usarlo directamente
        if (typeof fechaParaInput === 'string') {
            // Si ya está en formato YYYY-MM-DD, usarlo
            if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaParaInput)) {
                // Si no está en formato YYYY-MM-DD, convertir
                const fechaObj = new Date(fechaParaInput);
                if (!isNaN(fechaObj.getTime())) {
                    fechaParaInput = fechaObj.toISOString().split('T')[0];
                }
            }
        } else if (fechaParaInput instanceof Date) {
            fechaParaInput = fechaParaInput.toISOString().split('T')[0];
        }
    }
    
    console.log('📅 Fecha para input:', fechaParaInput);
    document.getElementById('fechaPago').value = fechaParaInput || '';
    document.getElementById('monto').value = alumno.monto;

    // Establecer el día de pago del alumno para edición
    const diaPagoAlumno = parseInt(alumno.diaPago) || diaPagoGlobal;
    diaPagoGlobal = diaPagoAlumno;
    localStorage.setItem('diaPagoGlobal', diaPagoAlumno.toString());
    updateDiaPagoButtons();

    const modal = document.getElementById('alumnoModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }
}

// Eliminar alumno
async function deleteAlumno(id) {
    if (confirm('¿Estás seguro de eliminar este alumno?')) {
        const alumnoEliminado = alumnos.find(a => a.id === id);
        alumnos = alumnos.filter(a => a.id !== id);
        localStorage.setItem('alumnos', JSON.stringify(alumnos));
        try {
            if (window.MONGO && MONGO.isConfigured()) {
                await MONGO.deleteAlumno(id);
            } else if (window.SUPA && SUPA.isConfigured()) {
                await SUPA.deleteAlumno(id);
            }
        } catch (e) {}
        await loadAlumnos();
        alert(`Alumno ${alumnoEliminado ? alumnoEliminado.nombre : ''} eliminado correctamente`);
    }
}

// Mostrar QR
function showQR(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    const estado = calcularEstado(alumno);
    const fechaUltimoPago = parseFechaLocal(alumno.fechaPago);
    const ultimoPagoTexto = formatFechaLocal(fechaUltimoPago);
    const montoTexto = alumno.monto ? `$${parseFloat(alumno.monto).toFixed(2)}` : '---';
    const proximoTexto = estado?.proximo || '---';
    const diasTexto = typeof estado?.texto === 'string' ? estado.texto : '';
    
    document.getElementById('qrNombre').textContent = `QR - ${alumno.nombre}`;
    
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    // Crear URL directa para el alumno usando base configurada
    // Prioridad: URL configurada > Cloudflare Pages por defecto
    let baseUrl = localStorage.getItem('serverBaseUrl');
    
    // Si no hay URL configurada o no es Cloudflare Pages, usar la por defecto
    if (!baseUrl || !baseUrl.includes('pages.dev')) {
        baseUrl = 'https://cohabregistro-firstproyect.pages.dev';
    }
    
    // Limpiar la URL: remover cualquier ruta adicional y trailing slash
    baseUrl = baseUrl.replace(/\/verificar\/.*$/, ''); // Remover /verificar/ si existe
    baseUrl = baseUrl.replace(/\/[^\/]+\.html.*$/, ''); // Remover cualquier .html
    baseUrl = baseUrl.replace(/\/$/, ''); // Remover trailing slash
    
    // Asegurar que termine sin slash para construir la URL correctamente
    const studentUrl = `${baseUrl}/usuario.html?id=${encodeURIComponent(alumno.id)}`;
    
    console.log('🔗 URL base limpia:', baseUrl);
    console.log('🔗 URL del alumno generada:', studentUrl);
    
    // Generar QR
    new QRCode(qrContainer, {
        text: studentUrl,
        width: 250,
        height: 250,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        margin: 2
    });
    
    // Agregar información y botones de acción
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        margin-top: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        text-align: center;
    `;
    
    // Preparar mensaje para WhatsApp
    const whatsappMessage = encodeURIComponent(`🔲 Código QR - ${alumno.nombre}\n\nID: ${alumno.id}\nURL: ${studentUrl}`);
    const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
    
    // Preparar mensaje para Gmail
    const gmailSubject = encodeURIComponent(`Código QR - ${alumno.nombre} - Academia COHAB`);
    const gmailBody = encodeURIComponent(`Hola,\n\nTe comparto tu código QR para verificar el estado de pago:\n\n🔲 Código QR - ${alumno.nombre}\nID: ${alumno.id}\n\nURL: ${studentUrl}\n\nEscanea este código QR o visita la URL para verificar tu estado de pago.\n\nSaludos,\nAcademia COHAB`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${alumno.email || ''}&su=${gmailSubject}&body=${gmailBody}`;
    
    infoDiv.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${alumno.id}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Nombre:</strong> ${alumno.nombre}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Último pago:</strong> ${ultimoPagoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Próximo pago:</strong> ${proximoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Monto:</strong> ${montoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Estado:</strong> ${diasTexto}</div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd;">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 0.5rem;">
                <button onclick="navigator.clipboard.writeText('${studentUrl}').then(() => { if(typeof showToast === 'function') showToast('✅ URL copiada', 'success'); else alert('✅ URL copiada'); }).catch(() => alert('URL: ' + '${studentUrl}'))" style="background: #6366f1; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; flex: 1; min-width: 120px;">📋 Copiar URL</button>
                <button onclick="window.open('${whatsappUrl}', '_blank')" style="background: #25D366; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; flex: 1; min-width: 120px;">📱 WhatsApp</button>
                <button onclick="window.open('${gmailUrl}', '_blank')" style="background: #EA4335; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; flex: 1; min-width: 120px;">📧 Gmail</button>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 0.5rem;">
                <button onclick="imprimirQR('${alumno.id}')" style="background: #dc2626; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; flex: 1; min-width: 120px;">🖨️ Imprimir</button>
                ${alumno.email ? `<button onclick="enviarQRPorEmail('${alumno.id}')" style="background: #f59e0b; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.8rem; flex: 1; min-width: 120px;">✉️ Email API</button>` : ''}
            </div>
        </div>
        <div style="color: #666; font-size: 0.8rem; margin-top: 0.5rem;">Generado: ${new Date().toLocaleString()}</div>
    `;
    
    qrContainer.appendChild(infoDiv);
    
    // Guardar datos del alumno para funciones adicionales
    qrContainer.dataset.alumnoId = alumno.id;
    qrContainer.dataset.studentUrl = studentUrl;
    
    document.getElementById('qrModal').style.display = 'block';
}

// Cerrar modal QR
function closeQRModal() {
    document.getElementById('qrModal').style.display = 'none';
}

// Descargar QR
function downloadQR() {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        const alumnoId = document.querySelector('#qrcode').dataset.alumnoId;
        const alumno = alumnos.find(a => a.id === alumnoId);
        const nombreArchivo = alumno ? `qr-${alumno.nombre.replace(/\s+/g, '-')}-${alumnoId.substring(0, 8)}.png` : 'qr-alumno.png';
        link.download = nombreArchivo;
        link.href = canvas.toDataURL();
        link.click();
        if (typeof showToast === 'function') {
            showToast('QR descargado exitosamente', 'success');
        }
    }
}

// Imprimir QR
function imprimirQR(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) {
        alert('Primero genera el QR del alumno');
        return;
    }
    
    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank', 'width=800,height=600');
    const qrImage = canvas.toDataURL();
    
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR - ${alumno.nombre}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none; }
                }
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 40px;
                }
                .qr-container {
                    margin: 20px 0;
                }
                .qr-info {
                    margin-top: 20px;
                    font-size: 14px;
                    color: #333;
                }
                .qr-info h3 {
                    margin: 10px 0;
                    color: #dc2626;
                }
                button {
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 20px 10px;
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <h2>🔲 Código QR - ${alumno.nombre}</h2>
                <button onclick="window.print()">🖨️ Imprimir</button>
                <button onclick="window.close()">Cerrar</button>
            </div>
            <div class="qr-container">
                <img src="${qrImage}" alt="QR Code" style="max-width: 400px; width: 100%;">
            </div>
            <div class="qr-info">
                <h3>${alumno.nombre}</h3>
                <p><strong>ID:</strong> ${alumno.id}</p>
                <p><strong>Academia COHAB</strong></p>
                <p style="font-size: 12px; color: #666; margin-top: 20px;">Escanea este código para verificar el estado de pago</p>
            </div>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
}

// Enviar QR por Email
async function enviarQRPorEmail(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    if (!alumno.email || !alumno.email.trim()) {
        alert('⚠️ Este alumno no tiene email registrado. Agrega un email primero.');
        return;
    }
    
    if (!window.MONGO || !MONGO.isConfigured()) {
        alert('⚠️ MongoDB no está configurado. Configura la API de MongoDB primero en el Panel Admin.');
        return;
    }
    
    if (confirm(`¿Enviar código QR por email a ${alumno.nombre}?\n\nEmail: ${alumno.email}`)) {
        try {
            showNotification('Enviando QR por email...', 'info');
            await MONGO.enviarQr(id);
            showNotification('✅ QR enviado por email exitosamente', 'success');
        } catch (error) {
            console.error('Error enviando QR:', error);
            alert('❌ Error al enviar QR por email: ' + error.message);
        }
    }
}

// Ir a verificación
function irAVerificacion() {
    window.location.href = 'verificar.html';
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const alumnoModal = document.getElementById('alumnoModal');
    const qrModal = document.getElementById('qrModal');
    
    if (event.target === alumnoModal) {
        closeModal();
    }
    if (event.target === qrModal) {
        closeQRModal();
    }
}

// Función de búsqueda/filtrado de alumnos
function filterAlumnos() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const grid = document.getElementById('alumnosGrid');
    
    if (!grid) {
        return;
    }
    
    if (!searchTerm) {
        // Si no hay término de búsqueda, mostrar todos
        loadAlumnos();
        return;
    }
    
    // Filtrar alumnos
    const alumnosFiltrados = alumnos.filter(alumno => {
        const nombre = (alumno.nombre || '').toLowerCase();
        const email = (alumno.email || '').toLowerCase();
        const telefono = (alumno.telefono || '').toLowerCase();
        const id = (alumno.id || '').toLowerCase();
        
        return nombre.includes(searchTerm) ||
               email.includes(searchTerm) ||
               telefono.includes(searchTerm) ||
               id.includes(searchTerm);
    });
    
    // Limpiar grid
    grid.innerHTML = '';
    
    if (alumnosFiltrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">🔍</div>
                <h3>No se encontraron alumnos</h3>
                <p>Intenta con otro término de búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Mostrar alumnos filtrados
    alumnosFiltrados.forEach(alumno => {
        const estado = calcularEstado(alumno);
        const card = document.createElement('div');
        card.className = `alumno-card estado-${estado.clase}`;
        
        // Icono según estado
        let estadoIcon = '';
        let estadoColor = '';
        if (estado.clase === 'atrasado') {
            estadoIcon = '🔴';
            estadoColor = '#ef4444';
        } else if (estado.clase === 'proximo') {
            estadoIcon = '🟠';
            estadoColor = '#f59e0b';
        } else {
            estadoIcon = '🟢';
            estadoColor = '#10b981';
        }
        
        card.innerHTML = `
            <div class="card-header-new">
                <div class="card-status-badge status-${estado.clase}">
                    <span class="status-icon">${estadoIcon}</span>
                    <span class="status-text">${estado.texto}</span>
                </div>
                <h3 class="card-name">${alumno.nombre}</h3>
            </div>
            <div class="card-body-new">
                <div class="card-info-compact">
                    <div class="info-item-compact">
                        <span class="info-icon">💰</span>
                        <span class="info-text">$${parseFloat(alumno.monto).toFixed(2)}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon">📆</span>
                        <span class="info-text">Pago: ${ultimoPagoTexto}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon">📅</span>
                        <span class="info-text">${estado.proximo}</span>
                    </div>
                    ${alumno.email ? `
                    <div class="info-item-compact">
                        <span class="info-icon">📧</span>
                        <span class="info-text">${alumno.email}</span>
                    </div>
                    ` : ''}
                    ${alumno.telefono ? `
                    <div class="info-item-compact">
                        <span class="info-icon">📱</span>
                        <span class="info-text">${alumno.telefono}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions-new">
                <button class="action-btn-new btn-primary-action" onclick="showQR('${alumno.id}')" title="Ver QR">
                    <span class="btn-icon">🔲</span>
                    <span class="btn-text">QR</span>
                </button>
                <button class="action-btn-new btn-secondary-action" onclick="editAlumno('${alumno.id}')" title="Editar">
                    <span class="btn-icon">✏️</span>
                    <span class="btn-text">Editar</span>
                </button>
                <button class="action-btn-new btn-danger-action" onclick="deleteAlumno('${alumno.id}')" title="Eliminar">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Eliminar</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
    
}

// Función para actualizar base de datos y recalcular estados
async function updateDatabase() {
    try {
        // Recargar alumnos desde MongoDB si está configurado
        if (window.MONGO && MONGO.isConfigured()) {
            const alumnosNube = await MONGO.listAlumnos();
            if (Array.isArray(alumnosNube) && alumnosNube.length > 0) {
                alumnos = alumnosNube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
            }
        } else if (window.SUPA && SUPA.isConfigured()) {
            const alumnosNube = await SUPA.listAlumnos();
            if (Array.isArray(alumnosNube) && alumnosNube.length > 0) {
                alumnos = alumnosNube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
            }
        }
        
        // Recargar la vista para mostrar estados actualizados
        await loadAlumnos();
        
        // Mostrar mensaje de éxito
        if (typeof showNotification === 'function') {
            showNotification('Base de datos actualizada correctamente', 'success');
        } else {
            alert('Base de datos actualizada correctamente');
        }
    } catch (error) {
        alert('Error al actualizar la base de datos: ' + error.message);
    }
}
