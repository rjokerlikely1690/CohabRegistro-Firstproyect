// Sistema COHAB - Academia de BJJ
// Versión limpia sin funciones problemáticas
// VERSIÓN: 26 - Usa estado calculado por backend (fuente de verdad)
console.log('✅ App.js cargado - Versión 26 - Estado desde backend');

// ⚠️ NO usar localStorage para datos de negocio
// MongoDB es la única fuente de verdad
let alumnos = [];
let editingAlumno = null;
let diaPagoGlobal = 30; // Valor por defecto, se puede configurar desde UI si es necesario

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

// ELIMINADA: Función duplicada calcularEstado - usar solo la versión que prioriza backend (más abajo)

// Cargar alumnos - VERSIÓN LIMPIA CON ACTUALIZACIÓN AUTOMÁTICA
async function loadAlumnos() {
    const grid = document.getElementById('alumnosGrid');
    if (!grid) {
        return;
    }
    
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">⏳ Cargando alumnos desde MongoDB...</div>';
    
    // ✅ MongoDB es la ÚNICA fuente de verdad - SIN FALLBACK
    try {
        if (!window.MONGO || !MONGO.isConfigured()) {
            throw new Error('MongoDB no está configurado. Verifica que el servidor backend esté corriendo en http://localhost:3000');
        }
        
        const nube = await MONGO.listAlumnos();
        
        if (!Array.isArray(nube)) {
            throw new Error('Respuesta inválida del servidor MongoDB');
        }
        
        alumnos = nube;
        console.log('✅ Alumnos cargados desde MongoDB:', alumnos.length);
        
        // Mostrar mensaje de conexión exitosa
        const successMsg = document.createElement('div');
        successMsg.style.cssText = 'background: #d1fae5; border-left: 4px solid #10b981; padding: 1rem; margin-bottom: 1rem; border-radius: 0.5rem; color: #065f46;';
        successMsg.innerHTML = `
            <strong>✅ Conectado a MongoDB</strong><br>
            <small>${alumnos.length} alumnos cargados correctamente</small>
        `;
        grid.parentElement.insertBefore(successMsg, grid);
        
        // Remover mensaje después de 3 segundos
        setTimeout(() => {
            successMsg.remove();
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error al cargar desde MongoDB:', error);
        
        // Mostrar error EXPLÍCITO - NO usar localStorage
        grid.innerHTML = `
            <div class="empty-state error-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">❌</div>
                <h3>Error de conexión con MongoDB</h3>
                <p style="color: #dc2626; font-weight: bold;">${error.message}</p>
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 1rem; margin: 1rem 0; text-align: left;">
                    <strong>Soluciones:</strong>
                    <ol style="margin: 0.5rem 0; padding-left: 1.5rem;">
                        <li>Verifica que el servidor backend esté corriendo</li>
                        <li>Abre una terminal y ejecuta:<br><code style="background: #1f2937; color: #10b981; padding: 0.25rem 0.5rem; border-radius: 0.25rem; display: inline-block; margin-top: 0.5rem;">cd mongodb-api && PORT=3000 node server.js</code></li>
                        <li>Verifica que MongoDB Atlas esté accesible</li>
                    </ol>
                </div>
                <button onclick="loadAlumnos()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: bold;">
                    🔄 Reintentar Conexión
                </button>
            </div>
        `;
        alumnos = [];
        return;
    }
    
    if (alumnos.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">📚</div>
                <h3>No hay alumnos registrados</h3>
                <p>Haz clic en "Agregar Alumno" para comenzar</p>
            </div>
        `;
        updateDashboardStats();
        return;
    }
    
    // Renderizar alumnos
    renderizarTodosLosAlumnos();
    updateDashboardStats();
}

// Función para obtener estado - PRIORIZA datos del backend (fuente de verdad)
function calcularEstado(alumno) {
    // Si el backend ya calculó el estado, usarlo directamente
    if (alumno.clase && alumno.texto) {
        return {
            texto: alumno.texto,
            clase: alumno.clase,
            proximo: alumno.proximoPago ? formatFechaLocal(parseFechaLocal(alumno.proximoPago)) : '---',
            diasRestantes: alumno.diasRestantes ?? 0,
            diasDelMesVencido: alumno.diasDelMesVencido ?? 0
        };
    }
    
    // Fallback: calcular localmente solo si el backend no envió datos
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fechaPago = parseFechaLocal(alumno.fechaPago);
    if (!fechaPago) {
        return {
            texto: 'Sin pago registrado',
            clase: 'atrasado',
            proximo: '---',
            diasRestantes: -999,
            diasDelMesVencido: hoy.getDate()
        };
    }
    
    const diaPago = alumno.diaPago || diaPagoGlobal;
    
    // Calcular próximo pago (sin avanzar meses - si está atrasado, mostrar atraso)
    let proximoPago = new Date(fechaPago);
    proximoPago.setMonth(proximoPago.getMonth() + 1);
    proximoPago.setDate(Math.min(diaPago, new Date(proximoPago.getFullYear(), proximoPago.getMonth() + 1, 0).getDate()));
    proximoPago.setHours(0, 0, 0, 0);
    
    const diffTime = proximoPago - hoy;
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Días del mes vencido = día actual del mes (reinicia cada mes)
    const diasDelMesVencido = diasRestantes < 0 ? hoy.getDate() : 0;
    
    let texto, clase;
    if (diasRestantes < 0) {
        texto = `${diasDelMesVencido} días de atraso`;
        clase = 'atrasado';
    } else if (diasRestantes === 0) {
        texto = 'Vence hoy';
        clase = 'proximo';
    } else if (diasRestantes <= 7) {
        texto = `${diasRestantes} días restantes`;
        clase = 'proximo';
    } else {
        texto = `${diasRestantes} días restantes`;
        clase = 'al-dia';
    }
    
    return {
        texto,
        clase,
        proximo: formatFechaLocal(proximoPago),
        diasRestantes,
        diasDelMesVencido
    };
}

// Renderizar todos los alumnos en el grid
function renderizarTodosLosAlumnos() {
    const grid = document.getElementById('alumnosGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
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
        
        // Icono según estado - Círculos planos con iconos integrados
        let estadoIcon = '';
        let estadoColor = '';
        if (estado.clase === 'atrasado') {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#ef4444"/><path d="M15 9L9 15M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            estadoColor = '#ef4444';
        } else if (estado.clase === 'proximo') {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            estadoColor = '#f59e0b';
        } else {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
                        <span class="info-text">$${parseFloat(alumno.monto).toFixed(2)}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                        <span class="info-text">Último: ${ultimoPagoTexto}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
                        <span class="info-text">${estado.proximo}</span>
                    </div>
                    ${alumno.email ? `
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                        <span class="info-text">${alumno.email}</span>
                    </div>
                    ` : ''}
                    ${alumno.telefono ? `
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
                        <span class="info-text">${alumno.telefono}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions-new">
                <button class="action-btn-new btn-primary-action" onclick="showQR('${alumno.id}')" title="Ver QR">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 1-2-2v-3"/></svg></span>
                    <span class="btn-text">QR</span>
                </button>
                <button class="action-btn-new btn-secondary-action" onclick="editAlumno('${alumno.id}')" title="Editar">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                    <span class="btn-text">Editar</span>
                </button>
                <button class="action-btn-new btn-danger-action" onclick="deleteAlumno('${alumno.id}')" title="Eliminar">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
                    <span class="btn-text">Eliminar</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Actualizar estadísticas del dashboard
    updateDashboardStats();
}

// Actualizar estadísticas del dashboard
function updateDashboardStats() {
    const totalAlumnos = alumnos.length;
    let alumnosAlDia = 0;
    let alumnosVencidos = 0;
    let alumnosMorosos = 0;
    
    alumnos.forEach(alumno => {
        const estado = calcularEstado(alumno);
        if (estado.clase === 'al-dia') {
            alumnosAlDia++;
        } else if (estado.clase === 'atrasado') {
            const diasAtrasado = parseInt(estado.texto) || 0;
            if (diasAtrasado > 30) {
                alumnosMorosos++;
            } else {
                alumnosVencidos++;
            }
        } else if (estado.clase === 'proximo') {
            // Los que están por vencer se cuentan como "al día" para estadísticas
            alumnosAlDia++;
        }
    });
    
    // Actualizar elementos del DOM si existen
    const totalEl = document.getElementById('totalAlumnos');
    const alDiaEl = document.getElementById('alumnosAlDia');
    const vencidosEl = document.getElementById('alumnosVencidos');
    const morososEl = document.getElementById('alumnosMorosos');
    
    if (totalEl) totalEl.textContent = totalAlumnos;
    if (alDiaEl) alDiaEl.textContent = alumnosAlDia;
    if (vencidosEl) vencidosEl.textContent = alumnosVencidos;
    if (morososEl) morososEl.textContent = alumnosMorosos;
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
        
        const rutInput = document.getElementById('rut');
        const rutValue = rutInput ? rutInput.value.trim() : '';
        const formData = {
            id: editingAlumno || null,
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefono: document.getElementById('telefono').value.trim(),
            rut: rutValue || undefined,
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
                
                // ✅ Guardar en MongoDB (única fuente de verdad)
                try {
                    if (!window.MONGO || !MONGO.isConfigured()) {
                        throw new Error('MongoDB no está configurado');
                    }
                    
                        console.log('💾 Guardando en MongoDB...');
                        await MONGO.upsertAlumno(formData);
                        console.log('✅ Guardado exitoso en MongoDB');
                    
                } catch (error) {
                    console.error('❌ ERROR al guardar:', error);
                    alert(`Error al guardar: ${error.message}`);
                    return; // No continuar si falla
                }
            } else {
                console.error('❌ No se encontró el alumno con ID:', editingAlumno);
            }
        } else {
            // Agregar nuevo alumno - solo una vez
            console.log('➕ AGREGANDO NUEVO ALUMNO...');
            let nuevoId = null;
            
            try {
                if (!window.MONGO || !MONGO.isConfigured()) {
                    throw new Error('MongoDB no está configurado');
                }
                
                    console.log('💾 Intentando guardar en MongoDB...');
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
                
            } catch (error) {
                console.error('❌ Error al guardar en Supabase:', error);
                alert(`Error al guardar: ${error.message}`);
                return; // No continuar si falla
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
        
        // ✅ Recargar desde MongoDB para asegurar sincronización
        console.log('🔄 Recargando vista de alumnos desde MongoDB...');
        await loadAlumnos();

        if (formData.email) {
            console.log('📧 Email configurado, pero envío de QR solo disponible con backend');
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
    document.getElementById('rut').value = alumno.rut || '';
    
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
    if (await confirm('¿Estás seguro de eliminar este alumno?')) {
        const alumnoEliminado = alumnos.find(a => a.id === id);
        
        try {
            if (!window.MONGO || !MONGO.isConfigured()) {
                throw new Error('MongoDB no está configurado');
            }
            
            await MONGO.deleteAlumno(id);
            console.log('✅ Alumno eliminado de MongoDB');
            
            // Recargar desde MongoDB
        await loadAlumnos();
        alert(`Alumno ${alumnoEliminado ? alumnoEliminado.nombre : ''} eliminado correctamente`);
            
        } catch (error) {
            console.error('❌ Error al eliminar alumno:', error);
            alert(`Error al eliminar alumno: ${error.message}`);
        }
    }
}

// Mostrar QR
function showQR(id) {
    console.log('🔲 [QR] showQR llamado con id:', id);
    
    if (!id) {
        console.error('❌ [QR] ID no proporcionado');
        alert('Error: No se proporcionó ID del alumno');
        return;
    }
    
    const alumno = alumnos.find(a => a.id === id);
    console.log('🔲 [QR] Alumno encontrado:', alumno ? alumno.nombre : 'NO ENCONTRADO');
    
    if (!alumno) {
        console.error('❌ [QR] Alumno no encontrado para id:', id);
        alert('Error: Alumno no encontrado');
        return;
    }
    
    if (!alumno.id) {
        console.error('❌ [QR] Alumno sin ID:', alumno);
        alert('Error: El alumno no tiene ID asignado');
        return;
    }
    
    const estado = calcularEstado(alumno);
    const fechaUltimoPago = parseFechaLocal(alumno.fechaPago);
    const ultimoPagoTexto = formatFechaLocal(fechaUltimoPago);
    const montoTexto = alumno.monto ? `$${parseFloat(alumno.monto).toFixed(2)}` : '---';
    const proximoTexto = estado?.proximo || '---';
    const diasTexto = typeof estado?.texto === 'string' ? estado.texto : '';
    
    document.getElementById('qrNombre').textContent = alumno.nombre;
    
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) {
        console.error('❌ [QR] Contenedor #qrcode no encontrado');
        alert('Error: Contenedor QR no encontrado');
        return;
    }
    qrContainer.innerHTML = '';
    
    // URL fija de Cloudflare Pages
    const baseUrl = 'https://cohabregistro-firstproyect.pages.dev';
    
    // URL: ID obligatorio; RUT opcional (QRs nuevos incluyen RUT si está registrado)
    const studentUrl = buildStudentUrl(alumno.id, alumno.rut);
    
    console.log('🔲 [QR] ============ GENERANDO QR ============');
    console.log('🔲 [QR] Alumno ID:', alumno.id);
    console.log('🔲 [QR] Alumno nombre:', alumno.nombre);
    console.log('🔲 [QR] URL generada:', studentUrl);
    console.log('🔲 [QR] ========================================');
    
    // Verificar que QRCode esté disponible
    if (typeof QRCode === 'undefined') {
        console.error('❌ [QR] Librería QRCode no cargada');
        alert('Error: Librería QR no disponible. Recarga la página.');
        return;
    }
    
    // Crear wrapper blanco para el QR
    const qrWrapper = document.createElement('div');
    qrWrapper.style.cssText = 'background: #fff; padding: 1rem; border-radius: 1rem; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
    qrContainer.appendChild(qrWrapper);
    
    // Generar QR dentro del wrapper
    try {
        new QRCode(qrWrapper, {
            text: studentUrl,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H,
            margin: 0
        });
        console.log('✅ [QR] QR generado exitosamente');
    } catch (err) {
        console.error('❌ [QR] Error generando QR:', err);
        alert('Error al generar QR: ' + err.message);
        return;
    }
    
    // Guardar datos del alumno para funciones adicionales
    qrContainer.dataset.alumnoId = alumno.id;
    qrContainer.dataset.studentUrl = studentUrl;
    
    // Determinar clase de estado
    let statusClass = 'status-ok';
    if (estado?.clase === 'atrasado') statusClass = 'status-danger';
    else if (estado?.clase === 'proximo') statusClass = 'status-warning';
    
    // Crear tarjeta de información con diseño moderno
    const infoDiv = document.createElement('div');
    infoDiv.className = 'qr-info-card';
    infoDiv.innerHTML = `
        <div class="qr-info-row">
            <span class="qr-info-label">Nombre</span>
            <span class="qr-info-value">${alumno.nombre}</span>
        </div>
        <div class="qr-info-row">
            <span class="qr-info-label">Último pago</span>
            <span class="qr-info-value">${ultimoPagoTexto}</span>
        </div>
        <div class="qr-info-row">
            <span class="qr-info-label">Próximo pago</span>
            <span class="qr-info-value">${proximoTexto}</span>
        </div>
        <div class="qr-info-row">
            <span class="qr-info-label">Monto</span>
            <span class="qr-info-value">${montoTexto}</span>
        </div>
        <div class="qr-info-row">
            <span class="qr-info-label">Estado</span>
            <span class="qr-info-value ${statusClass}">${diasTexto}</span>
        </div>
    `;
    qrContainer.appendChild(infoDiv);
    
    // Crear botones de acción
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'qr-actions';
    actionsDiv.innerHTML = `
        <button class="qr-action-btn copy" onclick="navigator.clipboard.writeText('${studentUrl}').then(() => { if(typeof showToast === 'function') showToast('URL copiada', 'success'); else alert('URL copiada'); })">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copiar URL
        </button>
        <button class="qr-action-btn whatsapp" onclick="compartirQRWhatsApp('${alumno.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.486 2 2 6.486 2 12c0 1.885.525 3.64 1.431 5.14L2 22l4.968-1.39A9.955 9.955 0 0012 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm0 18c-1.665 0-3.246-.407-4.634-1.147l-.332-.192-3.442.903.92-3.36-.21-.352A7.952 7.952 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
            WhatsApp
        </button>
        <button class="qr-action-btn gmail" onclick="compartirQRGmail('${alumno.id}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            Gmail
        </button>
        <button class="qr-action-btn print" onclick="imprimirQR('${alumno.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir
        </button>
    `;
    qrContainer.appendChild(actionsDiv);
    
    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'qr-timestamp';
    timestamp.textContent = `Generado: ${new Date().toLocaleString()}`;
    qrContainer.appendChild(timestamp);
    
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

// Helper para construir URL del estudiante. ID = identificador corto (obligatorio). RUT = opcional (solo para QRs nuevos).
function buildStudentUrl(alumnoId, rutOptional) {
    let baseUrl = localStorage.getItem('serverBaseUrl');
    if (!baseUrl || !baseUrl.includes('pages.dev')) {
        baseUrl = 'https://cohabregistro-firstproyect.pages.dev';
    }
    baseUrl = baseUrl.replace(/\/verificar\/.*$/, '');
    baseUrl = baseUrl.replace(/\/[^\/]+\.html.*$/, '');
    baseUrl = baseUrl.replace(/\/$/, '');
    let url = baseUrl + '/public/alumno.html?id=' + encodeURIComponent(alumnoId);
    if (rutOptional && String(rutOptional).trim()) {
        url += '&rut=' + encodeURIComponent(String(rutOptional).trim());
    }
    return url;
}

// Compartir QR por WhatsApp con imagen
async function compartirQRWhatsApp(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    // Obtener el canvas del QR
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) {
        alert('⚠️ Primero genera el QR del alumno');
        return;
    }
    
    // Convertir canvas a blob
    canvas.toBlob(async (blob) => {
        if (!blob) {
            alert('❌ Error al generar la imagen del QR');
            return;
        }
        
        // Obtener URL del alumno
        const qrContainer = document.querySelector('#qrcode');
        const studentUrl = qrContainer.dataset.studentUrl || buildStudentUrl(alumno.id);
        const mensaje = `🔲 Código QR - ${alumno.nombre}\n\nID: ${alumno.id}\nURL: ${studentUrl}\n\nEscanea este código QR para verificar tu estado de pago.`;
        
        // Intentar usar Web Share API (soporta imágenes en algunos navegadores)
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([blob], `qr-${alumno.nombre.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: `QR - ${alumno.nombre}`,
                        text: mensaje
                    });
                    if (typeof showToast === 'function') {
                        showToast('✅ QR compartido por WhatsApp', 'success');
                    }
                    return;
                }
            } catch (e) {
                console.log('Web Share API no soporta archivos, usando método alternativo');
            }
        }
        
        // Método alternativo: descargar imagen y abrir WhatsApp con mensaje
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-${alumno.nombre.replace(/\s+/g, '-')}.png`;
        link.click();
        URL.revokeObjectURL(url);
        
        // Esperar un momento y abrir WhatsApp
        setTimeout(() => {
            const whatsappMessage = encodeURIComponent(mensaje);
            const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`;
            window.open(whatsappUrl, '_blank');
            
            if (typeof showToast === 'function') {
                showToast('📱 Imagen descargada. Ábrela y compártela por WhatsApp', 'info');
            } else {
                alert('📱 La imagen del QR se ha descargado. Ábrela desde tu galería y compártela por WhatsApp junto con el mensaje que se abrió.');
            }
        }, 500);
    }, 'image/png');
}

// Compartir QR por Gmail con imagen
function compartirQRGmail(id) {
    const alumno = alumnos.find(a => a.id === id);
    if (!alumno) return;
    
    // Obtener el canvas del QR
    const canvas = document.querySelector('#qrcode canvas');
    if (!canvas) {
        alert('⚠️ Primero genera el QR del alumno');
        return;
    }
    
    // Obtener URL del alumno
    const qrContainer = document.querySelector('#qrcode');
    const studentUrl = qrContainer ? (qrContainer.dataset.studentUrl || buildStudentUrl(alumno.id)) : buildStudentUrl(alumno.id);
    
    // Crear mensaje de texto plano
    const mensajeTexto = `Hola,\n\nTe comparto tu código QR para verificar el estado de pago:\n\n🔲 Código QR - ${alumno.nombre}\nID: ${alumno.id}\n\nURL: ${studentUrl}\n\nEscanea este código QR o visita la URL para verificar tu estado de pago.\n\nSaludos,\nAcademia COHAB`;
    
    // Primero descargar la imagen del QR
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    const nombreArchivo = `qr-${alumno.nombre.replace(/\s+/g, '-')}-${alumno.id.substring(0, 8)}.png`;
    link.download = nombreArchivo;
    link.click();
    
    // Esperar un momento y abrir Gmail
    setTimeout(() => {
        const gmailSubject = encodeURIComponent(`Código QR - ${alumno.nombre} - Academia COHAB`);
        const gmailBody = encodeURIComponent(mensajeTexto);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${alumno.email || ''}&su=${gmailSubject}&body=${gmailBody}`;
        
        window.open(gmailUrl, '_blank');
        
        if (typeof showToast === 'function') {
            showToast('📧 Imagen descargada. Ábrela y adjúntala al email que se abrió', 'info');
        } else {
            alert('📧 La imagen del QR se ha descargado. Ábrela desde tu carpeta de descargas y adjúntala al email de Gmail que se abrió.');
        }
    }, 500);
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
    
    if (await confirm(`¿Enviar código QR por email a ${alumno.nombre}?\n\nEmail: ${alumno.email}`)) {
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
    window.location.href = 'public/verificar.html';
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
    const filterEstado = document.getElementById('filterEstado');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const estadoFiltro = filterEstado ? filterEstado.value : '';
    const grid = document.getElementById('alumnosGrid');
    
    console.log('🔍 [BUSCAR] Término:', searchTerm, '| Filtro estado:', estadoFiltro);
    console.log('🔍 [BUSCAR] Total alumnos disponibles:', alumnos.length);
    
    if (!grid) {
        console.error('❌ [BUSCAR] Grid no encontrado');
        return;
    }
    
    // Filtrar alumnos por búsqueda de texto
    let alumnosFiltrados = [...alumnos]; // Copia del array
    
    if (searchTerm) {
        alumnosFiltrados = alumnosFiltrados.filter(alumno => {
            const nombre = (alumno.nombre || '').toLowerCase();
            const email = (alumno.email || '').toLowerCase();
            const telefono = (alumno.telefono || '').toLowerCase();
            const id = (alumno.id || '').toLowerCase();
            
            return nombre.includes(searchTerm) ||
                   email.includes(searchTerm) ||
                   telefono.includes(searchTerm) ||
                   id.includes(searchTerm);
        });
        console.log('🔍 [BUSCAR] Encontrados por texto:', alumnosFiltrados.length);
    }
    
    // Filtrar por estado
    if (estadoFiltro) {
        alumnosFiltrados = alumnosFiltrados.filter(alumno => {
            const estado = calcularEstado(alumno);
            switch (estadoFiltro) {
                case 'al-dia':
                    return estado.clase === 'al-dia';
                case 'por-vencer':
                    return estado.clase === 'proximo';
                case 'vencido':
                    return estado.clase === 'atrasado';
                case 'moroso':
                    const diasAtrasado = parseInt(estado.texto) || 0;
                    return estado.clase === 'atrasado' && diasAtrasado > 30;
                default:
                    return true;
            }
        });
    }
    
    // Si no hay filtros, mostrar todos
    if (!searchTerm && !estadoFiltro) {
        loadAlumnos();
        return;
    }
    
    // Limpiar grid
    grid.innerHTML = '';
    
    if (alumnosFiltrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
                <h3>No se encontraron alumnos</h3>
                <p>Intenta con otro término de búsqueda</p>
            </div>
        `;
        return;
    }
    
    // Mostrar alumnos filtrados
    alumnosFiltrados.forEach(alumno => {
        const estado = calcularEstado(alumno);
        const fechaUltimoPago = parseFechaLocal(alumno.fechaPago);
        const ultimoPagoTexto = formatFechaLocal(fechaUltimoPago);
        const card = document.createElement('div');
        card.className = `alumno-card estado-${estado.clase}`;
        
        // Icono según estado - Círculos planos con iconos integrados
        let estadoIcon = '';
        let estadoColor = '';
        if (estado.clase === 'atrasado') {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#ef4444"/><path d="M15 9L9 15M9 9l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            estadoColor = '#ef4444';
        } else if (estado.clase === 'proximo') {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#f59e0b"/><path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            estadoColor = '#f59e0b';
        } else {
            estadoIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
                        <span class="info-text">$${parseFloat(alumno.monto).toFixed(2)}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                        <span class="info-text">Último: ${ultimoPagoTexto}</span>
                    </div>
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
                        <span class="info-text">${estado.proximo}</span>
                    </div>
                    ${alumno.email ? `
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                        <span class="info-text">${alumno.email}</span>
                    </div>
                    ` : ''}
                    ${alumno.telefono ? `
                    <div class="info-item-compact">
                        <span class="info-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
                        <span class="info-text">${alumno.telefono}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions-new">
                <button class="action-btn-new btn-primary-action" onclick="showQR('${alumno.id}')" title="Ver QR">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 1-2-2v-3"/></svg></span>
                    <span class="btn-text">QR</span>
                </button>
                <button class="action-btn-new btn-secondary-action" onclick="editAlumno('${alumno.id}')" title="Editar">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                    <span class="btn-text">Editar</span>
                </button>
                <button class="action-btn-new btn-danger-action" onclick="deleteAlumno('${alumno.id}')" title="Eliminar">
                    <span class="btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
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
        // ✅ Recargar desde MongoDB (única fuente de verdad)
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

// Limpiar filtros
function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterEstado = document.getElementById('filterEstado');
    
    if (searchInput) searchInput.value = '';
    if (filterEstado) filterEstado.value = '';
    
    loadAlumnos();
}

// Exportar datos a CSV
function exportarDatos() {
    if (alumnos.length === 0) {
        alert('No hay alumnos para exportar');
        return;
    }
    
    // Crear encabezados CSV
    const headers = ['Nombre', 'Email', 'Teléfono', 'Fecha Último Pago', 'Día de Pago', 'Monto', 'Estado', 'Próximo Vencimiento', 'ID'];
    
    // Crear filas CSV
    const rows = alumnos.map(alumno => {
        const estado = calcularEstado(alumno);
        const fechaPago = parseFechaLocal(alumno.fechaPago);
        const fechaPagoTexto = fechaPago ? formatFechaLocal(fechaPago) : '---';
        const montoTexto = alumno.monto ? `$${parseFloat(alumno.monto).toFixed(2)}` : '---';
        
        return [
            `"${(alumno.nombre || '').replace(/"/g, '""')}"`,
            `"${(alumno.email || '').replace(/"/g, '""')}"`,
            `"${(alumno.telefono || '').replace(/"/g, '""')}"`,
            fechaPagoTexto,
            alumno.diaPago || '---',
            montoTexto,
            estado.texto || '---',
            estado.proximo || '---',
            alumno.id || '---'
        ].join(',');
    });
    
    // Combinar encabezados y filas
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\n');
    
    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `alumnos_cohab_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Mostrar notificación
    if (typeof showNotification === 'function') {
        showNotification('Datos exportados correctamente', 'success');
    } else {
        alert('Datos exportados correctamente');
    }
}
