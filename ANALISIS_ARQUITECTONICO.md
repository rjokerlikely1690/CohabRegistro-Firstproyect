# 🔍 ANÁLISIS ARQUITECTÓNICO - Sistema COHAB

## ❌ PROBLEMAS CRÍTICOS DETECTADOS

### 1. **DOS PANTALLAS CON FUNCIONALIDAD DUPLICADA**

#### `verificar.html` (Para profesores/admin)
- Escanea QR de alumnos
- Verifica estado de pago
- Muestra resultado de verificación
- **Lógica:** `verificar.js` → `calcularEstado()` → `mostrarResultado()`

#### `usuario.html` (Para alumnos)
- Acceso público vía URL con ID
- Muestra estado de pago del alumno
- **Lógica:** `usuario.html` (inline) → `calcularEstado()` → `showStudentResult()`

**PROBLEMA:** Ambas pantallas hacen lo mismo pero con código duplicado.

---

### 2. **LÓGICA DE VALIDACIÓN DUPLICADA EN 3 LUGARES**

1. **`app.js`** - Función `calcularEstado()` (línea 171)
2. **`usuario.html`** - Función `calcularEstado()` duplicada (línea 833)
3. **`verificar.js`** - Función `calcularEstado()` duplicada (línea 64)

**PROBLEMA:** Si cambias la lógica en un lugar, los otros dos quedan desactualizados.

---

### 3. **NO HAY ENDPOINT BACKEND PARA VALIDAR SUSCRIPCIONES**

**Backend actual (`mongodb-api/server.js`):**
- ✅ `GET /alumnos` - Lista TODOS los alumnos
- ✅ `GET /alumnos/:id` - **NO EXISTE**
- ✅ `POST /alumnos` - Crear alumno
- ✅ `PUT /alumnos` - Actualizar alumno
- ✅ `DELETE /alumnos/:id` - Eliminar alumno
- ✅ `PATCH /alumnos/:id/pago` - Registrar pago
- ❌ `GET /alumnos/:id/validar` - **NO EXISTE**
- ❌ `GET /alumnos/:id/estado` - **NO EXISTE**

**PROBLEMA:** El frontend tiene que:
1. Cargar TODOS los alumnos desde MongoDB
2. Buscar el alumno por ID en el frontend
3. Calcular el estado en el frontend

Esto es ineficiente y propenso a errores.

---

### 4. **REDIRECCIONES MÚLTIPLES**

**Flujo actual problemático:**
```
URL: /usuario.html?id=XXX
  ↓
usuario.html carga
  ↓
checkUserAccess() verifica si hay ID
  ↓
Si no hay ID → redirige a login.html
  ↓
Si hay ID → busca en localStorage
  ↓
Si no encuentra → carga desde MongoDB
  ↓
Si no encuentra → muestra error
  ↓
Si encuentra → calcula estado en frontend
```

**PROBLEMA:** Múltiples puntos de falla y redirecciones.

---

### 5. **NO HAY FUENTE ÚNICA DE VERDAD**

- Estado calculado en frontend (3 lugares diferentes)
- Sin validación en backend
- Sin caché consistente
- Sin sincronización garantizada

---

## ✅ SOLUCIÓN PROPUESTA

### **ARQUITECTURA LIMPIA:**

```
┌─────────────────┐
│   LECTOR QR     │
│  (verificar.html)│
└────────┬────────┘
         │
         │ GET /api/alumnos/:id/validar
         ▼
┌─────────────────┐
│   BACKEND API   │
│  (server.js)    │
└────────┬────────┘
         │
         │ Query MongoDB
         ▼
┌─────────────────┐
│    MONGODB      │
│  (alumnos)      │
└────────┬────────┘
         │
         │ Calcula estado
         ▼
┌─────────────────┐
│   RESPUESTA     │
│  {              │
│    acceso: true │
│    estado: "..."│
│  }              │
└─────────────────┘
```

### **ENDPOINT BACKEND NUEVO:**

```javascript
// GET /alumnos/:id/validar
// Devuelve: { acceso: boolean, estado: string, mensaje: string }
```

### **FLUJO SIMPLIFICADO:**

1. **Lector escanea QR** → Obtiene ID
2. **Frontend llama** → `GET /api/alumnos/:id/validar`
3. **Backend consulta MongoDB** → Obtiene alumno
4. **Backend calcula estado** → Una sola función
5. **Backend responde** → `{ acceso: true/false, estado: "..." }`
6. **Frontend muestra** → Resultado binario

---

## 📋 INFORMACIÓN NECESARIA

Para implementar la solución, necesito:

1. **Esquema exacto de MongoDB:**
   - ¿Qué campos tiene exactamente cada documento?
   - ¿Hay campos adicionales que no estén en el README?
   - ¿Cómo se almacenan las fechas? (ISO string, Date object, etc.)

2. **Confirmación de pantallas:**
   - ¿Mantener `verificar.html` para profesores?
   - ¿Mantener `usuario.html` para alumnos?
   - ¿O unificar en una sola pantalla?

3. **Reglas de negocio exactas:**
   - ¿Cuándo se considera "suscripción activa"?
   - ¿Cuántos días de gracia hay?
   - ¿Qué pasa si el pago es exactamente el día de vencimiento?

---

## 🎯 PRÓXIMOS PASOS

1. **Esperar confirmación del esquema MongoDB**
2. **Crear endpoint backend `/alumnos/:id/validar`**
3. **Unificar lógica de cálculo de estado en backend**
4. **Simplificar frontend para solo consumir API**
5. **Eliminar código duplicado**
6. **Probar flujo completo**

