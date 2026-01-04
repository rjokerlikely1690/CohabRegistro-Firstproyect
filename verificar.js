// Sistema de verificación de estado de pagos
// VERSIÓN: 14 - MongoDB como única fuente de verdad

// ⚠️ NO usar localStorage para datos de negocio
let alumnos = [];
let stream = null;
let scanning = false;
let currentFilter = 'all';
let currentTrack = null;
let currentDeviceId = null;

// URL base del servidor para construir enlaces válidos en móviles
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
    
    // Prioridad 5: Localhost - usar URL configurada de Cloudflare si existe
    if (configured && configured.includes('pages.dev')) {
        return configured.replace(/\/$/, '') + '/';
    }
    
    // Fallback: URL local (solo para desarrollo)
    const base = window.location.origin + window.location.pathname.replace(/[^/]*\.html$/, '').replace(/[^/]*$/, '');
    return base.replace(/\/$/, '') + '/';
}

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadTodosAlumnos();
});

// NOTA: La función calcularEstado() fue eliminada.
// Ahora el cálculo se hace en el backend (endpoint GET /alumnos/:id/validar)
// Esta es la fuente única de verdad para el estado de suscripciones.

// Formatear fecha
function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Iniciar escáner de cámara
async function startScanner() {
    try {
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const scannerContainer = document.getElementById('scanner-container');
        const torchBtn = document.getElementById('torchBtn');
        const cameraSelect = document.getElementById('cameraSelect');
        
        // Verificar si el navegador soporta getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showCustomAlert('Error de Cámara', 'Tu navegador no soporta acceso a la cámara. Por favor, usa Chrome, Safari o Firefox actualizado.', 'error');
            return;
        }
        
        // Configuración optimizada (permitir elegir cámara)
        const videoConstraints = currentDeviceId ? { deviceId: { exact: currentDeviceId } } : { facingMode: 'environment' };
        const constraints = {
            video: Object.assign({
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30, min: 15 }
            }, videoConstraints)
        };
        
        // Intentar obtener stream con configuración optimizada
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentTrack = stream.getVideoTracks()[0] || null;
        
        video.srcObject = stream;
        video.playsInline = true; // Importante para iOS
        video.muted = true;
        
        scannerContainer.style.display = 'block';
        scanning = true;
        
        // Torch disponible
        try {
            if (currentTrack && typeof currentTrack.getCapabilities === 'function') {
                const caps = currentTrack.getCapabilities();
                if (caps.torch) {
                    torchBtn.style.display = 'inline-flex';
                } else {
                    torchBtn.style.display = 'none';
                }
            }
        } catch (_) {}
        
        // Poblar lista de cámaras
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videos = devices.filter(d => d.kind === 'videoinput');
            if (videos.length > 1) {
                cameraSelect.innerHTML = videos.map(d => `<option value="${d.deviceId}">${d.label || 'Cámara'}</option>`).join('');
                cameraSelect.style.display = 'inline-flex';
            } else {
                cameraSelect.style.display = 'none';
            }
        } catch (_) {}
        
        // Esperar a que el video esté listo
        video.addEventListener('loadedmetadata', () => {
            video.play().then(() => {
                showToast('Cámara iniciada correctamente', 'success');
                // Iniciar escaneo
                scanQRCode(video, canvas);
            }).catch(err => {
                console.error('Error playing video:', err);
                showCustomAlert('Error de Cámara', 'No se pudo reproducir el video de la cámara.', 'error');
            });
        });
        
        // Manejar errores del video
        video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            showCustomAlert('Error de Cámara', 'Error al cargar el video de la cámara.', 'error');
        });
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        
        let errorMessage = 'No se pudo acceder a la cámara. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Por favor, permite el acceso a la cámara en la configuración de tu navegador.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No se encontró ninguna cámara en tu dispositivo.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Tu navegador no soporta acceso a la cámara.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage += 'La configuración de la cámara no es compatible con tu dispositivo.';
        } else {
            errorMessage += 'Error: ' + error.message;
        }
        
        showCustomAlert('Error de Cámara', errorMessage, 'error');
    }
}

// Detener escáner
function stopScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        currentTrack = null;
    }
    scanning = false;
    document.getElementById('scanner-container').style.display = 'none';
}

// Escanear código QR
function scanQRCode(video, canvas) {
    if (!scanning) return;
    
    const ctx = canvas.getContext('2d');
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Optimizar tamaño del canvas para mejor rendimiento
        const scale = Math.min(640 / video.videoWidth, 480 / video.videoHeight);
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        
        // Dibujar video en canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Obtener datos de imagen
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Intentar detectar código QR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });
        
        if (code) {
            const rawData = String(code.data || '').trim();
            console.log('✅ QR detectado:', rawData);
            stopScanner();

            // Mostrar notificación de éxito
            if (typeof showToast === 'function') {
                showToast('Código QR detectado', 'success');
            }

            // Usar la función mejorada extractStudentId para extraer el ID
            const alumnoId = extractStudentId(rawData);
            if (alumnoId) {
                console.log('🔍 ID extraído del QR:', alumnoId);
                // Verificar el alumno en la misma página en lugar de redirigir
                verificarAlumno(alumnoId);
                return;
            }

            // Si no se pudo extraer el ID, mostrar error
            showCustomAlert('Código QR desconocido', 'El QR escaneado no pertenece al sistema o no se pudo extraer el ID del alumno.', 'warning');
            return;
        }
    }
    
    // Continuar escaneando
    requestAnimationFrame(() => scanQRCode(video, canvas));
}

// Construir URL de alumno estable en el mismo host
function buildStudentUrl(alumnoId) {
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
    
    // Siempre usar formato usuario.html?id= para Cloudflare Pages (más confiable)
    return `${baseUrl}/usuario.html?id=${encodeURIComponent(alumnoId)}`;
}

// Alternar linterna si está disponible
async function toggleTorch() {
    try {
        if (!currentTrack || typeof currentTrack.applyConstraints !== 'function') return;
        const caps = currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};
        if (!caps.torch) return;
        const settings = currentTrack.getSettings ? currentTrack.getSettings() : {};
        const enable = !settings.torch;
        await currentTrack.applyConstraints({ advanced: [{ torch: enable }] });
    } catch (e) {
        console.warn('Torch no disponible:', e);
    }
}

// Cambiar de cámara
async function switchCamera(deviceId) {
    try {
        currentDeviceId = deviceId;
        stopScanner();
        await startScanner();
    } catch (e) {
        console.error('No se pudo cambiar de cámara', e);
    }
}

// Decodificar QR desde imagen
function decodeFromImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        console.warn('⚠️ No se seleccionó ningún archivo');
        return;
    }
    
    console.log('📷 Procesando imagen subida:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
    
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = function(e) {
        img.onload = function() {
            console.log('🖼️ Imagen cargada:', img.width, 'x', img.height);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            try {
                console.log('🔍 Escaneando QR en la imagen...');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { 
                    inversionAttempts: 'dontInvert' 
                });
                
                if (code && code.data) {
                    console.log('✅ QR detectado:', code.data.substring(0, 50) + '...');
                    showToast('Código QR detectado desde imagen', 'success');
                    verificarAlumno(code.data);
                } else {
                    console.warn('⚠️ No se detectó QR en la imagen');
                    showCustomAlert('QR no detectado', 'No se pudo detectar un código QR en la imagen seleccionada. Asegúrate de que la imagen contenga un código QR válido.', 'warning');
                }
            } catch (err) {
                console.error('❌ Error al procesar imagen:', err);
                showCustomAlert('Error', 'Ocurrió un error al procesar la imagen: ' + err.message, 'error');
            }
        };
        
        img.onerror = function() {
            console.error('❌ Error al cargar la imagen');
            showCustomAlert('Error', 'No se pudo cargar la imagen. Verifica que sea un formato válido (JPG, PNG, etc.)', 'error');
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        console.error('❌ Error al leer el archivo');
        showCustomAlert('Error', 'No se pudo leer el archivo seleccionado.', 'error');
    };
    
    reader.readAsDataURL(file);
}

// Verificar manual
function verificarManual() {
    const id = document.getElementById('manualId').value.trim();
    if (!id) {
        showCustomAlert('ID requerido', 'Por favor ingresa un ID de alumno o escanea un código QR', 'warning');
        return;
    }
    
    // Extraer el ID limpio antes de verificar
    const cleanId = extractStudentId(id);
    if (!cleanId) {
        showCustomAlert('ID inválido', 'El ID proporcionado no es válido. Asegúrate de ingresar un ID correcto o escanear un código QR válido.', 'error');
        return;
    }
    
    // Si el ID extraído es diferente al ingresado, actualizar el campo
    if (cleanId !== id) {
        document.getElementById('manualId').value = cleanId;
    }
    
    verificarAlumno(cleanId);
}

// Limpiar y extraer ID de una URL o string (mejorada para manejar todos los casos)
function extractStudentId(input) {
    if (!input) return null;
    
    console.log('🔍 Extrayendo ID de:', input);
    
    // Intentar parsear como JSON (para QRs mejorados)
    try {
        const qrData = JSON.parse(input);
        if (qrData.id) {
            console.log('✅ QR estructurado detectado, ID:', qrData.id);
            return qrData.id;
        }
        if (qrData.url) {
            // Si el JSON tiene una URL, extraer el ID de esa URL
            return extractStudentId(qrData.url);
        }
    } catch (e) {
        // No es JSON, continuar con otros métodos
    }
    
    // Si es una URL completa, intentar parsearla primero
    if (input.startsWith('http') || input.includes('://')) {
        try {
            const url = new URL(input);
            // Buscar el parámetro 'id' en la query string
            const idParam = url.searchParams.get('id');
            if (idParam) {
                const extractedId = decodeURIComponent(idParam).trim();
                console.log('✅ ID extraído de parámetro URL:', extractedId);
                return extractedId;
            }
            
            // Intentar desde pathname (/alumno/ID o /usuario.html?id=...)
            const pathMatch = url.pathname.match(/\/alumno\/([^\/]+)/);
            if (pathMatch && pathMatch[1]) {
                const extractedId = decodeURIComponent(pathMatch[1]);
                console.log('✅ ID extraído de pathname:', extractedId);
                return extractedId;
            }
        } catch (e) {
            // Si no es una URL válida, continuar con métodos de string
            console.warn('⚠️ Error al parsear URL:', e);
        }
    }
    
    // Buscar patrones comunes en strings (incluso si no es una URL completa)
    // Buscar usuario.html?id= o verificar/usuario.html?id=
    if (input.includes('usuario.html?id=') || input.includes('verificar/usuario.html?id=')) {
        const match = input.match(/[?&]id=([^&]+)/);
        if (match && match[1]) {
            const extractedId = decodeURIComponent(match[1]).trim();
            console.log('✅ ID extraído de URL con usuario.html:', extractedId);
            return extractedId;
        }
    }
    
    // Si es una URL con /alumno/
    if (input.includes('/alumno/')) {
        const match = input.match(/\/alumno\/([^\/\?&]+)/);
        if (match && match[1]) {
            const extractedId = decodeURIComponent(match[1]).trim();
            console.log('✅ ID extraído de ruta bonita:', extractedId);
            return extractedId;
        }
    }
    
    // Si no es una URL, devolver tal cual (limpio) - puede ser un ID directo
    const cleanId = input.trim();
    // Si el ID limpio parece una URL completa pero no se pudo parsear, intentar extraer el último segmento
    if (cleanId.includes('/') && cleanId.length > 50) {
        // Podría ser una URL mal formada, intentar extraer el último segmento
        const segments = cleanId.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.length > 8) {
            // Si el último segmento parece un UUID o ID largo, usarlo
            const possibleId = lastSegment.split('?')[0].split('&')[0];
            if (possibleId.length > 8) {
                console.log('✅ ID extraído del último segmento:', possibleId);
                return possibleId;
            }
        }
    }
    
    console.log('✅ ID usado directamente (limpio):', cleanId);
    return cleanId;
}

// Verificar alumno
// ============================================================
// FUNCIÓN PRINCIPAL DE VERIFICACIÓN - SIN FALLBACKS
// ============================================================
// REGLA: El acceso SOLO puede depender del backend.
// NO hay fallback a localStorage para decisiones de acceso.
// ============================================================
async function verificarAlumno(id) {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 [VERIFICAR] verificarAlumno() INICIADO');
    console.log('   Input recibido:', id);
    console.log('═══════════════════════════════════════════════════');
    
    // PASO 1: Extraer ID del input
    const alumnoId = extractStudentId(id);
    console.log('🔍 [VERIFICAR PASO 1] ID extraído:', alumnoId);
    
    if (!alumnoId) {
        console.error('❌ [VERIFICAR PASO 1] No se pudo extraer ID del input');
        showCustomAlert('ID inválido', 'No se pudo extraer un ID válido del código QR. Por favor intenta nuevamente.', 'error');
        return;
    }
    
    // PASO 2: Verificar configuración de MongoDB API
    console.log('🔍 [VERIFICAR PASO 2] Verificando configuración de MongoDB API...');
    if (!window.MONGO || !MONGO.isConfigured()) {
        const apiUrl = window.MONGO ? MONGO.getApiUrl() : 'NO CONFIGURADO';
        console.error('❌ [VERIFICAR PASO 2] MongoDB API NO CONFIGURADA');
        console.error('   API URL:', apiUrl);
        
        // ERROR EXPLÍCITO: No hay fallback
        showCustomAlert(
            'Error de configuración del sistema',
            'El sistema de validación no está configurado correctamente.\n\n' +
            'Por favor contacta al administrador para configurar la URL de MongoDB API.\n\n' +
            'Sin esta configuración, no es posible validar suscripciones.',
            'error'
        );
        return;
    }
    
    const apiUrl = MONGO.getApiUrl();
    console.log('✅ [VERIFICAR PASO 2] MongoDB API configurada:', apiUrl);
    
    // PASO 3: Llamar al endpoint de validación
    console.log('📡 [VERIFICAR PASO 3] Llamando a endpoint de validación...');
    console.log('   Endpoint:', `${apiUrl}/alumnos/${alumnoId}/validar`);
    console.log('   ID a validar:', alumnoId);
    
    try {
        // ✅ Usar MongoDB para validar
        if (!window.MONGO || !MONGO.isConfigured()) {
            throw new Error('MongoDB no está configurado. Por favor configúralo en el panel de administración.');
        }
        
        const inicioRequest = Date.now();
        const resultado = await MONGO.validarSuscripcion(alumnoId);
        const tiempoRequest = Date.now() - inicioRequest;
        
        console.log('✅ [VERIFICAR PASO 3] Respuesta recibida del backend');
        console.log('   Tiempo de respuesta:', tiempoRequest + 'ms');
        console.log('   Respuesta completa:', resultado);
        
        // PASO 4: Validar estructura de respuesta
        console.log('🔍 [VERIFICAR PASO 4] Validando estructura de respuesta...');
        if (!resultado || typeof resultado.acceso !== 'boolean') {
            console.error('❌ [VERIFICAR PASO 4] Respuesta inválida del servidor');
            console.error('   Respuesta recibida:', resultado);
            throw new Error('Respuesta inválida del servidor: falta campo "acceso"');
        }
        
        console.log('✅ [VERIFICAR PASO 4] Respuesta válida');
        console.log('   Acceso:', resultado.acceso);
        console.log('   Estado:', resultado.estado);
        console.log('   Días restantes:', resultado.diasRestantes);
        
        // PASO 5: Convertir respuesta al formato esperado por mostrarResultado
        console.log('🎨 [VERIFICAR PASO 5] Procesando resultado y renderizando...');
        const estado = {
            acceso: resultado.acceso,
            estado: resultado.estado,
            diasRestantes: resultado.diasRestantes,
            proximoPago: resultado.proximoPago,
            mensaje: resultado.mensaje,
            // Para compatibilidad con UI existente
            clase: resultado.acceso ? 'al-dia' : 'atrasado',
            texto: resultado.mensaje,
            proximo: resultado.proximoPago ? new Date(resultado.proximoPago).toLocaleDateString('es-ES') : '---'
        };
        
        mostrarResultado(resultado.alumno, estado);
        console.log('✅ [VERIFICAR PASO 5] Resultado renderizado correctamente');
        console.log('═══════════════════════════════════════════════════');
        console.log('✅ VERIFICACIÓN COMPLETADA EXITOSAMENTE');
        console.log('═══════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('═══════════════════════════════════════════════════');
        console.error('❌ ERROR EN VERIFICACIÓN');
        console.error('═══════════════════════════════════════════════════');
        console.error('   Tipo de error:', error.name);
        console.error('   Mensaje:', error.message);
        console.error('   Stack:', error.stack);
        
        // PASO 6: Manejar errores de forma explícita
        console.log('🔍 [VERIFICAR PASO 6] Manejando error...');
        
        let mensajeError = 'Error al validar la suscripción';
        let tituloError = 'Error de validación';
        
        if (error.message.includes('404') || error.message.includes('no encontrado')) {
            tituloError = 'Alumno no encontrado';
            mensajeError = `No se encontró un alumno con el ID: ${alumnoId}\n\n` +
                           'Verifica que el ID sea correcto.';
        } else if (error.message.includes('400') || error.message.includes('requerido')) {
            tituloError = 'Datos incompletos';
            mensajeError = 'El alumno no tiene todos los datos necesarios para validar la suscripción.\n\n' +
                           'Contacta al administrador.';
        } else if (error.message.includes('500') || error.message.includes('Error interno')) {
            tituloError = 'Error del servidor';
            mensajeError = 'El servidor encontró un error al procesar la solicitud.\n\n' +
                           'Por favor intenta nuevamente más tarde.';
        } else if (error.message.includes('Failed to fetch') || 
                  error.message.includes('NetworkError') ||
                  error.message.includes('Network request failed')) {
            tituloError = 'Error de conexión';
            mensajeError = 'No se pudo conectar con el servidor de validación.\n\n' +
                           'Verifica:\n' +
                           '1. Tu conexión a internet\n' +
                           '2. Que el backend esté disponible\n' +
                           '3. Que la URL de MongoDB API esté configurada correctamente';
        } else {
            tituloError = 'Error desconocido';
            mensajeError = `Error: ${error.message || 'Error desconocido'}\n\n` +
                           'Por favor contacta al administrador.';
        }
        
        console.error('   Título del error:', tituloError);
        console.error('   Mensaje del error:', mensajeError);
        
        // Mostrar error de forma explícita
        showCustomAlert(tituloError, mensajeError, 'error');
        
        console.error('═══════════════════════════════════════════════════');
        console.error('❌ VERIFICACIÓN FALLIDA - ERROR MOSTRADO AL USUARIO');
        console.error('═══════════════════════════════════════════════════');
    }
}

// ============================================================
// FUNCIÓN: Mostrar resultado de validación
// ============================================================
// REGLA: SIEMPRE mostrar algo (éxito o error explícito)
// NO estados vacíos, NO silencios
// ============================================================
function mostrarResultado(alumno, estado) {
    console.log('🎨 [mostrarResultado] INICIANDO renderizado');
    console.log('   Alumno:', alumno?.nombre);
    console.log('   Estado recibido:', estado);
    
    const resultado = document.getElementById('resultadoVerificacion');
    
    // Verificar que el elemento existe
    if (!resultado) {
        console.error('❌ [mostrarResultado] No se encontró el elemento resultadoVerificacion');
        showCustomAlert('Error', 'No se pudo mostrar el resultado. El elemento no existe en la página.', 'error');
        return;
    }
    
    const header = document.getElementById('resultadoHeader');
    if (!header) {
        console.error('❌ [mostrarResultado] No se encontró el elemento resultadoHeader');
        return;
    }
    
    console.log('✅ [mostrarResultado] Elementos del DOM encontrados');
    
    // Configurar header con color según estado
    header.className = `resultado-header ${estado.clase}`;
    
    // Icono según estado - basado en respuesta binaria del backend
    let icono = '';
    let mensajeEstado = '';
    
    if (estado.acceso === true) {
        // Suscripción ACTIVA
            icono = '✅';
        if (estado.diasRestantes <= 5) {
            mensajeEstado = `Próximo a vencer (${estado.diasRestantes} días)`;
        } else {
            mensajeEstado = `Al día con los pagos (${estado.diasRestantes} días restantes)`;
        }
    } else {
        // Suscripción VENCIDA
            icono = '❌';
            mensajeEstado = `Atrasado (${Math.abs(estado.diasRestantes)} días)`;
    }
    
    document.getElementById('statusIcon').textContent = icono;
    document.getElementById('alumnoNombre').textContent = alumno.nombre;
    document.getElementById('estadoPago').textContent = mensajeEstado;
    
    // Información personal
    document.getElementById('alumnoId').textContent = alumno.id;
    document.getElementById('alumnoEmail').textContent = alumno.email || 'No especificado';
    document.getElementById('alumnoTelefono').textContent = alumno.telefono || 'No especificado';
    
    // Estado de pago - con validación
    try {
        const ultimoPagoEl = document.getElementById('ultimoPago');
        const proximoPagoEl = document.getElementById('proximoPago');
        const montoMensualEl = document.getElementById('montoMensual');
        
        if (ultimoPagoEl) {
            ultimoPagoEl.textContent = formatDate(alumno.fechaPago);
        }
        if (proximoPagoEl && estado.proximoPago) {
            proximoPagoEl.textContent = formatDate(estado.proximoPago);
        }
        if (montoMensualEl) {
            montoMensualEl.textContent = '$' + parseFloat(alumno.monto || 0).toFixed(2);
        }
    } catch (e) {
        console.error('Error al actualizar estado de pago:', e);
    }
    
    // Generar y mostrar QR
    generarQRResultado(alumno);
    
    // Mostrar días restantes o atrasados con mejor formato
    if (estado.diasRestantes < 0) {
        document.getElementById('diasRestantesRow').style.display = 'none';
        document.getElementById('diasAtrasadosRow').style.display = 'flex';
        document.getElementById('diasAtrasados').textContent = `${Math.abs(estado.diasRestantes)} días atrasado`;
        document.getElementById('diasAtrasados').style.color = '#dc2626';
        document.getElementById('diasAtrasados').style.fontWeight = 'bold';
    } else {
        document.getElementById('diasRestantesRow').style.display = 'flex';
        document.getElementById('diasAtrasadosRow').style.display = 'none';
        
        const diasRestantesElement = document.getElementById('diasRestantes');
        diasRestantesElement.textContent = `${estado.diasRestantes} días restantes`;
        
        // Cambiar color según días restantes
        if (estado.diasRestantes <= 5) {
            diasRestantesElement.style.color = '#f59e0b';
            diasRestantesElement.style.fontWeight = 'bold';
        } else {
            diasRestantesElement.style.color = '#10b981';
            diasRestantesElement.style.fontWeight = 'normal';
        }
    }
    
    // Guardar ID actual para registrar pago
    resultado.dataset.alumnoId = alumno.id;
    
    // MOSTRAR ALERTA DE EMERGENCIA si está atrasado
    if (estado.clase === 'atrasado') {
        mostrarAlertaEmergencia(alumno, estado);
    }
    
    // FORZAR VISIBILIDAD DEL RESULTADO - NO HAY EXCEPCIONES
    console.log('🎨 [mostrarResultado] Forzando visibilidad del resultado...');
    resultado.style.display = 'block';
    resultado.style.visibility = 'visible';
    resultado.style.opacity = '1';
    resultado.style.height = 'auto';
    resultado.style.overflow = 'visible';
    console.log('✅ [mostrarResultado] Estilos de visibilidad aplicados');
    console.log('   display:', resultado.style.display);
    console.log('   visibility:', resultado.style.visibility);
    console.log('   opacity:', resultado.style.opacity);
    
    // Forzar que todos los elementos hijos también sean visibles
    const resultadoCard = resultado.querySelector('.resultado-card');
    if (resultadoCard) {
        resultadoCard.style.display = 'block';
        resultadoCard.style.visibility = 'visible';
        resultadoCard.style.opacity = '1';
        console.log('✅ [mostrarResultado] Card hijo también forzado a visible');
    }
    
    // Scroll suave al resultado después de un breve delay
    setTimeout(() => {
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('✅ [mostrarResultado] Scroll al resultado ejecutado');
    }, 200);
    
    console.log('✅ [mostrarResultado] Renderizado completado exitosamente');
    console.log('   Alumno:', alumno.nombre);
    console.log('   Acceso:', estado.acceso);
    console.log('   Estado:', estado.estado);
    console.log('   Días restantes:', estado.diasRestantes);
    console.log('✅ Elemento resultado display:', resultado.style.display);
    console.log('✅ Elemento resultado visible:', window.getComputedStyle(resultado).display);
    
    // Hacer scroll suave hacia el resultado
    setTimeout(() => {
        try {
            resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
            // Fallback si scrollIntoView falla
            window.scrollTo({
                top: resultado.offsetTop - 20,
                behavior: 'smooth'
            });
        }
    }, 200);
    
    // Mostrar toast de confirmación
    setTimeout(() => {
        if (typeof showToast === 'function') {
            showToast(`✅ Estado verificado: ${alumno.nombre}`, 'success');
        } else if (typeof showCustomAlert === 'function') {
            showCustomAlert('Alumno encontrado', `Estado verificado: ${alumno.nombre}`, 'success');
        } else {
            alert(`✅ Estado verificado: ${alumno.nombre}`);
        }
    }, 300);
    
    console.log('✅ Resultado mostrado completamente para:', alumno.nombre);
}

// Generar QR en el resultado
function generarQRResultado(alumno) {
    const qrContainer = document.getElementById('qrDisplay');
    if (!qrContainer) {
        console.warn('⚠️ No se encontró el contenedor de QR');
        return;
    }
    
    qrContainer.innerHTML = '';
    
    // Verificar que QRCode esté disponible
    if (typeof QRCode === 'undefined') {
        console.error('❌ QRCode no está disponible. Verifica que la librería esté cargada.');
        qrContainer.innerHTML = '<p style="color: #dc2626; padding: 1rem;">⚠️ Error: Librería QRCode no cargada</p>';
        return;
    }
    
    // Crear URL directa para el alumno usando base configurada
    const studentUrl = buildStudentUrl(alumno.id);
    
    try {
    // Generar QR con URL directa
    new QRCode(qrContainer, {
            text: studentUrl,
        width: 120,
        height: 120,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        margin: 1
    });
    
    // Actualizar ID en la sección QR
        const qrIdEl = document.getElementById('qrId');
        if (qrIdEl) {
            qrIdEl.textContent = alumno.id;
        }
        
        console.log('✅ QR generado correctamente para:', alumno.nombre);
    } catch (error) {
        console.error('❌ Error al generar QR:', error);
        qrContainer.innerHTML = '<p style="color: #dc2626; padding: 1rem;">⚠️ Error al generar QR: ' + error.message + '</p>';
    }
}

// Mostrar QR completo en modal
function mostrarQRCompleto() {
    const resultado = document.getElementById('resultadoVerificacion');
    const alumnoId = resultado.dataset.alumnoId;
    
    if (!alumnoId) return;
    
    const alumno = alumnos.find(a => a.id === alumnoId);
    if (!alumno) return;
    
    // Crear modal para QR completo
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            text-align: center;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        ">
            <h3 style="margin-bottom: 1rem; color: #dc2626;">🔲 Código QR Completo</h3>
            <div id="qrCompleto" style="margin: 1rem 0;"></div>
            <p style="margin: 1rem 0; color: #666;"><strong>ID:</strong> ${alumno.id}</p>
            <p style="margin: 0.5rem 0; color: #666;"><strong>Nombre:</strong> ${alumno.nombre}</p>
            <div style="margin-top: 2rem;">
                <button onclick="downloadQRCompleto()" style="
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    margin-right: 1rem;
                    cursor: pointer;
                ">📥 Descargar QR</button>
                <button onclick="cerrarQRModal()" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                ">Cerrar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Generar QR completo
    const qrCompleto = document.getElementById('qrCompleto');
    
    // Crear URL directa para el alumno usando base configurada
    const studentUrl = buildStudentUrl(alumno.id);
    
    const qrData = {
        id: alumno.id,
        nombre: alumno.nombre,
        fechaGeneracion: new Date().toISOString(),
        version: "1.0",
        url: studentUrl
    };
    
    new QRCode(qrCompleto, {
        text: studentUrl, // Usar la URL directa como texto del QR
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        margin: 2
    });
}

// Descargar QR
function downloadQR() {
    const canvas = document.querySelector('#qrDisplay canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'qr-alumno.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast('QR descargado exitosamente', 'success');
    }
}

// Descargar QR completo
function downloadQRCompleto() {
    const canvas = document.querySelector('#qrCompleto canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = 'qr-alumno-completo.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast('QR completo descargado', 'success');
    }
}

// Cerrar modal QR
function cerrarQRModal() {
    const modal = document.querySelector('[style*="position: fixed"][style*="z-index: 10000"]');
    if (modal) {
        modal.remove();
    }
}

// Mostrar alerta de emergencia para alumnos atrasados
function mostrarAlertaEmergencia(alumno, estado) {
    // Crear modal de emergencia
    const emergencyModal = document.createElement('div');
    emergencyModal.id = 'emergencyModal';
    emergencyModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease;
    `;
    
    emergencyModal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            padding: 3rem;
            border-radius: 1rem;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(220, 38, 38, 0.5);
            border: 3px solid #fecaca;
            animation: pulse 2s infinite;
        ">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🚨</div>
            <h2 style="color: white; margin-bottom: 1rem; font-size: 2rem;">¡ALERTA DE EMERGENCIA!</h2>
            <p style="color: white; font-size: 1.2rem; margin-bottom: 1.5rem;">
                <strong>${alumno.nombre}</strong> tiene el pago atrasado por <strong>${Math.abs(estado.diasRestantes)} días</strong>
            </p>
            <div style="background: rgba(255, 255, 255, 0.1); padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 2rem;">
                <p style="color: white; font-size: 1.1rem; margin-bottom: 0.5rem;">
                    <strong>⚠️ NO PUEDE ENTRENAR HASTA PAGAR</strong>
                </p>
                <p style="color: #fecaca; font-size: 1rem;">
                    Monto pendiente: <strong>$${parseFloat(alumno.monto).toFixed(2)}</strong>
                </p>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="registrarPagoEmergencia('${alumno.id}')" style="
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 0.5rem;
                    font-size: 1.1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                    💳 REGISTRAR PAGO AHORA
                </button>
                <button onclick="cerrarAlertaEmergencia()" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 0.5rem;
                    font-size: 1.1rem;
                    cursor: pointer;
                ">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    
    // Agregar estilos de animación
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(emergencyModal);
    
    // Sonido de alerta (opcional)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBS13yO/eizEIHWq+8+OWT');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignorar errores de audio
    } catch (e) {}
}

// Registrar pago desde emergencia
function registrarPagoEmergencia(alumnoId) {
    cerrarAlertaEmergencia();
    registrarPago();
}

// Cerrar alerta de emergencia
function cerrarAlertaEmergencia() {
    const modal = document.getElementById('emergencyModal');
    if (modal) {
        modal.remove();
    }
}

// Registrar pago
async function registrarPago() {
    const resultado = document.getElementById('resultadoVerificacion');
    const alumnoId = resultado.dataset.alumnoId;
    
    if (!alumnoId) return;
    
    const alumno = alumnos.find(a => a.id === alumnoId);
    if (!alumno) return;
    
    if (confirm(`¿Confirmar pago de ${alumno.nombre} por $${alumno.monto}?`)) {
        try {
            // ✅ Registrar pago SOLO en MongoDB
            if (!window.MONGO || !MONGO.isConfigured()) {
                throw new Error('MongoDB no está configurado');
            }
            
            const fechaPago = new Date().toISOString().split('T')[0];
            await MONGO.registrarPago(alumnoId, fechaPago);
            
            console.log('✅ Pago registrado en MongoDB');
            alert('¡Pago registrado exitosamente!');
            
            // Actualizar vista desde MongoDB
            await verificarAlumno(alumnoId);
            await loadTodosAlumnos();
            
        } catch (error) {
            console.error('❌ Error al registrar pago:', error);
            alert(`Error al registrar pago: ${error.message}`);
        }
    }
}

// Cerrar resultado
function cerrarResultado() {
    document.getElementById('resultadoVerificacion').style.display = 'none';
    document.getElementById('manualId').value = '';
}

// Cargar todos los alumnos (vista rápida)
async function loadTodosAlumnos() {
    const container = document.getElementById('todosAlumnos');
    
    if (!container) {
        return;
    }
    
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">⏳ Cargando alumnos...</div>';
    
    try {
        // ✅ Cargar SOLO desde MongoDB
        if (!window.MONGO || !MONGO.isConfigured()) {
            throw new Error('MongoDB no está configurado. Por favor configúralo en el panel de administración.');
        }
        
        const response = await MONGO.listAlumnos();
        
        if (!Array.isArray(response)) {
            throw new Error('Respuesta inválida del servidor');
        }
        
        alumnos = response;
        console.log('✅ Alumnos cargados desde MongoDB:', alumnos.length);
        
    } catch (error) {
        console.error('❌ Error al cargar alumnos:', error);
        container.innerHTML = `
            <div class="empty-state error-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">❌</div>
                <h3>Error al cargar datos</h3>
                <p>${error.message || 'No se pudo conectar con la base de datos'}</p>
                <button onclick="loadTodosAlumnos()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                    🔄 Reintentar
                </button>
            </div>
        `;
        return;
    }
    
    if (alumnos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">📚</div>
                <h3>No hay alumnos registrados</h3>
                <p>Ve a Gestión de Alumnos para agregar alumnos</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    alumnos.forEach(alumno => {
        // NOTA: La vista rápida NO calcula estado localmente
        // El estado se obtiene cuando se hace clic y se llama a verificarAlumno()
        // Por ahora, mostramos solo información básica sin estado calculado
        
        const card = document.createElement('div');
        card.className = `mini-card estado-pending`; // Estado pendiente hasta validar
        card.onclick = () => verificarAlumno(alumno.id);
        card.style.cursor = 'pointer';
        
        // Vista rápida: Solo información básica, SIN calcular estado
        // El estado se obtiene del backend cuando se hace clic
        card.innerHTML = `
            <div class="mini-card-header">
                <span class="mini-status-icon">🔍</span>
                <span class="mini-card-name">${alumno.nombre}</span>
            </div>
            <div class="mini-card-info">
                <div>Clic para validar</div>
                <div>ID: ${alumno.id.substring(0, 8)}...</div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    if (container.children.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">🔍</div>
                <h3>No hay alumnos en esta categoría</h3>
            </div>
        `;
    }
}

// Filtrar por estado (deshabilitado - la vista rápida no calcula estados)
// NOTA: Los filtros están deshabilitados porque la vista rápida
// no calcula estados localmente. Todos los alumnos se muestran
// y el estado se obtiene del backend al hacer clic.
function filterStatus(status) {
    console.log('⚠️ [filterStatus] Filtros deshabilitados - la vista rápida no calcula estados');
    // Los filtros están deshabilitados porque no calculamos estados localmente
    // Todos los alumnos se muestran y el estado se obtiene del backend al hacer clic
    currentFilter = 'all'; // Forzar a 'all' siempre
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
    event.target.classList.add('active');
    }
    
    // Recargar lista (sin filtros)
    loadTodosAlumnos();
}

// Helpers para interpretar datos QR	
function extractAlumnoId(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();

    // Caso: JSON con { id }
    try {
        const json = JSON.parse(trimmed);
        if (json && typeof json === 'object') {
            if (json.id) return String(json.id);
            if (json.url) return extractAlumnoId(json.url);
        }
    } catch (_) {}

    // Caso: URL directa (bonita o con query)
    if (/^https?:/i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            const queryId = url.searchParams.get('id');
            if (queryId) return queryId;
            const pathMatch = url.pathname.match(/\/alumno\/([^\/]+)/i);
            if (pathMatch && pathMatch[1]) return decodeURIComponent(pathMatch[1]);
        } catch (_) {}
    }

    // Caso: ID plano
    if (/^[0-9a-fA-F-]{8,}$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

function extractAlumnoUrl(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();

    if (/^https?:/i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            const id = extractAlumnoId(trimmed);
            if (id) {
                return buildStudentUrl(id);
            }
            return trimmed;
        } catch (_) {}
    }

    return null;
}




