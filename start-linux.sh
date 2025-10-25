#!/bin/bash

# Script de inicio para COHAB en Linux
echo "🚀 Iniciando Sistema COHAB en Linux..."

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado. Instalando..."
    sudo apt update
    sudo apt install -y python3 python3-pip
fi

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 no está instalado. Instalando..."
    sudo npm install -g pm2
fi

# Obtener IP local
IP=$(hostname -I | awk '{print $1}')

echo "📡 Servidor iniciado en:"
echo "   Local: http://localhost:8000"
echo "   Red: http://$IP:8000"
echo ""
echo "📱 Para acceder desde móvil:"
echo "   http://$IP:8000"
echo ""
echo "🛑 Para detener: Ctrl+C"
echo ""

# Iniciar servidor
python3 -m http.server 8000 --bind 0.0.0.0
