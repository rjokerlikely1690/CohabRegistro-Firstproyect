# COHAB — Registro y Pagos

Sistema web para **COHAB BJJ** (San Carlos de Apoquindo): sitio público, administración de alumnos, verificación de pagos por QR y API backend con MongoDB.

## Estructura del proyecto

| Ruta | Descripción |
|------|-------------|
| `index.html`, `clases.html`, `metodologia.html`, … | Sitio público (landing, horarios, contacto, etc.) |
| `login.html` | Inicio de sesión |
| `admin.html`, `admin/` | Panel de administración y dashboard |
| `gestion-alumnos.html`, `app.js` | Gestión de alumnos (CRUD, búsqueda, alertas) |
| `public/verificar.html`, `verificar.js` | Verificación de pago por QR |
| `public/alumno.html` | Vista alumno (estado de pago, QR) |
| `mongodb-api/` | API REST (Node + Express + MongoDB) |

## Requisitos

- **Frontend:** navegador moderno; se sirve como estático (Netlify, Cloudflare Pages, etc.).
- **Backend:** Node.js ≥ 18. Ver `mongodb-api/README.md` para variables de entorno y despliegue.

## Configuración rápida

1. **Clonar y configurar API**
   ```bash
   cd mongodb-api && npm install
   ```
   Definir `MONGODB_URI` y, si aplica, variables de email (Resend/MailerSend). Ver `mongodb-api/README.md`.

2. **Desplegar**
   - **API:** Railway, Render o similar (ver `mongodb-api/`).
   - **Frontend:** conectar el repo a Netlify/Cloudflare Pages; usar `_redirects` y `netlify.toml` incluidos.

3. En el panel admin, configurar la URL de la API y, opcionalmente, el envío de emails.

## Rutas relevantes

- `/` — Inicio  
- `/login.html` — Login  
- `/admin.html` — Panel admin  
- `/public/verificar.html` — Verificar pago (QR)  
- `/public/alumno.html?id=<id>` — Estado del alumno / QR  

Los redirects (p. ej. `/verificar` → `/public/verificar.html`) están en `_redirects`.

## Licencia

Uso interno COHAB BJJ.
