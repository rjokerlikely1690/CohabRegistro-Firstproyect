# 📋 Configuración de Netlify - Paso a Paso

## ✅ Configuración Exacta para tu Proyecto

Cuando Netlify te pregunte por la configuración, usa estos valores:

### Base directory
```
.
```
*(O déjalo vacío - significa directorio raíz)*

### Build command
```
(vacío - no escribas nada)
```
*(Es un sitio estático, no necesita compilación)*

### Publish directory
```
.
```
*(El punto significa "directorio raíz del proyecto")*

### Functions directory
```
(vacío - no necesitas funciones serverless)
```

### Environment variables
```
(vacío - no necesitas ninguna variable de entorno)
```
*(Supabase se configura desde la aplicación misma en admin.html)*

---

## 🎯 Resumen Visual

```
Base directory:      .
Build command:       (vacío)
Publish directory:   .
Functions:           (vacío)
Environment vars:    (ninguna)
```

## ⚠️ Importante

- **NO necesitas** ejecutar `npm install` ni ningún comando de build
- El proyecto ya está **listo para servir directamente**
- Netlify solo necesita **servir los archivos estáticos** (HTML, CSS, JS)

## 🚀 Después de Configurar

1. Haz clic en **"Deploy site"**
2. Espera a que termine el despliegue (1-2 minutos)
3. Tu sitio estará disponible en: `https://cohabsancarlos.netlify.app` (o el nombre que elijas)

¡Eso es todo! Tu aplicación funcionará perfectamente con esta configuración.

