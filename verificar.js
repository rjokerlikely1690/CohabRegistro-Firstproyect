// Sistema de verificación de estado de pagos

let alumnos = JSON.parse(localStorage.getItem('alumnos')) || [];
let stream = null;
let scanning = false;
let currentFilter = 'all';
let currentTrack = null;
let currentDeviceId = null;

// Cargar al iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadTodosAlumnos();
});

// Calcular estado de pago (mismo que en app.js)
function calcularEstado(alumno) {
    const hoy = new Date();
    const fechaUltimoPago = new Date(alumno.fechaPago);
    const diaPago = parseInt(alumno.diaPago);
    
    let proximoPago = new Date(fechaUltimoPago);
    proximoPago.setMonth(proximoPago.getMonth() + 1);
    proximoPago.setDate(diaPago);
    
    if (proximoPago.getDate() !== diaPago) {
        proximoPago.setDate(0);
    }
    
    const diffTime = proximoPago - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let estado = {
        tipo: '',
        clase: '',
        diasRestantes: diffDays,
        proximoPago: proximoPago
    };
    
    if (diffDays < 0) {
        estado.tipo = '🔴 Atrasado';
        estado.clase = 'atrasado';
    } else if (diffDays <= 5) {
        estado.tipo = '🟠 Próximo a vencer';
        estado.clase = 'proximo';
    } else {
        estado.tipo = '🟢 Al día';
        estado.clase = 'aldia';
    }
    
    return estado;
}

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
            // Código QR detectado
            stopScanner();
            
            // Mostrar feedback visual
            showToast('¡Código QR detectado!', 'success');
            
            // Si el QR contiene una URL válida a usuario.html, ir directo
            const data = String(code.data || '').trim();
            try {
                // Intentar JSON con url
                const parsed = JSON.parse(data);
                if (parsed && parsed.url && /^https?:\/\//i.test(parsed.url)) {
                    window.location.href = parsed.url;
                    return;
                }
            } catch (_) {}
            
            if (/^https?:\/\//i.test(data)) {
                // Es una URL directa
                window.location.href = data;
                return;
            }
            
            // Caso: es solo el ID → construir URL del alumno y redirigir
            const studentUrl = buildStudentUrl(data);
            window.location.href = studentUrl;
            return;
        }
    }
    
    // Continuar escaneando
    requestAnimationFrame(() => scanQRCode(video, canvas));
}

// Construir URL de alumno estable en el mismo host
function buildStudentUrl(alumnoId) {
    // Base del sitio actual (maneja puertos y protocolo)
    let baseUrl = window.location.origin + window.location.pathname.replace('verificar.html', '');
    // Normalizar doble barras
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    return `${baseUrl}usuario.html?id=${encodeURIComponent(alumnoId)}`;
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
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = function(e) {
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                if (code && code.data) {
                    showToast('Código QR detectado desde imagen', 'success');
                    verificarAlumno(code.data);
                } else {
                    showCustomAlert('QR no detectado', 'No se pudo detectar un código QR en la imagen seleccionada.', 'warning');
                }
            } catch (err) {
                showCustomAlert('Error', 'Ocurrió un error al procesar la imagen.', 'error');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Verificar manual
function verificarManual() {
    const id = document.getElementById('manualId').value.trim();
    if (!id) {
        alert('Por favor ingresa un ID válido');
        return;
    }
    verificarAlumno(id);
}

// Verificar alumno
function verificarAlumno(id) {
    // Recargar datos por si se actualizaron
    alumnos = JSON.parse(localStorage.getItem('alumnos')) || [];
    
    let alumnoId = id;
    
    // Intentar parsear como JSON (para QRs mejorados)
    try {
        const qrData = JSON.parse(id);
        if (qrData.id) {
            alumnoId = qrData.id;
            console.log('QR estructurado detectado:', qrData);
        }
    } catch (e) {
        // Si no es JSON válido, usar el ID directamente
        console.log('QR simple detectado:', id);
    }
    
    const alumno = alumnos.find(a => a.id === alumnoId);
    
    if (!alumno) {
        showCustomAlert('Alumno no encontrado', `No se encontró un alumno con el ID: ${alumnoId}`, 'error');
        return;
    }
    
    const estado = calcularEstado(alumno);
    mostrarResultado(alumno, estado);
}

// Mostrar resultado
function mostrarResultado(alumno, estado) {
    const resultado = document.getElementById('resultadoVerificacion');
    const header = document.getElementById('resultadoHeader');
    
    // Configurar header con color según estado
    header.className = `resultado-header ${estado.clase}`;
    
    // Icono según estado
    let icono = '';
    let mensajeEstado = '';
    switch(estado.clase) {
        case 'aldia':
            icono = '✅';
            mensajeEstado = 'Al día con los pagos';
            break;
        case 'proximo':
            icono = '⚠️';
            mensajeEstado = `Próximo a vencer (${estado.diasRestantes} días)`;
            break;
        case 'atrasado':
            icono = '❌';
            mensajeEstado = `Atrasado (${Math.abs(estado.diasRestantes)} días)`;
            break;
    }
    
    document.getElementById('statusIcon').textContent = icono;
    document.getElementById('alumnoNombre').textContent = alumno.nombre;
    document.getElementById('estadoPago').textContent = mensajeEstado;
    
    // Información personal
    document.getElementById('alumnoId').textContent = alumno.id;
    document.getElementById('alumnoEmail').textContent = alumno.email || 'No especificado';
    document.getElementById('alumnoTelefono').textContent = alumno.telefono || 'No especificado';
    
    // Estado de pago
    document.getElementById('ultimoPago').textContent = formatDate(alumno.fechaPago);
    document.getElementById('proximoPago').textContent = formatDate(estado.proximoPago);
    document.getElementById('montoMensual').textContent = '$' + parseFloat(alumno.monto).toFixed(2);
    
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
    
    resultado.style.display = 'block';
    resultado.scrollIntoView({ behavior: 'smooth' });
    
    // Mostrar toast de confirmación
    showToast(`Estado verificado: ${alumno.nombre}`, 'success');
}

// Generar QR en el resultado
function generarQRResultado(alumno) {
    const qrContainer = document.getElementById('qrDisplay');
    qrContainer.innerHTML = '';
    
    // Obtener la URL base actual
    let baseUrl = window.location.origin + window.location.pathname.replace('verificar.html', '');
    
    // Si estamos en localhost, usar la IP local para que funcione en móviles
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace('localhost:8000', '192.168.68.112:8000');
        baseUrl = baseUrl.replace('127.0.0.1:8000', '192.168.68.112:8000');
    }
    
    // Crear URL directa para el alumno
    const studentUrl = `${baseUrl}usuario.html?id=${alumno.id}`;
    
    // Crear información estructurada para el QR
    const qrData = {
        id: alumno.id,
        nombre: alumno.nombre,
        fechaGeneracion: new Date().toISOString(),
        version: "1.0",
        url: studentUrl
    };
    
    // Generar QR con URL directa
    new QRCode(qrContainer, {
        text: studentUrl, // Usar la URL directa como texto del QR
        width: 120,
        height: 120,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
        margin: 1
    });
    
    // Actualizar ID en la sección QR
    document.getElementById('qrId').textContent = alumno.id;
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
    
    // Obtener la URL base actual
    let baseUrl = window.location.origin + window.location.pathname.replace('verificar.html', '');
    
    // Si estamos en localhost, usar la IP local para que funcione en móviles
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace('localhost:8000', '192.168.68.112:8000');
        baseUrl = baseUrl.replace('127.0.0.1:8000', '192.168.68.112:8000');
    }
    
    // Crear URL directa para el alumno
    const studentUrl = `${baseUrl}usuario.html?id=${alumno.id}`;
    
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
function registrarPago() {
    const resultado = document.getElementById('resultadoVerificacion');
    const alumnoId = resultado.dataset.alumnoId;
    
    if (!alumnoId) return;
    
    const alumno = alumnos.find(a => a.id === alumnoId);
    if (!alumno) return;
    
    if (confirm(`¿Confirmar pago de ${alumno.nombre} por $${alumno.monto}?`)) {
        // Actualizar fecha de pago a hoy
        alumno.fechaPago = new Date().toISOString().split('T')[0];
        
        // Guardar en localStorage
        const index = alumnos.findIndex(a => a.id === alumnoId);
        alumnos[index] = alumno;
        localStorage.setItem('alumnos', JSON.stringify(alumnos));
        
        alert('¡Pago registrado exitosamente!');
        
        // Actualizar vista
        verificarAlumno(alumnoId);
        loadTodosAlumnos();
    }
}

// Cerrar resultado
function cerrarResultado() {
    document.getElementById('resultadoVerificacion').style.display = 'none';
    document.getElementById('manualId').value = '';
}

// Cargar todos los alumnos (vista rápida)
function loadTodosAlumnos() {
    alumnos = JSON.parse(localStorage.getItem('alumnos')) || [];
    const container = document.getElementById('todosAlumnos');
    
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
        const estado = calcularEstado(alumno);
        
        // Filtrar según el filtro activo
        if (currentFilter !== 'all' && estado.clase !== currentFilter) {
            return;
        }
        
        const card = document.createElement('div');
        card.className = `mini-card estado-${estado.clase}`;
        card.onclick = () => verificarAlumno(alumno.id);
        card.style.cursor = 'pointer';
        
        const diasText = estado.diasRestantes < 0 
            ? `${Math.abs(estado.diasRestantes)}d atrasado` 
            : `${estado.diasRestantes}d restantes`;
        
        let icono = '';
        switch(estado.clase) {
            case 'aldia':
                icono = '🟢';
                break;
            case 'proximo':
                icono = '🟠';
                break;
            case 'atrasado':
                icono = '🔴';
                break;
        }
        
        card.innerHTML = `
            <div class="mini-card-header">
                <span class="mini-status-icon">${icono}</span>
                <span class="mini-card-name">${alumno.nombre}</span>
            </div>
            <div class="mini-card-info">
                <div>${diasText}</div>
                <div>Próximo: ${formatDate(estado.proximoPago)}</div>
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

// Filtrar por estado
function filterStatus(status) {
    currentFilter = status;
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Recargar lista
    loadTodosAlumnos();
}




