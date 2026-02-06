// Service Worker para Sistema Academia COHAB
// Permite funcionar offline después de la primera carga

const CACHE_NAME = 'academia-cohab-v28';
const urlsToCache = [
  '/',
  '/index.html',
  // Páginas públicas (marketing)
  '/clases.html',
  '/metodologia.html',
  '/comunidad.html',
  '/horarios.html',
  '/contacto.html',
  '/ubicacion.html',
  '/faq.html',
  // Rutas públicas actuales
  '/public/alumno',
  '/public/verificar',
  '/public/alumno.html',
  '/public/verificar.html',
  '/js/app.js',
  '/js/verificar.js',
  '/css/styles.css',
  '/img/logo_cohab.svg',
  '/img/logo_cohab.png',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activar Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requests
self.addEventListener('fetch', function(event) {
  const req = event.request;
  
  // NO cachear requests que no sean GET (POST, PUT, DELETE, etc.)
  if (req.method !== 'GET') {
    return;
  }
  
  // NO cachear chrome-extension:// u otros esquemas no http/https
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    return;
  }
  
  // NO cachear requests a APIs externas (MongoDB, Supabase, Render, etc.)
  const url = new URL(req.url);
  const isAPI = url.hostname.includes('railway.app') || 
                url.hostname.includes('supabase.co') ||
                url.hostname.includes('up.railway.app') ||
                url.hostname.includes('onrender.com') ||
                url.hostname.includes('render.com');
  
  if (isAPI) {
    // Para APIs, no usar respondWith - dejar que el navegador maneje directamente
    return;
  }
  
  // NO cachear páginas de admin - siempre fresh
  const isAdminPage = url.pathname.includes('admin') || 
                      url.pathname.includes('gestion') ||
                      url.pathname.includes('login');
  if (isAdminPage) {
    return; // Dejar que el navegador maneje directamente
  }

  function isStaticAssetRequest(pathname) {
    return (
      pathname.endsWith('.css') ||
      pathname.endsWith('.js') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.ico') ||
      pathname.endsWith('.json')
    );
  }

  function isBadAssetResponse(reqUrl, res) {
    if (!res) return true;
    const ct = (res.headers && res.headers.get && res.headers.get('content-type')) ? res.headers.get('content-type') : '';
    const pathname = new URL(reqUrl).pathname.toLowerCase();

    if (pathname.endsWith('.css')) {
      // Evitar "CSS envenenado": HTML servido en lugar de CSS
      return !ct.includes('text/css');
    }
    if (pathname.endsWith('.js')) {
      // JS suele venir como application/javascript o text/javascript
      return !(ct.includes('javascript'));
    }
    return false;
  }
  
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first para HTML (evita UI vieja en móvil)
    // ESPECIALMENTE para index.html que debe ser siempre la versión más reciente
    const isIndexHtml = url.pathname === '/' || url.pathname === '/index.html';
    
    if (isIndexHtml) {
      // Para index.html: SIEMPRE network-first, nunca cache
      event.respondWith(
        fetch(req)
          .then(res => {
            // No cachear index.html para asegurar que siempre sea la versión más reciente
            return res;
          })
          .catch(() => {
            // Solo usar cache como último recurso si no hay red
            return caches.match(req);
          })
      );
    } else {
      // Para otros HTML: network-first con cache
      event.respondWith(
        fetch(req)
          .then(res => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            return res;
          })
          .catch(() => caches.match(req))
      );
    }
    return;
  }

  // Cache-first para archivos estáticos (CSS, JS, imágenes)
  // Protección: NO servir/guardar HTML como si fuera CSS/JS (evita pantalla sin estilos en móviles)
  const isStatic = isStaticAssetRequest(url.pathname.toLowerCase());
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        if (isStatic && isBadAssetResponse(req.url, cached)) {
          // Cache envenenado: ignorar y reintentar desde red
          return fetch(req).then(res => {
            if (isStatic && isBadAssetResponse(req.url, res)) {
              return res; // no cachear respuesta inválida
            }
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            return res;
          });
        }
        return cached;
      }

      return fetch(req).then(res => {
        if (isStatic && isBadAssetResponse(req.url, res)) {
          return res; // no cachear respuesta inválida
        }
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      });
    })
  );
});

// Notificaciones push (opcional)
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación del sistema COHAB',
    icon: '/img/logo_cohab.png',
    badge: '/img/logo_cohab.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver detalles',
        icon: '/img/logo_cohab.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/img/logo_cohab.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Sistema Academia COHAB', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

