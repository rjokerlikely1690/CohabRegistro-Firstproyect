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
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const USE_RESEND_API = process.env.USE_RESEND_API === 'true';
const MAILERSEND_API_TOKEN = process.env.MAILERSEND_API_TOKEN;
const USE_MAILERSEND_API = process.env.USE_MAILERSEND_API === 'true';
let mailTransporter = null;

if (SEND_EMAILS && !USE_RESEND_API && !USE_MAILERSEND_API) {
    try {
        const port = Number(process.env.EMAIL_PORT || 587);
        const isSecure = port === 465;
        
        mailTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: isSecure,
            requireTLS: !isSecure && port === 587,
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log(`📧 Servicio de correo SMTP habilitado. Host: ${process.env.EMAIL_HOST}, Port: ${port}`);
    } catch (error) {
        console.error('❌ No se pudo inicializar el transporter de correo:', error);
        mailTransporter = null;
    }
} else if (SEND_EMAILS && USE_RESEND_API) {
    if (RESEND_API_KEY) {
        console.log('📧 Servicio de correo Resend API habilitado.');
    } else {
        console.warn('⚠️ USE_RESEND_API=true pero RESEND_API_KEY no está configurado.');
    }
} else if (SEND_EMAILS && USE_MAILERSEND_API) {
    if (MAILERSEND_API_TOKEN) {
        console.log('📧 Servicio de correo MailerSend API habilitado.');
    } else {
        console.warn('⚠️ USE_MAILERSEND_API=true pero MAILERSEND_API_TOKEN no está configurado.');
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
    if (!alumno.email) {
        console.warn('⚠️ Alumno sin email, no se enviará el QR.');
        return;
    }

    const qrBuffer = await generateQrBuffer(alumno);
    const alumnoUrl = buildStudentUrl(alumno);
    const qrBase64 = qrBuffer.toString('base64');

    // Usar API de Resend si está configurado (más simple y sin restricciones)
    if (USE_RESEND_API && RESEND_API_KEY) {
        try {
            const emailHtml = `
                <p>Hola ${alumno.nombre},</p>
                <p>Te enviamos tu acceso a COHAB. Con este QR o el enlace podrás consultar tus pagos en cualquier momento.</p>
                <ul>
                    <li><strong>Nombre:</strong> ${alumno.nombre}</li>
                    <li><strong>Monto mensual:</strong> $${Number(alumno.monto || 0).toFixed(2)}</li>
                    <li><strong>Enlace directo:</strong> <a href="${alumnoUrl}">${alumnoUrl}</a></li>
                </ul>
                <p>Escanea el código adjunto para acceder desde tu teléfono.</p>
                <p><img src="data:image/png;base64,${qrBase64}" alt="QR Code" style="max-width: 400px;" /></p>
                <p>Un abrazo,<br>Equipo COHAB</p>
            `;

            // Extraer email del formato "COHAB <email@domain.com>" o usar directamente
            let fromEmail = EMAIL_FROM;
            if (EMAIL_FROM.includes('<')) {
                const match = EMAIL_FROM.match(/<([^>]+)>/);
                if (match) {
                    fromEmail = match[1];
                }
            }
            fromEmail = fromEmail.replace(/^"|"$/g, '').trim();

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [alumno.email],
                    subject: `Tu acceso a COHAB - ${alumno.nombre}`,
                    html: emailHtml
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Resend API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`✅ Email enviado a ${alumno.email} vía Resend API`);
            return;
        } catch (error) {
            console.error('❌ Error enviando email vía Resend API:', error.message);
            throw error;
        }
    }

    // Usar API de MailerSend si está configurado
    if (USE_MAILERSEND_API && MAILERSEND_API_TOKEN) {
        try {
            const emailHtml = `
                <p>Hola ${alumno.nombre},</p>
                <p>Te enviamos tu acceso a COHAB. Con este QR o el enlace podrás consultar tus pagos en cualquier momento.</p>
                <ul>
                    <li><strong>Nombre:</strong> ${alumno.nombre}</li>
                    <li><strong>Monto mensual:</strong> $${Number(alumno.monto || 0).toFixed(2)}</li>
                    <li><strong>Enlace directo:</strong> <a href="${alumnoUrl}">${alumnoUrl}</a></li>
                </ul>
                <p>Escanea el código adjunto para acceder desde tu teléfono.</p>
                <p><img src="data:image/png;base64,${qrBase64}" alt="QR Code" style="max-width: 400px;" /></p>
                <p>Un abrazo,<br>Equipo COHAB</p>
            `;

            // Extraer email del formato "COHAB <email@domain.com>" o usar directamente
            let fromEmail = EMAIL_FROM;
            if (EMAIL_FROM.includes('<')) {
                const match = EMAIL_FROM.match(/<([^>]+)>/);
                if (match) {
                    fromEmail = match[1];
                }
            }
            // Limpiar comillas si las hay
            fromEmail = fromEmail.replace(/^"|"$/g, '').trim();
            
            console.log(`📧 Intentando enviar email desde: ${fromEmail} a: ${alumno.email}`);

            const response = await fetch('https://api.mailersend.com/v1/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MAILERSEND_API_TOKEN}`
                },
                body: JSON.stringify({
                    from: {
                        email: fromEmail,
                        name: 'COHAB'
                    },
                    to: [
                        {
                            email: alumno.email,
                            name: alumno.nombre
                        }
                    ],
                    subject: `Tu acceso a COHAB - ${alumno.nombre}`,
                    html: emailHtml
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`MailerSend API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log(`✅ Email enviado a ${alumno.email} vía MailerSend API`);
            return;
        } catch (error) {
            console.error('❌ Error enviando email vía MailerSend API:', error.message);
            throw error;
        }
    }

    // Fallback a SMTP si está configurado
    if (!mailTransporter) {
        console.warn('⚠️ Servicio de correo no configurado, omitiendo envío.');
        return;
    }

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
            return res.status(503).json({ error: 'Servicio de correo deshabilitado (EMAIL_ENABLED=false). Configure EMAIL_ENABLED=true en las variables de entorno.' });
        }
        
        // Verificar que al menos un servicio de email esté configurado
        const hasResend = USE_RESEND_API && RESEND_API_KEY;
        const hasMailerSend = USE_MAILERSEND_API && MAILERSEND_API_TOKEN;
        const hasSMTP = mailTransporter !== null;
        
        if (!hasResend && !hasMailerSend && !hasSMTP) {
            return res.status(503).json({ 
                error: 'Ningún servicio de correo configurado. Configure USE_RESEND_API + RESEND_API_KEY, USE_MAILERSEND_API + MAILERSEND_API_TOKEN, o SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).' 
            });
        }

        const { id } = req.params;
        const collection = db.collection(COLLECTION_NAME);
        const alumno = await collection.findOne({ id });

        if (!alumno) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        if (!alumno.email || !alumno.email.trim()) {
            return res.status(400).json({ error: 'El alumno no tiene email registrado' });
        }

        await sendStudentEmail(alumno);
        console.log(`✅ QR enviado exitosamente a ${alumno.email}`);
        res.json({ success: true, message: `QR enviado a ${alumno.email}` });
    } catch (error) {
        console.error('❌ Error enviando email con QR:', error);
        res.status(500).json({ error: error.message || 'Error al enviar el email' });
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

