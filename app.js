// Sistema COHAB - Academia de BJJ
// Versión limpia sin funciones problemáticas
// VERSIÓN: 15 - Lógica corregida (mes anterior) + logs de debug
console.log('✅ App.js cargado - Versión 15 - Logs de debug activos');

let alumnos = JSON.parse(localStorage.getItem('alumnos')) || [];
let editingAlumno = null;
let diaPagoGlobal = parseInt(localStorage.getItem('diaPagoGlobal')) || 30;

// Obtener URL base del servidor para generar enlaces que funcionen en móviles
function getServerBaseUrl() {
    let configured = localStorage.getItem('serverBaseUrl');
    let base;
    if (configured && /^https?:\/\//i.test(configured)) {
        base = configured;
    } else {
        // Si no está configurado y no es localhost, inicializar automáticamente
        const isLoopback = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        base = window.location.origin + window.location.pathname.replace('index.html', '');
        if (!isLoopback) {
            try {
                localStorage.setItem('serverBaseUrl', base.replace(/\/$/, ''));
            } catch (_) {}
        }
    }
    if (!base.endsWith('/')) base += '/';
    return base;
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
    let fechaPago;
    if (!alumno.fechaPago) {
        console.warn('⚠️ Alumno sin fechaPago:', alumno.nombre, 'Usando fecha de hoy');
        fechaPago = new Date();
    } else if (typeof alumno.fechaPago === 'string') {
        // Si es string, parsear como fecha
        fechaPago = new Date(alumno.fechaPago);
        if (isNaN(fechaPago.getTime())) {
            console.warn('⚠️ Fecha inválida en string:', alumno.fechaPago, 'Usando fecha de hoy');
            fechaPago = new Date();
        }
    } else if (alumno.fechaPago instanceof Date) {
        fechaPago = new Date(alumno.fechaPago);
    } else {
        // Fallback: usar fecha de hoy si no hay fecha válida
        console.warn('⚠️ Tipo de fecha desconocido:', typeof alumno.fechaPago, 'Usando fecha de hoy');
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
    console.log(`   - Fecha pago parseada: ${fechaPago.toISOString().split('T')[0]}`);
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
        if (alumno.fechaPago) {
            const fechaUltimoPago = new Date(alumno.fechaPago);
            if (!isNaN(fechaUltimoPago.getTime())) {
                ultimoPagoTexto = fechaUltimoPago.toLocaleDateString('es-ES');
            }
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
    editingAlumno = null;

    const modal = document.getElementById('alumnoModal');
    const form = document.getElementById('alumnoForm');
    const title = document.getElementById('modalTitle');

    if (!modal || !form || !title) {
        return;
    }

    // Limpiar formulario
    form.reset();
    document.getElementById('alumnoId').value = '';
    title.textContent = 'Agregar Nuevo Alumno';

    // Establecer valores iniciales
    setTodayDate();
    updateDiaPagoButtons();

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    // Enfocar primer campo
    setTimeout(() => {
        const firstInput = document.getElementById('nombre');
        if (firstInput) {
            firstInput.focus();
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
            let nuevoId = null;
            
            try {
                if (window.MONGO && MONGO.isConfigured()) {
                    // Priorizar MongoDB - solo insert, no upsert después
                    const payload = { ...formData };
                    delete payload.id;
                    const inserted = await MONGO.insertAlumnoReturningId(payload);
                    if (inserted && inserted.id) {
                        nuevoId = inserted.id;
                    }
                } else if (window.SUPA && SUPA.isConfigured()) {
                    // Fallback a Supabase
                    const payload = { ...formData };
                    delete payload.id;
                    const inserted = await SUPA.insertAlumnoReturningId(payload);
                    if (inserted && inserted.id) {
                        nuevoId = inserted.id;
                    }
                }
            } catch (e) {}
            
            // Si no se obtuvo ID de la nube, generar uno local
            if (!nuevoId) {
                nuevoId = generateId();
            }
            
            formData.id = nuevoId;
            
            // Verificar que no se haya duplicado antes de agregar
            const yaExiste = alumnos.some(a => a.id === nuevoId);
            if (!yaExiste) {
                alumnos.push(formData);
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
        closeModal();

        // Mostrar mensaje de éxito
        const message = isEditing ? 'Alumno actualizado correctamente' : 'Alumno agregado correctamente';
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        } else {
            alert(message);
        }

    } catch (error) {
        alert('Error al guardar el alumno: ' + error.message);
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
    let ultimoPagoTexto = '---';
    if (alumno.fechaPago) {
        const fechaUltimoPago = new Date(alumno.fechaPago);
        if (!isNaN(fechaUltimoPago.getTime())) {
            ultimoPagoTexto = fechaUltimoPago.toLocaleDateString('es-ES');
        }
    }
    const montoTexto = alumno.monto ? `$${parseFloat(alumno.monto).toFixed(2)}` : '---';
    const proximoTexto = estado?.proximo || '---';
    const diasTexto = typeof estado?.texto === 'string' ? estado.texto : '';
    
    document.getElementById('qrNombre').textContent = `QR - ${alumno.nombre}`;
    
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    // Crear URL directa para el alumno usando base configurada
    let baseUrl = getServerBaseUrl();
    // Usar URLs "bonitas" en Netlify o si el usuario lo activó
    const usePretty = (localStorage.getItem('usePrettyUrls') === '1') || (/\.netlify\.app$/i.test(window.location.hostname));
    // Asegurar base con trailing slash
    try { if (!baseUrl.endsWith('/')) baseUrl += '/'; } catch(_) {}
    const studentUrl = usePretty
        ? `${baseUrl}alumno/${alumno.id}`
        : `${baseUrl}usuario.html?id=${alumno.id}`;
    
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
    
    // Agregar información
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        margin-top: 1rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        text-align: center;
    `;
    infoDiv.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>ID:</strong> ${alumno.id}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Nombre:</strong> ${alumno.nombre}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Último pago:</strong> ${ultimoPagoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Próximo pago:</strong> ${proximoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Monto:</strong> ${montoTexto}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Estado:</strong> ${diasTexto}</div>
        <div style="margin-bottom: 0.5rem; color: #dc2626; font-size: 0.8rem;"><strong>🔗 URL Directa:</strong></div>
        <div style="margin-bottom: 0.5rem; color: #666; font-size: 0.7rem; word-break: break-all; background: #f8f9fa; padding: 0.5rem; border-radius: 0.25rem;">${studentUrl}</div>
        <div style="color: #666; font-size: 0.8rem;">Generado: ${new Date().toLocaleString()}</div>
    `;
    
    qrContainer.appendChild(infoDiv);
    
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
        link.download = 'qr-alumno.png';
        link.href = canvas.toDataURL();
        link.click();
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
