# 🚀 Configuración Completa - Sistema COHAB

## 📋 Índice
1. [Página de Inicio](#página-de-inicio)
2. [Actualización Automática de QR al Final de Mes](#actualización-automática-de-qr)
3. [Configuración de Email (Resend - Rápido y Fácil)](#configuración-de-email)

---

## 🏠 Página de Inicio

### Estado Actual
- ✅ `login.html` - Página de inicio moderna con diseño oscuro
- ✅ `index.html` - Redirige automáticamente a `login.html`
- ✅ `gestion-alumnos.html` - Página de gestión de alumnos

### Cómo Funciona
1. Al acceder a la raíz (`/`), se carga `index.html` que redirige a `login.html`
2. `login.html` muestra 3 opciones de acceso:
   - 👨‍💼 **ADMINISTRADOR** → `admin.html`
   - 👥 **GESTIÓN DE ALUMNOS** → `gestion-alumnos.html`
   - 👤 **VERIFICAR PAGO** → `usuario.html`

### Limpiar Caché del Navegador
Si ves la página antigua:
- **Chrome/Edge**: `Cmd + Shift + R` (Mac) o `Ctrl + Shift + R` (Windows)
- **Safari**: `Cmd + Option + E` (vaciar caché)
- O abre en modo incógnito: `Cmd + Shift + N`

---

## 🔄 Actualización Automática de QR al Final de Mes

### ¿Cómo Funcionan los QR?

**IMPORTANTE:** Los códigos QR **NO necesitan actualizarse** porque contienen una URL que siempre funciona:
```
https://cohabregistro-firstproyect.pages.dev/usuario.html?id=ID-DEL-ALUMNO
```

Esta URL siempre muestra la información **actualizada** del alumno porque:
1. El QR apunta a una página web
2. La página consulta la base de datos en tiempo real
3. Siempre muestra el estado actual del pago

### ¿Qué se Actualiza Automáticamente?

Lo que SÍ necesita actualizarse es la **fecha de último pago** en la base de datos cuando pasa el mes. Para esto:

#### Opción 1: Script Automático (Recomendado)

He creado el script `mongodb-api/actualizar-mensualidades.js` que:

1. **Se conecta a MongoDB**
2. **Revisa todos los alumnos**
3. **Actualiza automáticamente** las fechas de pago al final de mes
4. **Usa el día de pago** configurado para cada alumno

#### Configurar Ejecución Automática

**En Railway/Render (Recomendado):**

1. Ve a tu proyecto en Railway/Render
2. Agrega un nuevo servicio o "Cron Job"
3. Configura:
   ```
   Command: node mongodb-api/actualizar-mensualidades.js
   Schedule: 0 0 * * * (diario a medianoche)
   ```

**En tu servidor local (Linux/Mac):**

Agrega a crontab:
```bash
# Editar crontab
crontab -e

# Agregar esta línea (ejecuta diario a las 2 AM)
0 2 * * * cd /ruta/a/tu/proyecto && node mongodb-api/actualizar-mensualidades.js >> /var/log/cohab-actualizacion.log 2>&1
```

**Ejecutar Manualmente:**
```bash
cd mongodb-api
node actualizar-mensualidades.js
```

#### Opción 2: Actualización Manual desde Panel Admin

Puedes crear un botón en el panel admin que ejecute la actualización manualmente cuando lo necesites.

---

## 📧 Configuración de Email (Resend - La Más Rápida)

### ¿Por qué Resend?

✅ **Gratis**: 100 emails/día gratis  
✅ **Sin verificación de dominio**: Funciona inmediatamente  
✅ **Fácil configuración**: Solo necesitas una API Key  
✅ **Sin límites complicados**: No necesitas SMTP  

### Paso a Paso

#### 1. Crear Cuenta en Resend

1. Ve a https://resend.com
2. Haz clic en "Sign Up" (arriba a la derecha)
3. Crea cuenta con tu email (puede ser Gmail, etc.)
4. Verifica tu email

#### 2. Obtener API Key

1. Una vez dentro, ve a "API Keys" en el menú lateral
2. Haz clic en "Create API Key"
3. Dale un nombre (ej: "COHAB Production")
4. Copia la API Key (empieza con `re_`)
5. ⚠️ **Guárdala bien**, solo se muestra una vez

#### 3. Configurar en Railway/Render

1. Ve a tu proyecto en Railway/Render
2. Ve a "Variables" o "Environment Variables"
3. Agrega estas variables:

```
EMAIL_ENABLED=true
USE_RESEND_API=true
RESEND_API_KEY=re_tu_api_key_aqui
EMAIL_FROM=onboarding@resend.dev
PUBLIC_BASE_URL=https://cohabregistro-firstproyect.pages.dev
```

**Nota sobre EMAIL_FROM:**
- `onboarding@resend.dev` funciona inmediatamente (solo para pruebas)
- Para producción, verifica tu dominio en Resend y usa: `tu_email@tudominio.com`

#### 4. Verificar Dominio (Opcional - Para Producción)

1. En Resend, ve a "Domains"
2. Haz clic en "Add Domain"
3. Ingresa tu dominio (ej: `cohab.cl`)
4. Agrega los registros DNS que te indique Resend
5. Espera la verificación (puede tardar unos minutos)
6. Una vez verificado, cambia `EMAIL_FROM` a: `noreply@tudominio.com`

#### 5. Reiniciar el Servidor

Después de agregar las variables:
1. Reinicia el servicio en Railway/Render
2. O espera a que se reinicie automáticamente

#### 6. Probar el Envío

1. Ve a `admin.html` en tu sitio
2. Haz clic en "Enviar QRs por Email"
3. O registra un nuevo alumno con email
4. Verifica que llegue el email

### Verificar que Funciona

Revisa los logs en Railway/Render:
- Deberías ver: `✅ Email enviado a email@ejemplo.com vía Resend API`
- Si hay errores, aparecerán en los logs

### Solución de Problemas

**Error: "API Key inválida"**
- Verifica que copiaste la API Key completa
- Asegúrate de que empiece con `re_`

**Error: "Email no verificado"**
- Usa `onboarding@resend.dev` para pruebas
- O verifica tu dominio en Resend

**Los emails no llegan**
- Revisa la carpeta de spam
- Verifica que el email del alumno sea válido
- Revisa los logs en Railway/Render

---

## 📝 Resumen de URLs Importantes

- **Sitio Web**: https://cohabregistro-firstproyect.pages.dev
- **Página de Inicio**: https://cohabregistro-firstproyect.pages.dev/login.html
- **Panel Admin**: https://cohabregistro-firstproyect.pages.dev/admin.html
- **Gestión Alumnos**: https://cohabregistro-firstproyect.pages.dev/gestion-alumnos.html

---

## ✅ Checklist de Configuración

- [ ] Página de inicio funcionando (`login.html`)
- [ ] Resend configurado con API Key
- [ ] Variables de entorno configuradas en Railway/Render
- [ ] Script de actualización automática configurado (cron job)
- [ ] Probar envío de email desde panel admin
- [ ] Verificar que los QR funcionan correctamente

---

**¿Necesitas ayuda?** Revisa los logs en Railway/Render o contacta al desarrollador.

