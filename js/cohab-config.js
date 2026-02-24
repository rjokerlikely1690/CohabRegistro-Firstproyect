// COHAB - Configuración pública del frontend
// ------------------------------------------------------------
// OBJETIVO: que cualquier alumno (sin configurar nada en su teléfono)
// pueda validar su QR, apuntando a un backend público por HTTPS.
//
// IMPORTANTE:
// - En LOCAL puedes seguir usando http://localhost:3000 (o tu IP LAN).
// - En PRODUCCIÓN (Cloudflare Pages), setea `mongodbApiUrl` a tu backend público HTTPS
//   (por ejemplo Railway/Render).
//
// Ejemplo:
// window.COHAB_CONFIG = { mongodbApiUrl: 'https://TU-PROYECTO.up.railway.app' };
//
// Si queda vacío, el sistema mostrará "Error de configuración del sistema"
// en vez de un "Load failed" confuso en iPhone.

window.COHAB_CONFIG = window.COHAB_CONFIG || {};
// Local: backend en localhost:3000 | Producción: 'https://cohabregistro-firstproyect.onrender.com'
window.COHAB_CONFIG.mongodbApiUrl = 'http://localhost:3000';

// La clave de Gestión de Alumnos se configura en el BACKEND (variable de entorno GESTION_CLAVE).
// No pongas la clave aquí; el frontend la valida contra el API.


