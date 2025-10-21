@echo off
title Sistema COHAB - Academia de BJJ
color 0B

echo.
echo ===============================================
echo    🥋 SISTEMA COHAB - ACADEMIA DE BJJ 🥋
echo ===============================================
echo.
echo 🔍 Detectando configuración de red...

REM Obtener la IP local automáticamente
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set LOCAL_IP=%%j
        goto :found_ip
    )
)
:found_ip

echo.
echo 📱 IP Local: %LOCAL_IP%
echo 🌐 Puerto: 8000
echo.
echo 📋 URLs disponibles:
echo    💻 Computadora: http://localhost:8000
echo    📱 Móvil/Tablet: http://%LOCAL_IP%:8000
echo.
echo 🚀 Iniciando servidor web...
echo.
echo ⚠️  IMPORTANTE:
echo    • Mantén esta ventana abierta
echo    • Para móvil: conecta a la misma WiFi
echo    • El navegador se abrirá automáticamente
echo.
echo 📱 FUNCIONALIDADES:
echo    • Gestión completa de alumnos
echo    • Escáner QR desde móvil
echo    • Verificación de pagos
echo    • Panel administrativo
echo.
echo Presiona Ctrl+C para detener el servidor
echo ===============================================
echo.

REM Esperar 3 segundos antes de abrir el navegador
timeout /t 3 /nobreak >nul

REM Abrir navegador automáticamente
start http://localhost:8000

echo 🎯 Servidor iniciado correctamente!
echo 📱 Los QR funcionarán automáticamente en móviles
echo.

REM Iniciar servidor Python con acceso desde red local
python -m http.server 8000 --bind 0.0.0.0

echo.
echo 🛑 Servidor detenido
echo.
pause
