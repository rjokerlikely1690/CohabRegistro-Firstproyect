// MongoDB API Server para COHAB
// Este servidor expone una API REST segura para MongoDB
// Desplegar en Railway, Render, Vercel, o similar

require('dotenv').config();
const dns = require('dns');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require('mongodb');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// En algunos entornos, la resolución DNS de registros SRV puede fallar.
// Forzamos resolvers públicos para estabilizar la conexión a MongoDB Atlas.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();

// CORS configurado para cookies cross-origin
const corsAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://cohabregistro-firstproyect.pages.dev',
    'https://cohabregistro-firstproyect.pages.dev/',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];
if (process.env.FRONTEND_URL) {
    const url = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
    if (url && !corsAllowedOrigins.includes(url)) corsAllowedOrigins.push(url);
}
const corsOptions = {
    origin: function (origin, callback) {
        // Sin origin = misma origen o peticiones tipo Postman
        if (!origin) return callback(null, true);
        if (corsAllowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        // Permitir cualquier subdominio de pages.dev
        if (origin.endsWith('.pages.dev')) return callback(null, true);
        callback(new Error('CORS no permitido para: ' + origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
    optionsSuccessStatus: 200
};

// Aplicar CORS a todas las rutas
app.use(cors(corsOptions));

// Preflight OPTIONS explícito
app.options('*', cors(corsOptions));

// Log de peticiones (diagnóstico: ver en Render/Railway que el backend recibe tráfico)
app.use((req, res, next) => {
    const path = req.path || req.url.split('?')[0];
    if (path === '/' || path === '/health') console.log('[BACKEND]', req.method, path);
    next();
});

app.use(express.json());
app.use(cookieParser());

// ============================================================
// CONFIGURACIÓN DE AUTENTICACIÓN
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'cohab-secret-key-change-in-production-2024';
const JWT_EXPIRES_IN = '24h';
const COOKIE_NAME = 'cohab_token';
const USERS_COLLECTION = 'usuarios';

// MongoDB connection string (debe venir de variables de entorno)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.@cohab.oefjuvo.mongodb.net/?appName=cohab';
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
        const isProduction = process.env.NODE_ENV === 'production';

        // Opciones de conexión con SSL/TLS mejoradas
        const clientOptions = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            tls: true,
            // En local/dev puede fallar la validación del CA bundle del sistema.
            // Mantener estricto en producción.
            tlsAllowInvalidCertificates: !isProduction,
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
        console.warn('⚠️ Continuando sin conexión a MongoDB (modo degradado)');
        // No lanzar error para permitir que el servidor inicie sin MongoDB
        // Los endpoints que requieren DB fallarán con mensaje claro
    }
}

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN JWT
// ============================================================

// Verificar token JWT desde cookie O Authorization header
function verifyToken(req, res, next) {
    // 1. Intentar obtener token de Authorization header (Bearer token)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    
    // 2. Fallback a cookie
    if (!token && req.cookies[COOKIE_NAME]) {
        token = req.cookies[COOKIE_NAME];
    }
    
    if (!token) {
        return res.status(401).json({ 
            error: 'No autenticado',
            mensaje: 'Debes iniciar sesión para acceder a este recurso'
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // Token inválido o expirado
        res.clearCookie(COOKIE_NAME);
        return res.status(401).json({ 
            error: 'Sesión inválida',
            mensaje: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        });
    }
}

// Verificar que el usuario tenga uno de los roles permitidos
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'No autenticado',
                mensaje: 'Debes iniciar sesión'
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Acceso denegado',
                mensaje: 'No tienes permisos para realizar esta acción'
            });
        }
        
        next();
    };
}

// Middleware combinado: verificar token + requerir admin
function requireAdmin(req, res, next) {
    verifyToken(req, res, (err) => {
        if (err) return; // verifyToken ya envió la respuesta
        requireRole(['admin'])(req, res, next);
    });
}

// Middleware legacy para compatibilidad (endpoints públicos)
function authMiddleware(req, res, next) {
    // Mantener compatibilidad con endpoints existentes
    // Los endpoints protegidos usarán verifyToken + requireRole
    next();
}

// Normalizar RUT chileno para URL (formato xxxxxxxx-x). Solo para incluir en QR; no reemplaza al ID.
function normalizeRutServer(str) {
    if (!str || typeof str !== 'string') return '';
    const cleaned = str.replace(/\./g, '').replace(/\s/g, '').toUpperCase().trim();
    const match = cleaned.match(/^(\d{1,8})-?([0-9K])$/);
    return match ? match[1] + '-' + match[2] : '';
}
// QR: id obligatorio; RUT obligatorio en QRs nuevos (link = ?id=ID&rut=XXXXXXXX-X). Compatible con links antiguos sin rut.
function buildStudentUrl(alumno) {
    const id = (alumno && (alumno.id != null && alumno.id !== '' ? String(alumno.id) : (alumno._id ? String(alumno._id) : ''))) || '';
    if (!id) return null;
    const base = (PUBLIC_BASE_URL || 'https://cohabregistro-firstproyect.pages.dev/').trim().replace(/\/$/, '') + '/';
    let url = `${base}alumno.html?id=${encodeURIComponent(id)}`;
    const rut = alumno.rut ? normalizeRutServer(String(alumno.rut)) : '';
    if (rut) url += '&rut=' + encodeURIComponent(rut);
    return url;
}

async function generateQrBuffer(alumno) {
    const url = buildStudentUrl(alumno);
    if (!url || url.indexOf('?id=') === -1) {
        throw new Error('URL del alumno inválida: falta id');
    }
    return QRCode.toBuffer(url, {
        type: 'png',
        width: 400,
        margin: 1
    });
}

// Generar template HTML profesional para email del alumno
function generateEmailTemplate(alumno, alumnoUrl, qrBase64) {
    const monto = Number(alumno.monto || 0).toFixed(2);
    const fechaPago = alumno.fechaPago ? new Date(alumno.fechaPago).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'No registrada';
    
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu acceso a COHAB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0d0d0d; line-height: 1.6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0d0d0d; padding: 20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: 0.02em;">COHAB BJJ</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">Tu acceso personal</p>
                        </td>
                    </tr>
                    
                    <!-- Contenido principal -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #dc2626; font-size: 24px; font-weight: 700;">Hola ${alumno.nombre},</h2>
                            <p style="margin: 0 0 30px 0; color: #e5e5e5; font-size: 16px;">Te enviamos tu código QR personal para consultar el estado de tus pagos en cualquier momento.</p>
                            
                            <!-- QR Code Card -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 700;">Código QR</p>
                                        <img src="data:image/png;base64,${qrBase64}" alt="QR Code - ${alumno.nombre}" style="max-width: 280px; width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 8px;" />
                                        <p style="margin: 20px 0 0 0; color: #666; font-size: 14px; font-family: monospace; word-break: break-all;">ID: ${alumno.id}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Información del alumno -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #2a2a2a; border-radius: 8px; padding: 0; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <table role="presentation" width="100%" cellpadding="8" cellspacing="0">
                                            <tr>
                                                <td style="color: #a1a1aa; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #3a3a3a;">Nombre</td>
                                                <td style="color: #ffffff; font-size: 14px; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #3a3a3a; text-align: right;">${alumno.nombre}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #a1a1aa; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #3a3a3a;">Último pago</td>
                                                <td style="color: #ffffff; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #3a3a3a; text-align: right;">${fechaPago}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #a1a1aa; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #3a3a3a;">Monto mensual</td>
                                                <td style="color: #dc2626; font-size: 16px; font-weight: 700; padding: 8px 0; border-bottom: 1px solid #3a3a3a; text-align: right;">$${monto}</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #a1a1aa; font-size: 14px; padding: 8px 0;">ID de alumno</td>
                                                <td style="color: #ffffff; font-size: 12px; font-family: monospace; padding: 8px 0; text-align: right; word-break: break-all;">${alumno.id}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Botón CTA -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${alumnoUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 2px 8px rgba(220,38,38,0.3);">Ver mi estado de pago</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Instrucciones -->
                            <div style="background-color: #1a1a1a; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 600;">📱 Cómo usar tu QR:</p>
                                <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #a1a1aa; font-size: 14px;">
                                    <li style="margin-bottom: 6px;">Escanea el código QR con la cámara de tu teléfono</li>
                                    <li style="margin-bottom: 6px;">O haz clic en el botón "Ver mi estado de pago"</li>
                                    <li style="margin-bottom: 0;">Guarda este email para consultar cuando lo necesites</li>
                                </ul>
                            </div>
                            
                            <!-- Link alternativo -->
                            <p style="margin: 20px 0 0 0; color: #666; font-size: 12px; text-align: center;">
                                O copia este enlace: <a href="${alumnoUrl}" style="color: #dc2626; text-decoration: underline; word-break: break-all;">${alumnoUrl}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0d0d0d; padding: 30px 40px; text-align: center; border-top: 1px solid #2a2a2a;">
                            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px; font-weight: 600;">Academia COHAB BJJ</p>
                            <p style="margin: 0; color: #666; font-size: 12px;">El Alba 12620, Las Condes</p>
                            <p style="margin: 12px 0 0 0; color: #666; font-size: 12px;">Si tienes dudas, contáctanos por WhatsApp o email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
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
            const emailHtml = generateEmailTemplate(alumno, alumnoUrl, qrBase64);

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
            const emailHtml = generateEmailTemplate(alumno, alumnoUrl, qrBase64);

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
        html: generateEmailTemplate(alumno, alumnoUrl, qrBase64),
        attachments: [
            {
                filename: `qr-${alumno.id}.png`,
                content: qrBuffer,
                contentType: 'image/png'
            }
        ]
    });
}

// ============================================================
// ENDPOINTS DE AUTENTICACIÓN
// ============================================================

// POST /auth/login - Iniciar sesión
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Datos incompletos',
                mensaje: 'Email y contraseña son requeridos'
            });
        }
        
        const usersCollection = db.collection(USERS_COLLECTION);
        const user = await usersCollection.findOne({ 
            email: email.toLowerCase().trim(),
            activo: { $ne: false }
        });
        
        if (!user) {
            return res.status(401).json({
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos'
            });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                error: 'Credenciales inválidas',
                mensaje: 'Email o contraseña incorrectos'
            });
        }
        
        // Crear JWT
        const tokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            nombre: user.nombre
        };
        
        if (user.alumnoId) {
            tokenPayload.alumnoId = user.alumnoId.toString();
        }
        
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        
        // Configurar cookie - SIEMPRE usar secure+sameSite=none para cross-origin
        // (Cloudflare Pages frontend + Render backend son diferentes orígenes)
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,           // Requerido para SameSite=None
            sameSite: 'none',       // Requerido para cross-origin cookies
            maxAge: 24 * 60 * 60 * 1000, // 24 horas
            path: '/'
        });
        
        // Actualizar último login
        await usersCollection.updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );
        
        console.log(`✅ Login exitoso: ${user.email} (${user.role})`);
        
        // Devolver token en body (para clientes que no pueden usar cookies cross-origin)
        res.json({
            success: true,
            token: token,  // Token para guardar en localStorage
            user: {
                id: user._id.toString(),
                email: user.email,
                nombre: user.nombre,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({
            error: 'Error interno',
            mensaje: 'Error al procesar el inicio de sesión'
        });
    }
});

// POST /auth/logout - Cerrar sesión
app.post('/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
    });
    
    res.json({
        success: true,
        mensaje: 'Sesión cerrada correctamente'
    });
});

// GET /auth/me - Obtener usuario actual
app.get('/auth/me', verifyToken, async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION);
        const user = await usersCollection.findOne({ 
            _id: new ObjectId(req.user.userId) 
        });
        
        if (!user || user.activo === false) {
            res.clearCookie(COOKIE_NAME);
            return res.status(401).json({
                error: 'Usuario no encontrado',
                mensaje: 'Tu cuenta ya no existe o fue desactivada'
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: user._id.toString(),
                email: user.email,
                nombre: user.nombre,
                role: user.role,
                alumnoId: user.alumnoId ? user.alumnoId.toString() : null
            }
        });
        
    } catch (error) {
        console.error('❌ Error en /auth/me:', error);
        res.status(500).json({
            error: 'Error interno',
            mensaje: 'Error al obtener información del usuario'
        });
    }
});

// Clave opcional para acceder a la sección Gestión de Alumnos (variable de entorno)
const GESTION_CLAVE = (process.env.GESTION_CLAVE || '').trim();

// POST /auth/verificar-gestion - Validar clave de Gestión de Alumnos (no requiere token)
app.post('/auth/verificar-gestion', (req, res) => {
    const clave = (req.body && req.body.clave != null) ? String(req.body.clave).trim() : '';
    if (!GESTION_CLAVE) {
        return res.json({ ok: true });
    }
    if (clave === GESTION_CLAVE) {
        return res.json({ ok: true });
    }
    return res.status(401).json({ ok: false, mensaje: 'Clave incorrecta' });
});

// GET /auth/gestion-requiere-clave - Saber si el backend exige clave para Gestión (para mostrar/ocultar overlay)
app.get('/auth/gestion-requiere-clave', (req, res) => {
    res.json({ requiereClave: !!GESTION_CLAVE });
});

// ============================================================
// ENDPOINTS DE GESTIÓN DE USUARIOS (Solo Admin)
// ============================================================

// GET /usuarios - Listar usuarios (solo admin)
app.get('/usuarios', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const usersCollection = db.collection(USERS_COLLECTION);
        const users = await usersCollection.find({}).project({ password: 0 }).toArray();
        res.json({ data: users });
    } catch (error) {
        console.error('Error listando usuarios:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /usuarios - Crear usuario (solo admin)
app.post('/usuarios', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { email, password, nombre, role, alumnoId } = req.body;
        
        if (!email || !password || !nombre || !role) {
            return res.status(400).json({
                error: 'Datos incompletos',
                mensaje: 'Email, password, nombre y role son requeridos'
            });
        }
        
        if (!['admin', 'usuario'].includes(role)) {
            return res.status(400).json({
                error: 'Rol inválido',
                mensaje: 'El rol debe ser "admin" o "usuario"'
            });
        }
        
        // Usuario tipo "usuario" debe tener alumnoId
        if (role === 'usuario' && !alumnoId) {
            return res.status(400).json({
                error: 'Datos incompletos',
                mensaje: 'Los usuarios tipo "usuario" deben estar vinculados a un alumno'
            });
        }
        
        const usersCollection = db.collection(USERS_COLLECTION);
        
        // Verificar email único
        const existing = await usersCollection.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({
                error: 'Email duplicado',
                mensaje: 'Ya existe un usuario con ese email'
            });
        }
        
        // Hash del password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            nombre: nombre.trim(),
            role,
            alumnoId: alumnoId ? new ObjectId(alumnoId) : null,
            activo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null
        };
        
        const result = await usersCollection.insertOne(newUser);
        
        console.log(`✅ Usuario creado: ${email} (${role})`);
        
        res.status(201).json({
            success: true,
            id: result.insertedId.toString()
        });
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /usuarios/:id - Desactivar usuario (solo admin)
app.delete('/usuarios/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        // No permitir que el admin se elimine a sí mismo
        if (req.user.userId === id) {
            return res.status(400).json({
                error: 'Operación no permitida',
                mensaje: 'No puedes desactivar tu propia cuenta'
            });
        }
        
        const usersCollection = db.collection(USERS_COLLECTION);
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { activo: false, updatedAt: new Date() } }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error desactivando usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// ENDPOINTS DE ALUMNOS (Protegidos para Admin)
// ============================================================

// GET /alumnos - Listar todos los alumnos (incluye estado de suscripción calculado en backend)
// ?debug=1 añade en cada alumno _debug: { fechaPagoISO, proximoPago, diasRestantes, hoyISO } para ver qué fechas usa el backend
// PROTEGIDO: Solo admin
app.get('/alumnos', verifyToken, requireRole(['admin']), async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    try {
        const debug = req.query.debug === '1' || req.query.debug === 'true';
        const collection = db.collection(COLLECTION_NAME);
        const raw = await collection.find({}).sort({ nombre: 1 }).toArray();
        const alumnos = raw.map((a) => {
            const alumno = { ...a };
            try {
                if (!alumno.fechaPago) {
                    alumno.estado = 'SIN_DATOS';
                    alumno.acceso = false;
                    alumno.diasRestantes = -999;
                    alumno.proximoPago = null;
                    alumno.mensaje = 'Sin fecha de pago';
                    alumno.clase = 'atrasado';
                    alumno.texto = 'Sin pago registrado';
                    if (debug) alumno._debug = { fechaPagoISO: null, proximoPago: null, diasRestantes: -999, hoyISO: new Date().toISOString().slice(0, 10) };
                    return alumno;
                }
                const calc = calcularEstadoSuscripcion(alumno);
                alumno.estado = calc.estado;
                alumno.acceso = calc.acceso;
                alumno.diasRestantes = calc.diasRestantes;
                alumno.proximoPago = calc.proximoPago;
                alumno.mensaje = calc.mensaje;
                if (!calc.acceso) {
                    alumno.clase = 'atrasado';
                    const d = calc.diasDelMesVencido != null ? calc.diasDelMesVencido : Math.abs(calc.diasRestantes);
                    alumno.texto = d === 1 ? '1 día de atraso' : `${d} días de atraso`;
                    alumno.diasDelMesVencido = calc.diasDelMesVencido;
                } else if (calc.diasRestantes <= 7) {
                    alumno.clase = 'proximo';
                    alumno.texto = calc.diasRestantes === 0 ? 'Vence hoy' : `${calc.diasRestantes} días restantes`;
                } else {
                    alumno.clase = 'al-dia';
                    alumno.texto = `${calc.diasRestantes} días restantes`;
                }
                if (debug) {
                    const fp = new Date(alumno.fechaPago);
                    alumno._debug = {
                        fechaPagoISO: fp.toISOString ? fp.toISOString().slice(0, 10) : String(alumno.fechaPago),
                        proximoPago: calc.proximoPago ? calc.proximoPago.slice(0, 10) : null,
                        diasRestantes: calc.diasRestantes,
                        diasDelMesVencido: calc.diasDelMesVencido,
                        diaPago: parseInt(alumno.diaPago) || 30,
                        hoyISO: new Date().toISOString().slice(0, 10)
                    };
                }
            } catch (err) {
                alumno.estado = 'ERROR';
                alumno.acceso = false;
                alumno.diasRestantes = -999;
                alumno.proximoPago = null;
                alumno.mensaje = err.message || 'Error al calcular estado';
                alumno.clase = 'atrasado';
                alumno.texto = 'Sin datos';
                if (debug) alumno._debug = { error: err.message, hoyISO: new Date().toISOString().slice(0, 10) };
            }
            return alumno;
        });
        const payload = { data: alumnos };
        if (debug) payload._debugHoy = new Date().toISOString();
        res.json(payload);
    } catch (error) {
        console.error('Error listando alumnos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generar ID corto para nuevos alumnos (8–10 caracteres, legible). No se usa para alumnos existentes.
function generarIdCorto() {
    const prefijo = 'ALU-';
    const digitos = String(Math.floor(1000 + Math.random() * 9000)); // 4 dígitos: 1000–9999
    return prefijo + digitos; // ej: ALU-4821 (8 caracteres)
}
async function generarIdCortoUnico(collection) {
    const maxIntentos = 20;
    for (let i = 0; i < maxIntentos; i++) {
        const id = generarIdCorto();
        const existente = await collection.findOne({ id });
        if (!existente) return id;
    }
    // Fallback muy improbable: añadir sufijo
    return generarIdCorto() + '-' + Date.now().toString(36).slice(-4);
}

// POST /alumnos - Crear nuevo alumno (PROTEGIDO: Solo admin)
app.post('/alumnos', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const alumno = req.body;
        const collection = db.collection(COLLECTION_NAME);

        // ID: si viene, respetarlo; si no, generar ID corto (solo nuevos alumnos). No tocar existentes.
        if (!alumno.id || String(alumno.id).trim() === '') {
            alumno.id = await generarIdCortoUnico(collection);
        }
        
        // Convertir fecha si es necesario
        if (alumno.fechaPago) {
            alumno.fechaPago = new Date(alumno.fechaPago);
        }
        
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

// PUT /alumnos - Actualizar o crear alumno (upsert) (PROTEGIDO: Solo admin)
app.put('/alumnos', verifyToken, requireRole(['admin']), async (req, res) => {
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

// DELETE /alumnos/:id - Eliminar alumno (PROTEGIDO: Solo admin)
app.delete('/alumnos/:id', verifyToken, requireRole(['admin']), async (req, res) => {
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

// PATCH /alumnos/:id/pago - Registrar pago (PROTEGIDO: Solo admin)
app.patch('/alumnos/:id/pago', verifyToken, requireRole(['admin']), async (req, res) => {
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

// FUNCIÓN ÚNICA DE CÁLCULO DE ESTADO - FUENTE ÚNICA DE VERDAD
// Esta función calcula el estado de la suscripción basándose en:
// - fechaPago: ISO string en UTC
// - diaPago: día fijo de corte mensual (1-31)
// Reglas:
// - diasRestantes >= 0 → ACTIVA (acceso: true)
// - diasRestantes < 0 → VENCIDA (acceso: false)
// - No hay días de gracia
// - Pago exactamente el día de vencimiento → ACTIVA
function calcularEstadoSuscripcion(alumno) {
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0); // Normalizar a medianoche UTC
    
    // Parsear fechaPago desde ISO string
    let fechaPago = new Date(alumno.fechaPago);
    if (isNaN(fechaPago.getTime())) {
        throw new Error('Fecha de pago inválida');
    }
    fechaPago.setUTCHours(0, 0, 0, 0);
    
    // Obtener día de pago (1-31)
    const diaPago = parseInt(alumno.diaPago) || 30;
    if (diaPago < 1 || diaPago > 31) {
        throw new Error('Día de pago inválido (debe ser 1-31)');
    }
    
    // PASO 1: Determinar a qué mes corresponde realmente el último pago
    let vencimientoMesActual = new Date(Date.UTC(fechaPago.getUTCFullYear(), fechaPago.getUTCMonth(), diaPago));
    if (vencimientoMesActual.getUTCDate() !== diaPago) {
        // Si el día no existe (ej: 31 en febrero) ajustar al último día del mes
        vencimientoMesActual = new Date(Date.UTC(fechaPago.getUTCFullYear(), fechaPago.getUTCMonth() + 1, 0));
    }

    let mesVencimientoPago;
    if (fechaPago < vencimientoMesActual) {
        // Pago realizado antes del día de vencimiento → corresponde al mes anterior
        mesVencimientoPago = new Date(Date.UTC(fechaPago.getUTCFullYear(), fechaPago.getUTCMonth() - 1, diaPago));
        if (mesVencimientoPago.getUTCDate() !== diaPago) {
            mesVencimientoPago = new Date(Date.UTC(fechaPago.getUTCFullYear(), fechaPago.getUTCMonth(), 0));
        }
    } else {
        // Pago realizado el mismo día o después del vencimiento → corresponde al mes actual
        mesVencimientoPago = new Date(vencimientoMesActual);
    }

    // PASO 2: Calcular el próximo vencimiento (mes siguiente al mes efectivo del pago)
    let proximoPago = new Date(Date.UTC(mesVencimientoPago.getUTCFullYear(), mesVencimientoPago.getUTCMonth() + 1, diaPago));
    if (proximoPago.getUTCDate() !== diaPago) {
        proximoPago = new Date(Date.UTC(mesVencimientoPago.getUTCFullYear(), mesVencimientoPago.getUTCMonth() + 2, 0));
    }
    proximoPago.setUTCHours(0, 0, 0, 0);

    // PASO 3: Calcular días restantes SIN avanzar meses automáticamente
    // Si el próximo vencimiento ya pasó, el alumno está atrasado (diasRestantes negativo)
    const diasRestantes = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
    
    // REGLA DE NEGOCIO: diasRestantes >= 0 → ACTIVA, < 0 → VENCIDA
    const acceso = diasRestantes >= 0;
    
    // Cuando está vencido: cuenta los días del mes (1, 2, 3... 31). Al cambiar de mes se reinicia a 1.
    // Ej: día 3 del mes → 3 días de atraso; día 1 del mes siguiente (sin pagar) → 1 día de atraso.
    const diasDelMesVencido = acceso ? 0 : hoy.getUTCDate();
    
    return {
        acceso: acceso,
        diasRestantes: diasRestantes,
        diasDelMesVencido: diasDelMesVencido,
        proximoPago: proximoPago.toISOString(),
        estado: acceso ? 'ACTIVA' : 'VENCIDA',
        mensaje: acceso 
            ? `Suscripción activa. ${diasRestantes} días restantes.`
            : (diasDelMesVencido === 1 
                ? 'Suscripción vencida. 1 día de atraso.' 
                : `Suscripción vencida. ${diasDelMesVencido} días de atraso.`)
    };
}

// GET /alumnos/:id/validar - VALIDAR SUSCRIPCIÓN (ENDPOINT PRINCIPAL)
// Este es el único endpoint que debe usarse para validar suscripciones
// Responde en formato binario: { acceso: true/false, ... }
app.get('/alumnos/:id/validar', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || id.trim() === '') {
            return res.status(400).json({ 
                acceso: false,
                error: 'ID requerido',
                mensaje: 'ID de alumno no proporcionado'
            });
        }
        
        const collection = db.collection(COLLECTION_NAME);
        const alumno = await collection.findOne({ id: id.trim() });
        
        if (!alumno) {
            return res.status(404).json({ 
                acceso: false,
                error: 'Alumno no encontrado',
                mensaje: `No se encontró un alumno con el ID: ${id}`
            });
        }
        
        // Validar que el alumno tenga los campos necesarios
        if (!alumno.fechaPago) {
            return res.status(400).json({ 
                acceso: false,
                error: 'Datos incompletos',
                mensaje: 'El alumno no tiene fecha de pago registrada'
            });
        }
        
        // Calcular estado usando la función única
        const resultado = calcularEstadoSuscripcion(alumno);
        
        // Asegurar que el alumno tenga id (para QR y enlaces); si no, usar _id o el id de la URL
        const alumnoId = alumno.id != null ? String(alumno.id) : (alumno._id ? String(alumno._id) : id.trim());
        // Evitar caché: la página debe mostrar siempre datos actualizados (sincronizados con BD)
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json({
            acceso: resultado.acceso,
            estado: resultado.estado,
            diasRestantes: resultado.diasRestantes,
            diasDelMesVencido: resultado.diasDelMesVencido,
            proximoPago: resultado.proximoPago,
            mensaje: resultado.mensaje,
            alumno: {
                id: alumnoId,
                nombre: alumno.nombre,
                email: alumno.email || null,
                telefono: alumno.telefono || null,
                monto: alumno.monto || null,
                fechaPago: alumno.fechaPago || null,
                rut: alumno.rut || null
            }
        });
    } catch (error) {
        console.error('❌ Error validando suscripción:', error);
        res.status(500).json({ 
            acceso: false,
            error: 'Error interno del servidor',
            mensaje: error.message || 'Error al validar la suscripción'
        });
    }
});

// POST /alumnos/:id/enviar-qr - Enviar QR por email (PROTEGIDO: Solo admin)
app.post('/alumnos/:id/enviar-qr', verifyToken, requireRole(['admin']), async (req, res) => {
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
        version: '2.0.0',
        status: 'running',
        database: db ? 'connected' : 'disconnected',
        endpoints: {
            auth: {
                'POST /auth/login': 'Iniciar sesión',
                'POST /auth/logout': 'Cerrar sesión',
                'GET /auth/me': 'Obtener usuario actual (requiere auth)',
                'GET /auth/gestion-requiere-clave': '¿Gestión de Alumnos exige clave?',
                'POST /auth/verificar-gestion': 'Validar clave de Gestión (body: { clave })'
            },
            usuarios: {
                'GET /usuarios': 'Listar usuarios (admin)',
                'POST /usuarios': 'Crear usuario (admin)',
                'DELETE /usuarios/:id': 'Desactivar usuario (admin)'
            },
            alumnos: {
                'GET /alumnos': 'Listar todos los alumnos (admin)',
                'GET /alumnos/:id/validar': 'Validar suscripción (PÚBLICO)',
                'POST /alumnos': 'Crear nuevo alumno (admin)',
                'PUT /alumnos': 'Actualizar o crear alumno (admin)',
                'DELETE /alumnos/:id': 'Eliminar alumno (admin)',
                'PATCH /alumnos/:id/pago': 'Registrar pago (admin)'
            },
            health: {
            'GET /health': 'Health check'
            }
        },
        usage: 'API backend con autenticación JWT. Los endpoints marcados (admin) requieren cookie de sesión.'
    });
});

// Health check (incluye versión para verificar que el backend desplegado tiene la corrección de estado)
const BACKEND_VERSION = '6.0-diasDelMes';
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        db: db ? 'connected' : 'disconnected',
        version: BACKEND_VERSION,
        auth: 'JWT Bearer token + cookie',
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

async function start() {
    await connectDB(); // Intenta conectar, pero no bloquea si falla
    const host = process.env.HOST || '0.0.0.0';
    app.listen(PORT, host, () => {
        console.log(`🚀 Servidor MongoDB API corriendo en http://${host}:${PORT}`);
        console.log(`📡 Endpoints disponibles:`);
        console.log(`   GET    /alumnos`);
        console.log(`   GET    /alumnos/:id/validar`);
        console.log(`   POST   /alumnos`);
        console.log(`   PUT    /alumnos`);
        console.log(`   DELETE /alumnos/:id`);
        console.log(`   PATCH  /alumnos/:id/pago`);
        if (!db) {
            console.warn('⚠️ MongoDB no conectado - algunos endpoints pueden fallar');
        }
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

