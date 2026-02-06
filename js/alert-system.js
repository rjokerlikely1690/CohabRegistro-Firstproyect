// SISTEMA DE ALERTAS PERSONALIZADO - DISEÑO MODERNO

// Crear el contenedor de alertas si no existe
function createAlertContainer() {
    if (!document.getElementById('alertContainer')) {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        document.body.appendChild(container);
    }
}

// Función para mostrar alerta personalizada
function showCustomAlert(title, message, type = 'info') {
    createAlertContainer();
    
    const container = document.getElementById('alertContainer');
    
    // Remover alertas existentes
    const existingAlerts = container.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = 'custom-alert';
    alert.style.display = 'block';
    
    // Configurar icono y color según el tipo
    let icon = '';
    let iconBg = '';
    
    switch(type) {
        case 'error':
            icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
            iconBg = 'rgba(239, 68, 68, 0.15)';
            break;
        case 'success':
            icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
            iconBg = 'rgba(16, 185, 129, 0.15)';
            break;
        case 'warning':
            icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            iconBg = 'rgba(245, 158, 11, 0.15)';
            break;
        default:
            icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
            iconBg = 'rgba(59, 130, 246, 0.15)';
    }
    
    alert.innerHTML = `
        <div class="modern-alert-content">
            <div class="modern-alert-icon" style="background: ${iconBg}">
                ${icon}
            </div>
            <h3 class="modern-alert-title">${title}</h3>
            <p class="modern-alert-message">${message}</p>
            <button class="modern-alert-btn primary" onclick="closeCustomAlert()">Entendido</button>
        </div>
    `;
    
    container.appendChild(alert);
    
    // Cerrar automáticamente después de 5 segundos para mensajes informativos
    if (type === 'info' || type === 'success') {
        setTimeout(() => {
            closeCustomAlert();
        }, 5000);
    }
    
    // Cerrar al hacer clic fuera del modal
    alert.addEventListener('click', function(e) {
        if (e.target === alert) {
            closeCustomAlert();
        }
    });
}

// Función para cerrar alerta personalizada
function closeCustomAlert() {
    const alerts = document.querySelectorAll('.custom-alert');
    alerts.forEach(alert => {
        alert.style.animation = 'alertFadeOut 0.2s ease-out forwards';
        setTimeout(() => {
            alert.remove();
        }, 200);
    });
}

// Función para mostrar toast
function showToast(message, type = 'success') {
    const existing = document.querySelector('.modern-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `modern-toast ${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>';
            break;
        case 'error':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
            break;
        default:
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);
    
    // Animar entrada
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Función para confirmación personalizada
function showCustomConfirm(title, message, onConfirm, onCancel = null) {
    createAlertContainer();
    
    const container = document.getElementById('alertContainer');
    
    // Remover alertas existentes
    const existingAlerts = container.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = 'custom-alert';
    alert.style.display = 'block';
    
    alert.innerHTML = `
        <div class="modern-alert-content">
            <div class="modern-alert-icon" style="background: rgba(16, 185, 129, 0.15)">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
            </div>
            <h3 class="modern-alert-title">${title}</h3>
            <p class="modern-alert-message">${message}</p>
            <div class="modern-alert-actions">
                <button class="modern-alert-btn secondary" onclick="handleConfirm(false)">Cancelar</button>
                <button class="modern-alert-btn confirm" onclick="handleConfirm(true)">Confirmar</button>
            </div>
        </div>
    `;
    
    container.appendChild(alert);
    
    // Función para manejar confirmación
    window.handleConfirm = function(confirmed) {
        closeCustomAlert();
        if (confirmed && onConfirm) {
            onConfirm();
        } else if (!confirmed && onCancel) {
            onCancel();
        }
    };
    
    // Cerrar al hacer clic fuera del modal
    alert.addEventListener('click', function(e) {
        if (e.target === alert) {
            closeCustomAlert();
            if (onCancel) onCancel();
        }
    });
}

// Reemplazar alert() nativo
window.alert = function(message) {
    showCustomAlert('Información', message, 'info');
};

// Reemplazar confirm() nativo
window.confirm = function(message) {
    return new Promise((resolve) => {
        showCustomConfirm('Confirmar acción', message, () => resolve(true), () => resolve(false));
    });
};

// Agregar estilos CSS modernos
const alertStyles = document.createElement('style');
alertStyles.textContent = `
    /* Overlay */
    .custom-alert {
        display: none;
        position: fixed;
        z-index: 10000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        animation: alertFadeIn 0.2s ease-out;
    }
    
    @keyframes alertFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes alertFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes alertSlideIn {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }
    
    /* Alert Content */
    .modern-alert-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(145deg, #1f1f1f 0%, #141414 100%);
        border-radius: 1.25rem;
        padding: 2rem;
        width: 90%;
        max-width: 380px;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: alertSlideIn 0.25s ease-out;
    }
    
    /* Icon */
    .modern-alert-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.25rem;
    }
    
    /* Title */
    .modern-alert-title {
        color: #fff;
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 0.75rem 0;
    }
    
    /* Message */
    .modern-alert-message {
        color: #a1a1aa;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0 0 1.5rem 0;
    }
    
    /* Actions container */
    .modern-alert-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
    }
    
    /* Buttons */
    .modern-alert-btn {
        padding: 0.75rem 1.5rem;
        border-radius: 0.625rem;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        min-width: 110px;
    }
    
    .modern-alert-btn.primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: #fff;
    }
    
    .modern-alert-btn.primary:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    
    .modern-alert-btn.confirm {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
    }
    
    .modern-alert-btn.confirm:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    
    .modern-alert-btn.secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #d1d5db;
        border: 1px solid rgba(255, 255, 255, 0.15);
    }
    
    .modern-alert-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);
    }
    
    .modern-alert-btn:active {
        transform: translateY(0);
    }
    
    /* Toast notifications */
    .modern-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-radius: 0.75rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: #fff;
        z-index: 10001;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    
    .modern-toast.show {
        transform: translateX(0);
    }
    
    .modern-toast.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    
    .modern-toast.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    
    .modern-toast.info {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }
    
    /* Responsive */
    @media (max-width: 480px) {
        .modern-alert-content {
            padding: 1.5rem;
            width: 95%;
        }
        
        .modern-alert-actions {
            flex-direction: column-reverse;
        }
        
        .modern-alert-btn {
            width: 100%;
        }
        
        .modern-toast {
            left: 20px;
            right: 20px;
            top: auto;
            bottom: 20px;
            transform: translateY(120%);
        }
        
        .modern-toast.show {
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(alertStyles);
