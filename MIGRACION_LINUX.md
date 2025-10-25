# 🐧 GUÍA DE MIGRACIÓN A UBUNTU/LINUX

## 📋 Pasos para migrar tu proyecto COHAB a Linux

### 1. INSTALAR WSL2 (Recomendado)
```powershell
# En PowerShell como administrador
wsl --install -d Ubuntu
```

### 2. CONFIGURAR EL ENTORNO
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y git curl wget python3 python3-pip nodejs npm

# Instalar PM2 para procesos en background
sudo npm install -g pm2
```

### 3. CLONAR TU PROYECTO
```bash
# Clonar desde GitHub
git clone https://github.com/rjokerlikely1690/CohabRegistro-Firstproyect.git
cd CohabRegistro-Firstproyect

# O copiar archivos desde Windows
cp -r /mnt/c/Users/Usuario/OneDrive/Escritorio/registro\ cohab/* .
```

### 4. CONFIGURAR SERVIDOR
```bash
# Hacer ejecutable el script
chmod +x start-linux.sh

# Ejecutar servidor
./start-linux.sh
```

### 5. CONFIGURAR PARA 24/7
```bash
# Configurar PM2
chmod +x setup-pm2.sh
./setup-pm2.sh

# Editar ecosystem.config.js con tu ruta
nano ecosystem.config.js

# Iniciar con PM2
pm2 start ecosystem.config.js

# Configurar inicio automático
pm2 startup
pm2 save
```

## 🌐 ACCESO DESDE MÓVIL

### Obtener IP del servidor Linux:
```bash
# Ver IP local
hostname -I

# Ver IP pública (si tienes acceso externo)
curl ifconfig.me
```

### URLs de acceso:
- **Local**: http://localhost:8000
- **Red local**: http://[IP-LOCAL]:8000
- **Externa**: http://[IP-PUBLICA]:8000

## 🔧 COMANDOS ÚTILES

### Gestión del servidor:
```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs cohab-server

# Reiniciar
pm2 restart cohab-server

# Detener
pm2 stop cohab-server

# Monitor en tiempo real
pm2 monit
```

### Gestión de archivos:
```bash
# Ver archivos
ls -la

# Editar archivos
nano index.html
# o
vim index.html

# Ver contenido
cat app.js
```

## 🚨 SOLUCIÓN DE PROBLEMAS

### Puerto ocupado:
```bash
# Ver qué usa el puerto 8000
sudo netstat -tulpn | grep :8000

# Matar proceso
sudo kill -9 [PID]
```

### Permisos:
```bash
# Dar permisos de ejecución
chmod +x *.sh

# Cambiar propietario
sudo chown -R $USER:$USER .
```

### Firewall:
```bash
# Abrir puerto 8000
sudo ufw allow 8000
sudo ufw enable
```

## 📱 CONFIGURACIÓN MÓVIL

### Para acceso desde móvil:
1. Conecta móvil a la misma red WiFi
2. Usa la IP local del servidor Linux
3. Ejemplo: http://192.168.1.100:8000

### Para acceso externo:
1. Configura port forwarding en router
2. Usa IP pública del servidor
3. Considera usar servicios como ngrok para desarrollo

## 🔄 BACKUP Y SINCRONIZACIÓN

### Backup automático:
```bash
# Crear script de backup
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_cohab_$DATE.tar.gz" .
echo "Backup creado: backup_cohab_$DATE.tar.gz"
EOF

chmod +x backup.sh
```

### Sincronización con GitHub:
```bash
# Subir cambios
git add .
git commit -m "Update from Linux"
git push

# Descargar cambios
git pull
```
