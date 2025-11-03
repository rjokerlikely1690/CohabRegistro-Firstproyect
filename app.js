// Sistema COHAB - Academia de BJJ
// Versión limpia sin funciones problemáticas

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
function calcularEstado(alumno) {
    const hoy = new Date();
    const fechaPago = new Date(alumno.fechaPago);
    const proximoPago = new Date(fechaPago);
    
    proximoPago.setMonth(proximoPago.getMonth() + 1);
    proximoPago.setDate(diaPagoGlobal);
    
    if (proximoPago.getDate() !== diaPagoGlobal) {
        proximoPago.setDate(0);
    }
    
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

// Cargar alumnos - VERSIÓN LIMPIA
async function loadAlumnos() {
    console.log('📚 Cargando alumnos...');
    const grid = document.getElementById('alumnosGrid');
    if (!grid) {
        console.error('❌ No se encontró alumnosGrid');
        return;
    }
    
    grid.innerHTML = '';
    
    // Si hay Supabase configurado, sincronizar desde la nube
    try {
        if (window.SUPA && SUPA.isConfigured()) {
            const nube = await SUPA.listAlumnos();
            if (Array.isArray(nube)) {
                alumnos = nube;
                localStorage.setItem('alumnos', JSON.stringify(alumnos));
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
    
    alumnos.forEach(alumno => {
        const estado = calcularEstado(alumno);
        const card = document.createElement('div');
        card.className = `alumno-card estado-${estado.clase}`;
        card.innerHTML = `
            <div class="card-header">
                <div class="status-indicator ${estado.clase}"></div>
                <h3>${alumno.nombre}</h3>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span class="info-label">Email</span>
                    <span class="info-value">${alumno.email || 'No especificado'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Teléfono</span>
                    <span class="info-value">${alumno.telefono || 'No especificado'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Monto</span>
                    <span class="info-value">$${alumno.monto}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Estado</span>
                    <span class="info-value status-${estado.clase}">${estado.texto}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Próximo</span>
                    <span class="info-value">${estado.proximo}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editAlumno('${alumno.id}')">✏️ Editar</button>
                <button class="action-btn btn-qr" onclick="showQR('${alumno.id}')">🔲 QR</button>
                <button class="action-btn btn-delete" onclick="deleteAlumno('${alumno.id}')">🗑️ Eliminar</button>
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

// Guardar alumno - VERSIÓN LIMPIA
async function saveAlumno(event) {
    event.preventDefault();
    console.log('💾 Iniciando guardado de alumno...');

    const isEditing = Boolean(editingAlumno);

    try {
        const formData = {
            id: editingAlumno || null,
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            fechaPago: document.getElementById('fechaPago').value,
            diaPago: diaPagoGlobal,
            monto: parseFloat(document.getElementById('monto').value)
        };
        
        console.log('📝 Datos del formulario:', formData);
        
        // Validaciones
        if (!formData.nombre) {
            console.error('❌ Error: El nombre es obligatorio');
            alert('El nombre es obligatorio');
            return;
        }
        
        if (formData.monto <= 0 || isNaN(formData.monto)) {
            console.error('❌ Error: El monto debe ser mayor a 0');
            alert('El monto debe ser mayor a 0');
            return;
        }
        
        console.log('✅ Validaciones pasadas, guardando alumno...');
        
        if (editingAlumno) {
            // Editar alumno existente
            const index = alumnos.findIndex(a => a.id === editingAlumno);
            if (index !== -1) {
                alumnos[index] = formData;
                console.log('📝 Alumno editado:', formData);
            }
        } else {
            // Agregar nuevo alumno
            try {
                if (window.SUPA && SUPA.isConfigured()) {
                    // Si Supabase está configurado, permitir que la BD genere el ID (si tiene default)
                    const payload = { ...formData };
                    delete payload.id; // no enviar id para que el servidor lo asigne si corresponde
                    const inserted = await SUPA.insertAlumnoReturningId(payload);
                    if (inserted && inserted.id) {
                        formData.id = inserted.id;
                    } else {
                        formData.id = generateId();
                    }
                } else {
                    formData.id = generateId();
                }
            } catch (e) {
                console.warn('Fallo insert remoto, se usará ID local', e);
                formData.id = generateId();
            }
            alumnos.push(formData);
            console.log('➕ Nuevo alumno agregado:', formData);
        }
        
        // Guardar en localStorage
        localStorage.setItem('alumnos', JSON.stringify(alumnos));
        
        // Guardar en Supabase si está configurado
        try { if (window.SUPA && SUPA.isConfigured()) { await SUPA.upsertAlumno(formData); } } catch (e) { console.warn('Supabase upsert fallo', e); }
        console.log('💾 Datos guardados en localStorage');
        
        // Recargar vista SIN llamar a funciones problemáticas
        loadAlumnos();
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
        try { if (window.SUPA && SUPA.isConfigured()) { await SUPA.deleteAlumno(id); } } catch (e) { console.warn('Supabase delete fallo', e); }
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

console.log('🚀 Sistema COHAB - Versión limpia cargada correctamente');