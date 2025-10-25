#!/bin/bash

# Script PM2 para COHAB - Ejecutar 24/7
echo "🔄 Configurando COHAB para ejecución 24/7..."

# Crear archivo de configuración PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'cohab-server',
    script: 'python3',
    args: '-m http.server 8000 --bind 0.0.0.0',
    cwd: '/path/to/your/project',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

echo "📝 Archivo ecosystem.config.js creado"
echo ""
echo "🔧 Para usar:"
echo "   1. Edita ecosystem.config.js y cambia 'cwd' por tu ruta del proyecto"
echo "   2. Ejecuta: pm2 start ecosystem.config.js"
echo "   3. Para ver logs: pm2 logs cohab-server"
echo "   4. Para detener: pm2 stop cohab-server"
echo "   5. Para reiniciar: pm2 restart cohab-server"
echo ""
echo "📊 Comandos útiles:"
echo "   pm2 status          - Ver estado"
echo "   pm2 monit           - Monitor en tiempo real"
echo "   pm2 save            - Guardar configuración"
echo "   pm2 startup         - Iniciar automáticamente al boot"
