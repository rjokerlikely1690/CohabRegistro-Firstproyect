# COHAB — Registro y Pagos

Sistema web para **COHAB BJJ** (San Carlos de Apoquindo): sitio público, administración de alumnos, verificación de pagos por QR y API backend con MongoDB.

## Contenido de la documentación

| Documento | Contenido |
|-----------|-----------|
| [README.md](README.md) | Este archivo: resumen y enlaces |
| [docs/ESTRUCTURA.md](docs/ESTRUCTURA.md) | Estructura del repo (carpetas css/, js/, img/, public/, admin/) |
| [docs/MEJORAS_REALIZADAS.md](docs/MEJORAS_REALIZADAS.md) | Notas de mejoras implementadas |
| [mongodb-api/README.md](mongodb-api/README.md) | API backend: endpoints, datos, despliegue |

## Estructura del proyecto (resumen)

| Ruta | Descripción |
|------|-------------|
| `index.html`, `clases.html`, `metodologia.html`, … | Sitio público (landing, horarios, contacto) |
| `login.html`, `js/auth-client.js` | Inicio de sesión |
| `admin.html`, `admin/` | Panel de administración |
| `gestion-alumnos.html`, `js/app.js`, `js/mongodb-client.js`, `js/alert-system.js` | Gestión de alumnos (CRUD, búsqueda, alertas) |
| `public/verificar.html`, `js/verificar.js` | Verificación de pago por QR |
| `public/alumno.html` | Vista alumno (estado de pago, QR) |
| `mongodb-api/` | API REST (Node + Express + MongoDB) |

## Requisitos

- **Frontend:** navegador moderno; se sirve como estático (Netlify, Cloudflare Pages).
- **Backend:** Node.js ≥ 18. Ver [mongodb-api/README.md](mongodb-api/README.md) y [docs/CONFIGURACION.md](docs/CONFIGURACION.md).

## Configuración rápida

1. **API:** `cd mongodb-api && npm install`. Definir `MONGODB_URI` y, si aplica, variables de email (Resend/MailerSend). Ver [docs/CONFIGURACION.md](docs/CONFIGURACION.md).
2. **Frontend:** en `js/cohab-config.js` (o desde admin) configurar la URL pública de la API.
3. **Despliegue:** API en Railway/Render; frontend en Netlify/Cloudflare Pages usando `_redirects` y `netlify.toml`.

## Rutas relevantes

- `/` — Inicio  
- `/login.html` — Login  
- `/admin.html` — Panel admin  
- `/public/verificar.html` o `/verificar` — Verificar pago (QR)  
- `/public/alumno.html?id=<id>` o `/alumno/:id`, `/u/:id` — Estado del alumno / QR  

Redirects definidos en `_redirects`.

## Licencia

Uso interno COHAB BJJ.
