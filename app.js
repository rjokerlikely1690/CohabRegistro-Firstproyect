// Sistema COHAB - Academia de BJJ
// Versión limpia sin funciones problemáticas
// VERSIÓN: 11 - Cálculo corregido de mes de pago

console.log('✅ App.js cargado - Versión 11 - Cálculo corregido');

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
    console.log('🚀 Sistema COHAB iniciando...');
    loadAlumnos();
    updateDiaPagoButtons();
    
    // Agregar listener de prueba para el botón
    const addButton = document.querySelector('.btn-primary');
    if (addButton) {
        addButton.addEventListener('click', function() {
            console.log('🔘 Botón tocado - listener funciona');
        });
    }
    
    // Actualizar automáticamente los estados cada minuto
    setInterval(function() {
        console.log('🔄 Actualizando estados automáticamente...');
        loadAlumnos(); // Recargar alumnos recalcula todos los estados
    }, 60000); // Cada 60 segundos (1 minuto)
    
    // Actualizar cuando la ventana recupera el foco (cuando vuelves a la pestaña)
    window.addEventListener('focus', function() {
        console.log('👁️ Ventana recuperó foco, actualizando estados...');
        loadAlumnos();
    });
    
    // Actualizar cuando la página se vuelve visible (cambio de pestaña)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('👀 Página visible, actualizando estados...');
            loadAlumnos();
        }
    });
    
    console.log('✅ Sistema COHAB cargado correctamente');
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
// LÓGICA CORREGIDA: Los pagos realizados después del día de vencimiento corresponden al mes anterior
// Ejemplo: Si vence el 30/31 de octubre y pagas el 2 de noviembre, ese pago es de OCTUBRE
function calcularEstado(alumno) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    const fechaPago = new Date(alumno.fechaPago);
    fechaPago.setHours(0, 0, 0, 0);
    
    // Usar el día de pago del alumno, no el global
    const diaPagoAlumno = parseInt(alumno.diaPago) || diaPagoGlobal;
    
    // Debug: Solo para los primeros cálculos
    if (!window._calculoDebug) {
        window._calculoDebug = true;
        console.log('🔍 DEBUG Cálculo - Alumno:', alumno.nombre);
        console.log('  - Fecha último pago:', fechaPago.toLocaleDateString('es-ES'));
        console.log('  - Día de pago:', diaPagoAlumno);
        console.log('  - Hoy:', hoy.toLocaleDateString('es-ES'));
    }
    
    // PASO 1: Determinar a qué mes corresponde realmente el último pago
    // Si pagaste el 2 de noviembre y tu vencimiento es el 30/31, ese pago corresponde a OCTUBRE
    
    // Calcular el día de vencimiento del mes de la fecha de pago
    let vencimientoMesActual = new Date(fechaPago.getFullYear(), fechaPago.getMonth(), diaPagoAlumno);
    
    // Si el día no existe (ej: 31 en febrero), ajustar al último día del mes
    if (vencimientoMesActual.getDate() !== diaPagoAlumno) {
        vencimientoMesActual = new Date(fechaPago.getFullYear(), fechaPago.getMonth() + 1, 0); // Último día del mes
    }
    
    // Determinar el mes efectivo del pago
    let mesVencimientoPago;
    
    // Si la fecha de pago es ANTES del día de vencimiento del mes, el pago corresponde al mes ANTERIOR
    // Ejemplo: Si pagaste el 2 de noviembre y el vencimiento es el 30, ese pago es de octubre
    if (fechaPago < vencimientoMesActual) {
        // El pago corresponde al mes anterior
        mesVencimientoPago = new Date(fechaPago.getFullYear(), fechaPago.getMonth() - 1, diaPagoAlumno);
        
        // Si el día no existe en el mes anterior, usar el último día de ese mes
        if (mesVencimientoPago.getDate() !== diaPagoAlumno) {
            mesVencimientoPago = new Date(fechaPago.getFullYear(), fechaPago.getMonth(), 0); // Último día del mes anterior
        }
    } else {
        // El pago corresponde al mes de la fecha de pago
        mesVencimientoPago = new Date(vencimientoMesActual);
    }
    
    // PASO 2: Calcular el próximo vencimiento
    // El próximo vencimiento es el día 30/31 del mes SIGUIENTE al mes efectivo del pago
    let proximoPago = new Date(mesVencimientoPago.getFullYear(), mesVencimientoPago.getMonth() + 1, diaPagoAlumno);
    
    // Si el día del mes no existe (ej: 31 en febrero), ajustar al último día del mes
    if (proximoPago.getDate() !== diaPagoAlumno) {
        proximoPago = new Date(mesVencimientoPago.getFullYear(), mesVencimientoPago.getMonth() + 2, 0); // Último día del mes siguiente
    }
    
    // PASO 3: Si el próximo vencimiento ya pasó, calcular el siguiente
    // Esto puede pasar si el último pago fue hace mucho tiempo
    while (proximoPago < hoy) {
        proximoPago = new Date(proximoPago.getFullYear(), proximoPago.getMonth() + 1, diaPagoAlumno);
        // Verificar nuevamente si el día existe en el nuevo mes
        if (proximoPago.getDate() !== diaPagoAlumno) {
            proximoPago = new Date(proximoPago.getFullYear(), proximoPago.getMonth() + 1, 0); // Último día del mes
        }
    }
    
    proximoPago.setHours(0, 0, 0, 0);
    
    // Debug
    if (window._calculoDebug) {
        console.log('  - Próximo pago calculado:', proximoPago.toLocaleDateString('es-ES'));
        const diasRestantesDebug = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
        console.log('  - Días restantes:', diasRestantesDebug);
        window._calculoDebug = false;
    }
    
    // PASO 4: Calcular días restantes
    const diasRestantes = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
    
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
    console.log('📚 Cargando alumnos...');
    const grid = document.getElementById('alumnosGrid');
    if (!grid) {
        console.error('❌ No se encontró alumnosGrid');
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
                console.log('✅ Sincronizado desde MongoDB');
            }
        }
    } catch (e) { console.warn('No se pudo sincronizar desde MongoDB', e); }
    
    // Si hay Supabase configurado (fallback o alternativo)
    try {
        if (alumnos.length === 0 && window.SUPA && SUPA.isConfigured()) {
            const nube = await SUPA.listAlumnos();
            if (Array.isArray(nube)) {
                alumnos = nube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
                console.log('✅ Sincronizado desde Supabase');
            }
        }
    } catch (e) { console.warn('No se pudo sincronizar desde Supabase', e); }
    
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
    
    // Recalcular estados de TODOS los alumnos automáticamente
    console.log(`🔄 Recalculando estados para ${alumnos.length} alumnos...`);
    
    alumnos.forEach(alumno => {
        // El estado se calcula automáticamente cada vez que se carga
        // Esto asegura que siempre esté actualizado con la fecha actual
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
    
    console.log(`✅ ${alumnos.length} alumnos cargados`);
}

// Abrir modal para agregar alumno
function openModal() {
    console.log('🔧 Abriendo modal principal...');

    editingAlumno = null;

    const modal = document.getElementById('alumnoModal');
    const form = document.getElementById('alumnoForm');
    const title = document.getElementById('modalTitle');

    if (!modal || !form || !title) {
        console.error('❌ No se encontró el modal o el formulario principal');
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

    console.log('✅ Modal principal abierto');
}

// Cerrar modal - VERSIÓN SIMPLE
function closeModal() {
    console.log('🔧 Cerrando modal...');

    const modal = document.getElementById('alumnoModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    editingAlumno = null;
    console.log('✅ Modal cerrado');
}

// Guardar alumno - VERSIÓN LIMPIA CON PREVENCIÓN DE DUPLICADOS
async function saveAlumno(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevenir múltiples envíos
    
    console.log('💾 Iniciando guardado de alumno...');

    const isEditing = Boolean(editingAlumno);
    
    // Prevenir múltiples envíos simultáneos
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton && submitButton.disabled) {
        console.warn('⚠️ Guardado ya en progreso, ignorando...');
        return;
    }
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';
    }

    try {
        const formData = {
            id: editingAlumno || null,
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            fechaPago: document.getElementById('fechaPago').value,
            diaPago: diaPagoGlobal, // Usar el día de pago actual (global o del alumno si está editando)
            monto: parseFloat(document.getElementById('monto').value)
        };
        
        console.log('📝 Datos del formulario:', formData);
        
        // Validaciones
        if (!formData.nombre) {
            console.error('❌ Error: El nombre es obligatorio');
            alert('El nombre es obligatorio');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar';
            }
            return;
        }
        
        if (formData.monto <= 0 || isNaN(formData.monto)) {
            console.error('❌ Error: El monto debe ser mayor a 0');
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
        
        console.log('✅ Validaciones pasadas, guardando alumno...');
        
        if (editingAlumno) {
            // Editar alumno existente
            const index = alumnos.findIndex(a => a.id === editingAlumno);
            if (index !== -1) {
                formData.id = editingAlumno; // Mantener el ID original
                alumnos[index] = formData;
                console.log('📝 Alumno editado:', formData);
                
                // Guardar en MongoDB/Supabase
                try {
                    if (window.MONGO && MONGO.isConfigured()) {
                        await MONGO.upsertAlumno(formData);
                        console.log('✅ Alumno actualizado en MongoDB');
                    } else if (window.SUPA && SUPA.isConfigured()) {
                        await SUPA.upsertAlumno(formData);
                        console.log('✅ Alumno actualizado en Supabase');
                    }
                } catch (e) {
                    console.error('❌ Error actualizando en nube:', e);
                }
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
                        console.log('✅ Alumno insertado en MongoDB con ID:', nuevoId);
                    }
                } else if (window.SUPA && SUPA.isConfigured()) {
                    // Fallback a Supabase
                    const payload = { ...formData };
                    delete payload.id;
                    const inserted = await SUPA.insertAlumnoReturningId(payload);
                    if (inserted && inserted.id) {
                        nuevoId = inserted.id;
                        console.log('✅ Alumno insertado en Supabase con ID:', nuevoId);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Fallo insert remoto, se usará ID local', e);
            }
            
            // Si no se obtuvo ID de la nube, generar uno local
            if (!nuevoId) {
                nuevoId = generateId();
            }
            
            formData.id = nuevoId;
            
            // Verificar que no se haya duplicado antes de agregar
            const yaExiste = alumnos.some(a => a.id === nuevoId);
            if (!yaExiste) {
                alumnos.push(formData);
                console.log('➕ Nuevo alumno agregado:', formData);
            } else {
                console.warn('⚠️ El alumno ya existe, omitiendo duplicado');
            }
        }
        
        // Guardar en localStorage
        localStorage.setItem('alumnos', JSON.stringify(alumnos));
        console.log('💾 Datos guardados en localStorage');
        
        // Recargar vista
        await loadAlumnos();
        closeModal();
        console.log('✅ Alumno guardado exitosamente');

        // Mostrar mensaje de éxito
        const message = isEditing ? 'Alumno actualizado correctamente' : 'Alumno agregado correctamente';
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        } else {
            alert(message);
        }

    } catch (error) {
        console.error('❌ Error al guardar alumno:', error);
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
    console.log('✏️ Editando alumno:', id);
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    editingAlumno = id;
    
    document.getElementById('modalTitle').textContent = 'Editar Alumno';
    document.getElementById('alumnoId').value = alumno.id;
    document.getElementById('nombre').value = alumno.nombre;
    document.getElementById('email').value = alumno.email || '';
    document.getElementById('telefono').value = alumno.telefono || '';
    document.getElementById('fechaPago').value = alumno.fechaPago;
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
    console.log('🗑️ Eliminando alumno:', id);
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
        } catch (e) { console.warn('Delete remoto fallo', e); }
        await loadAlumnos();
        alert(`Alumno ${alumnoEliminado ? alumnoEliminado.nombre : ''} eliminado correctamente`);
        console.log('✅ Alumno eliminado correctamente');
    }
}

// Mostrar QR
function showQR(id) {
    console.log('🔲 Mostrando QR para:', id);
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
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
        console.error('❌ No se encontró alumnosGrid');
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
    
    console.log(`✅ ${alumnosFiltrados.length} alumnos encontrados para "${searchTerm}"`);
}

// Función para actualizar base de datos y recalcular estados
async function updateDatabase() {
    console.log('🔄 Actualizando base de datos...');
    
    try {
        // Recargar alumnos desde MongoDB si está configurado
        if (window.MONGO && MONGO.isConfigured()) {
            const alumnosNube = await MONGO.listAlumnos();
            if (Array.isArray(alumnosNube) && alumnosNube.length > 0) {
                alumnos = alumnosNube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
                console.log('✅ Datos sincronizados desde MongoDB');
            }
        } else if (window.SUPA && SUPA.isConfigured()) {
            const alumnosNube = await SUPA.listAlumnos();
            if (Array.isArray(alumnosNube) && alumnosNube.length > 0) {
                alumnos = alumnosNube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
                console.log('✅ Datos sincronizados desde Supabase');
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
        
        console.log('✅ Actualización completada');
    } catch (error) {
        console.error('❌ Error al actualizar base de datos:', error);
        alert('Error al actualizar la base de datos: ' + error.message);
    }
}

console.log('🚀 Sistema COHAB - Versión limpia cargada correctamente');