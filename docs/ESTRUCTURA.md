# Estructura del repositorio COHAB

## Organización por tipo

```
CohabRegistro-Firstproyect/
├── css/                    # Estilos globales
│   └── styles.css
├── img/                    # Imágenes y logos
│   ├── logo_cohab.png
│   └── logo_cohab.svg
├── js/                     # Scripts del frontend
│   ├── app.js              # Lógica gestión alumnos, admin
│   ├── auth-client.js      # Login y sesión
│   ├── cohab-config.js     # URL de la API (config pública)
│   ├── mongodb-client.js   # Cliente HTTP hacia la API
│   ├── verificar.js        # Verificación QR
│   └── alert-system.js     # Alertas de pago
├── public/                 # Páginas públicas (verificación, alumno)
│   ├── verificar.html      # Verificar pago por QR
│   └── alumno.html         # Vista alumno (estado, QR)
├── admin/                  # Panel admin
│   └── dashboard.html
├── docs/                   # Documentación interna
│   ├── ESTRUCTURA.md       # Este archivo
│   └── MEJORAS_REALIZADAS.md
├── mongodb-api/            # Backend (Node + Express + MongoDB)
│   ├── server.js
│   ├── scripts/
│   └── ...
├── index.html              # Inicio (landing)
├── 404.html
├── login.html
├── admin.html
├── gestion-alumnos.html
├── clases.html, metodologia.html, comunidad.html, horarios.html
├── contacto.html, faq.html, ubicacion.html
├── obtener-ids.html        # Utilidad interna
├── usuario.html            # Redirige a public/alumno.html
├── manifest.json
├── sw.js                   # Service Worker (PWA)
├── _redirects              # Reglas Netlify/Cloudflare
├── netlify.toml, railway.toml, railway.json, render.yaml, .nixpacks.toml
├── package.json
├── .gitignore
└── README.md
```

## Rutas importantes

| Ruta | Descripción |
|------|-------------|
| `/` | Inicio |
| `/login.html` | Login |
| `/admin.html` | Panel admin |
| `/gestion-alumnos.html` | Gestión de alumnos |
| `/public/verificar.html` | Verificar pago (QR) |
| `/public/alumno.html?id=<id>` | Estado del alumno / QR |

## Assets

- **CSS:** `css/styles.css`
- **JS:** `js/*.js` (app, auth-client, cohab-config, mongodb-client, verificar, alert-system)
- **Imágenes:** `img/logo_cohab.png`, `img/logo_cohab.svg`

Los redirects en `_redirects` mantienen compatibilidad con rutas antiguas (ej. `/styles.css` → `/css/styles.css`).
