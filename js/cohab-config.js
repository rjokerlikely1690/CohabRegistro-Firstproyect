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
// Backend público en Render (producción)
window.COHAB_CONFIG.mongodbApiUrl = 'https://cohabregistro-firstproyect.onrender.com';

// Clave para acceder a Gestión de Alumnos (opcional). Si la dejas vacía '', no se pedirá clave.
// Ejemplo: window.COHAB_CONFIG.gestionClave = 'miClaveSecreta';
window.COHAB_CONFIG.gestionClave = window.COHAB_CONFIG.gestionClave || '';


