// SISTEMA DE ALERTAS PERSONALIZADO PARA MÓVIL

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
    
    // Configurar colores según el tipo
    let headerBg = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    let icon = 'ℹ️';
    
    switch(type) {
        case 'error':
            headerBg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            icon = '❌';
            break;
        case 'success':
            headerBg = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            icon = '✅';
            break;
        case 'warning':
            headerBg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            icon = '⚠️';
            break;
    }
    
    alert.innerHTML = `
        <div class="custom-alert-content">
            <div class="custom-alert-header" style="background: ${headerBg}">
                ${icon} ${title}
            </div>
            <div class="custom-alert-body">
                ${message}
            </div>
            <div class="custom-alert-footer">
                <button class="custom-alert-btn" onclick="closeCustomAlert()">Entendido</button>
            </div>
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
        alert.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            alert.remove();
        }, 300);
    });
}

// Función para mostrar toast
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            toast.remove();
        }, 300);
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
        <div class="custom-alert-content">
            <div class="custom-alert-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%)">
                ⚠️ ${title}
            </div>
            <div class="custom-alert-body">
                ${message}
            </div>
            <div class="custom-alert-footer">
                <button class="custom-alert-btn" onclick="handleConfirm(false)" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); margin-right: 0.5rem;">Cancelar</button>
                <button class="custom-alert-btn" onclick="handleConfirm(true)" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">Confirmar</button>
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
        showCustomConfirm('Confirmar', message, () => resolve(true), () => resolve(false));
    });
};

// Agregar animaciones CSS para cerrar
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-50px);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

