// MongoDB API Server para COHAB
// Este servidor expone una API REST segura para MongoDB
// Desplegar en Railway, Render, Vercel, o similar

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection string (debe venir de variables de entorno)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.1@cohab.oefjuvo.mongodb.net/?appName=cohab';
const DB_NAME = process.env.DB_NAME || 'cohab';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'alumnos';

let client = null;
let db = null;

// Conectar a MongoDB
async function connectDB() {
    try {
        // Opciones de conexión con SSL/TLS mejoradas
        const clientOptions = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            tls: true,
            tlsAllowInvalidCertificates: false,
            retryWrites: true,
            w: 'majority'
        };
        
        client = new MongoClient(MONGODB_URI, clientOptions);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Conectado a MongoDB');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        console.error('💡 Asegúrate de que:');
        console.error('   1. La IP de Railway está permitida en MongoDB Atlas Network Access');
        console.error('   2. MONGODB_URI está configurada correctamente');
        console.error('   3. El usuario y contraseña son correctos');
        throw error;
    }
}

// Middleware de autenticación simple (opcional)
// Puedes agregar API keys si quieres más seguridad
function authMiddleware(req, res, next) {
    // Por ahora, permitir todas las solicitudes
    // Para producción, agrega validación de API key
    next();
}

// GET /alumnos - Listar todos los alumnos
app.get('/alumnos', authMiddleware, async (req, res) => {
    try {
        const collection = db.collection(COLLECTION_NAME);
        const alumnos = await collection.find({}).sort({ nombre: 1 }).toArray();
        res.json({ data: alumnos });
    } catch (error) {
        console.error('Error listando alumnos:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /alumnos - Crear nuevo alumno
app.post('/alumnos', authMiddleware, async (req, res) => {
    try {
        const alumno = req.body;
        
        // Generar ID si no existe
        if (!alumno.id) {
            alumno.id = require('crypto').randomUUID();
        }
        
        // Convertir fecha si es necesario
        if (alumno.fechaPago) {
            alumno.fechaPago = new Date(alumno.fechaPago);
        }
        
        const collection = db.collection(COLLECTION_NAME);
        const result = await collection.insertOne(alumno);
        
        res.json({ 
            id: alumno.id,
            _id: result.insertedId 
        });
    } catch (error) {
        console.error('Error creando alumno:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /alumnos - Actualizar o crear alumno (upsert)
app.put('/alumnos', authMiddleware, async (req, res) => {
    try {
        const alumno = req.body;
        
        if (!alumno.id) {
            return res.status(400).json({ error: 'ID requerido' });
        }
        
        // Convertir fecha si es necesario
        if (alumno.fechaPago) {
            alumno.fechaPago = new Date(alumno.fechaPago);
        }
        
        const collection = db.collection(COLLECTION_NAME);
        const result = await collection.updateOne(
            { id: alumno.id },
            { $set: alumno },
            { upsert: true }
        );
        
        res.json({ success: true, matched: result.matchedCount, modified: result.modifiedCount });
    } catch (error) {
        console.error('Error actualizando alumno:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /alumnos/:id - Eliminar alumno
app.delete('/alumnos/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const collection = db.collection(COLLECTION_NAME);
        const result = await collection.deleteOne({ id });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando alumno:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /alumnos/:id/pago - Registrar pago
app.patch('/alumnos/:id/pago', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { fechaPago } = req.body;
        
        if (!fechaPago) {
            return res.status(400).json({ error: 'fechaPago requerida' });
        }
        
        const collection = db.collection(COLLECTION_NAME);
        const result = await collection.updateOne(
            { id },
            { $set: { fechaPago: new Date(fechaPago) } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error registrando pago:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', db: db ? 'connected' : 'disconnected' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

async function start() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`🚀 Servidor MongoDB API corriendo en puerto ${PORT}`);
        console.log(`📡 Endpoints disponibles:`);
        console.log(`   GET    /alumnos`);
        console.log(`   POST   /alumnos`);
        console.log(`   PUT    /alumnos`);
        console.log(`   DELETE /alumnos/:id`);
        console.log(`   PATCH  /alumnos/:id/pago`);
    });
}

start().catch(console.error);

// Manejo de cierre graceful
process.on('SIGTERM', async () => {
    if (client) {
        await client.close();
        console.log('✅ Conexión MongoDB cerrada');
    }
    process.exit(0);
});

