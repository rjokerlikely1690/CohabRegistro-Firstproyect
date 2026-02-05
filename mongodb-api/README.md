# MongoDB API para COHAB

Este servidor expone una API REST segura para MongoDB Atlas.

## Configuración

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
   - `MONGODB_URI`: Tu connection string de MongoDB Atlas
   - `DB_NAME`: Nombre de la base de datos (default: `cohab`)
   - `COLLECTION_NAME`: Nombre de la colección (default: `alumnos`)
   - `PORT`: Puerto del servidor (default: `3000`)

## Despliegue

### Opción 1: Railway (Recomendado)
1. Ve a [railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Conecta tu repositorio o sube esta carpeta
4. Railway detectará `package.json` automáticamente
5. Agrega la variable `MONGODB_URI` en Settings → Variables
6. Railway te dará una URL como: `https://tu-proyecto.railway.app`
7. **Usa esa URL en la configuración de MongoDB en `admin.html`**

### Opción 2: Render
1. Ve a [render.com](https://render.com)
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Agrega `MONGODB_URI` en Environment Variables

### Opción 3: Vercel (con ajustes)
Vercel requiere funciones serverless. Puedes adaptar este código.

### Opción 4: Local (desarrollo)
```bash
npm install
MONGODB_URI="tu-connection-string" npm start
```

## Uso en la App

1. Despliega este servidor
2. Obtén la URL pública (ej: `https://cohab-api.railway.app`)
3. En `admin.html`, configura la URL de MongoDB API
4. La app usará MongoDB automáticamente

## Estructura de Datos

Los documentos en MongoDB tienen esta estructura:
```json
{
  "id": "uuid-del-alumno",
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "telefono": "123456789",
  "fechaPago": "2024-01-15T00:00:00.000Z",
  "diaPago": 30,
  "monto": 1500.00
}
```

## Endpoints

- `GET /alumnos` - Listar todos los alumnos
- `POST /alumnos` - Crear nuevo alumno
- `PUT /alumnos` - Actualizar/crear alumno (upsert)
- `DELETE /alumnos/:id` - Eliminar alumno
- `PATCH /alumnos/:id/pago` - Registrar pago

## Seguridad

Por defecto, la API no tiene autenticación. Para producción:
1. Agrega validación de API keys en `authMiddleware`
2. Configura CORS para tu dominio específico
3. Usa HTTPS siempre

