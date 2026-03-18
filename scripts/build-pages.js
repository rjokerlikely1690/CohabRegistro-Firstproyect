/**
 * Copia solo el frontend estático a dist/ para Cloudflare.
 * Evita subir node_modules (límite 25 MiB por archivo).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const toCopy = [
  'index.html', '404.html', 'clases.html', 'contacto.html', 'faq.html',
  'horarios.html', 'login.html', 'metodologia.html', 'comunidad.html',
  'ubicacion.html', 'admin.html', 'gestion-alumnos.html', 'obtener-ids.html',
  'usuario.html', 'academias.html',
  '_redirects', 'manifest.json', 'sw.js', 'netlify.toml',
  'css', 'js', 'img', 'public', 'admin',
];

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
fs.mkdirSync(dist, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

for (const item of toCopy) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(dist, item));
    console.log('Copied:', item);
  }
}
const alumnoDir = path.join(root, 'alumno');
if (fs.existsSync(alumnoDir)) {
  copyRecursive(alumnoDir, path.join(dist, 'alumno'));
  console.log('Copied: alumno/');
}
console.log('Done. Static site in dist/');
