// MongoDB API Server para COHAB
// Este servidor expone una API REST segura para MongoDB
// Desplegar en Railway, Render, Vercel, o similar

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection string (debe venir de variables de entorno)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.1@cohab.oefjuvo.mongodb.net/?appName=cohab';
const DB_NAME = process.env.DB_NAME || 'cohab';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'alumnos';

let client = null;
let db = null;

const SEND_EMAILS = process.env.EMAIL_ENABLED === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM || 'COHAB <no-reply@cohab.cl>';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://cohabregistro-firstproyect.pages.dev/';
let mailTransporter = null;

if (SEND_EMAILS) {
    try {
        mailTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT || 465),
            secure: Number(process.env.EMAIL_PORT || 465) === 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('📧 Servicio de correo habilitado.');
    } catch (error) {
        console.error('❌ No se pudo inicializar el transporter de correo:', error);
        mailTransporter = null;
    }
}

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

function buildStudentUrl(alumno) {
    const base = PUBLIC_BASE_URL.endsWith('/') ? PUBLIC_BASE_URL : `${PUBLIC_BASE_URL}/`;
    return `${base}usuario.html?id=${alumno.id}`;
}

async function generateQrBuffer(alumno) {
    const url = buildStudentUrl(alumno);
    return QRCode.toBuffer(url, {
        type: 'png',
        width: 400,
        margin: 1
    });
}

async function sendStudentEmail(alumno) {
    if (!SEND_EMAILS) {
        return;
    }
    if (!mailTransporter) {
        console.warn('⚠️ Servicio de correo no configurado, omitiendo envío.');
        return;
    }
    if (!alumno.email) {
        console.warn('⚠️ Alumno sin email, no se enviará el QR.');
        return;
    }

    const qrBuffer = await generateQrBuffer(alumno);
    const alumnoUrl = buildStudentUrl(alumno);

    await mailTransporter.sendMail({
        from: EMAIL_FROM,
        to: alumno.email,
        subject: `Tu acceso a COHAB - ${alumno.nombre}`,
        html: `
            <p>Hola ${alumno.nombre},</p>
            <p>Te enviamos tu acceso a COHAB. Con este QR o el enlace podrás consultar tus pagos en cualquier momento.</p>
            <ul>
                <li><strong>Nombre:</strong> ${alumno.nombre}</li>
                <li><strong>Monto mensual:</strong> $${Number(alumno.monto || 0).toFixed(2)}</li>
                <li><strong>Enlace directo:</strong> <a href="${alumnoUrl}">${alumnoUrl}</a></li>
            </ul>
            <p>Escanea el código adjunto para acceder desde tu teléfono.</p>
            <p>Un abrazo,<br>Equipo COHAB</p>
        `,
        attachments: [
            {
                filename: `qr-${alumno.id}.png`,
                content: qrBuffer,
                contentType: 'image/png'
            }
        ]
    });
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
        
        if (SEND_EMAILS && alumno.email) {
            try {
                await sendStudentEmail(alumno);
            } catch (error) {
                console.error('⚠️ No se pudo enviar email de bienvenida:', error.message);
            }
        }

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
        
        if (SEND_EMAILS && alumno.email) {
            try {
                await sendStudentEmail(alumno);
            } catch (error) {
                console.error('⚠️ No se pudo enviar email actualizado:', error.message);
            }
        }

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

app.post('/alumnos/:id/enviar-qr', authMiddleware, async (req, res) => {
    try {
        if (!SEND_EMAILS) {
            return res.status(503).json({ error: 'Servicio de correo deshabilitado (EMAIL_ENABLED=false).' });
        }
        if (!mailTransporter) {
            return res.status(503).json({ error: 'Transporte de correo no configurado.' });
        }

        const { id } = req.params;
        const collection = db.collection(COLLECTION_NAME);
        const alumno = await collection.findOne({ id });

        if (!alumno) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        if (!alumno.email) {
            return res.status(400).json({ error: 'El alumno no tiene email registrado' });
        }

        await sendStudentEmail(alumno);
        res.json({ success: true });
    } catch (error) {
        console.error('Error enviando email con QR:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta raíz - Información de la API
app.get('/', (req, res) => {
    res.json({
        service: 'COHAB MongoDB API',
        version: '1.0.0',
        status: 'running',
        database: db ? 'connected' : 'disconnected',
        endpoints: {
            'GET /alumnos': 'Listar todos los alumnos',
            'POST /alumnos': 'Crear nuevo alumno',
            'PUT /alumnos': 'Actualizar o crear alumno',
            'DELETE /alumnos/:id': 'Eliminar alumno',
            'PATCH /alumnos/:id/pago': 'Registrar pago',
            'GET /health': 'Health check'
        },
        usage: 'Esta es una API backend. Usa los endpoints anteriores desde tu aplicación frontend.'
    });
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

