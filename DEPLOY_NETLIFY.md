# 🚀 Guía de Despliegue en Netlify

## ✅ Tu proyecto está listo para Netlify

Todos los archivos necesarios están configurados y funcionando correctamente.

## 📋 Pasos para subir a Netlify

### Opción 1: Arrastrar y Soltar (Más Rápida)

1. Ve a [https://app.netlify.com](https://app.netlify.com)
2. Inicia sesión o crea una cuenta gratuita
3. Arrastra y suelta la carpeta completa del proyecto (`registro cohab`) en el área de "Drag and drop your site output folder here"
4. ¡Listo! Netlify desplegará tu sitio automáticamente
5. Obtendrás una URL como: `https://tu-sitio.netlify.app`

### Opción 2: Desde GitHub (Recomendado)

Si tu proyecto ya está en GitHub:

1. Ve a [https://app.netlify.com](https://app.netlify.com)
2. Haz clic en "Add new site" → "Import an existing project"
3. Conecta tu cuenta de GitHub
4. Selecciona el repositorio `CohabRegistro-Firstproyect`
5. Configuración automática:
   - **Build command**: (dejar vacío, es un sitio estático)
   - **Publish directory**: `.` (punto)
6. Haz clic en "Deploy site"

## ⚙️ Configuración Automática

Tu proyecto ya incluye:

- ✅ `_redirects` - Para URLs bonitas (`/alumno/:id`)
- ✅ `netlify.toml` - Headers de seguridad y caché
- ✅ Detección automática de Netlify para URLs bonitas
- ✅ Service Worker configurado para PWA

## 🔗 URLs Bonitas Automáticas

Cuando estés en Netlify, las URLs se generarán automáticamente como:
- `https://tu-sitio.netlify.app/alumno/ID-DEL-ALUMNO`

En lugar de:
- `https://tu-sitio.netlify.app/usuario.html?id=ID-DEL-ALUMNO`

## 📱 Después del Despliegue

1. **Prueba las URLs bonitas**: Escanea un QR y verifica que funcione
2. **Configura Supabase** (si aún no lo has hecho):
   - Ve a `admin.html` en tu sitio de Netlify
   - Configura tu URL de Supabase y anon key
3. **Prueba en móvil**: Abre tu sitio desde un teléfono para verificar que todo funcione

## 🎯 Dominio Personalizado (Opcional)

Si quieres un dominio personalizado:

1. Ve a "Site settings" → "Domain management"
2. Haz clic en "Add custom domain"
3. Sigue las instrucciones para configurar tu dominio

## ⚠️ Notas Importantes

- Los archivos `.zip` y carpetas temporales están excluidos (`.gitignore`)
- El Service Worker se actualizará automáticamente
- Los datos de Supabase funcionarán desde cualquier dispositivo
- Las URLs bonitas funcionan automáticamente en Netlify

## 🔧 Si algo no funciona

1. **Verifica la consola del navegador** (F12) para ver errores
2. **Revisa los logs de Netlify** en la sección "Deploys"
3. **Limpia la caché** del navegador si ves contenido antiguo
4. **Verifica Supabase**: Asegúrate de que las credenciales estén correctas

---

¡Tu aplicación está lista para producción! 🎉

