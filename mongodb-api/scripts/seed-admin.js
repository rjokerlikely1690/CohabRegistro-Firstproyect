// Script para crear el usuario admin inicial
// Ejecutar con: npm run seed-admin
// O directamente: node scripts/seed-admin.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// Configuración desde variables de entorno o valores por defecto
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.1@cohab.oefjuvo.mongodb.net/?appName=cohab';
const DB_NAME = process.env.DB_NAME || 'cohab';

// Datos del admin inicial (cambiar después del primer uso)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cohab.cl';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
const ADMIN_NOMBRE = process.env.ADMIN_NOMBRE || 'Administrador COHAB';

async function seedAdmin() {
    let client;
    
    try {
        console.log('🔄 Conectando a MongoDB...');
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            tls: true,
            tlsAllowInvalidCertificates: true
        });
        
        await client.connect();
        const db = client.db(DB_NAME);
        const usersCollection = db.collection('usuarios');
        
        console.log('✅ Conectado a MongoDB');
        
        // Verificar si ya existe un admin
        const existingAdmin = await usersCollection.findOne({ role: 'admin' });
        
        if (existingAdmin) {
            console.log('⚠️  Ya existe un usuario admin:');
            console.log(`   Email: ${existingAdmin.email}`);
            console.log(`   Nombre: ${existingAdmin.nombre}`);
            console.log('   Si necesitas crear otro admin, usa el endpoint POST /usuarios');
            return;
        }
        
        // Crear hash del password
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        
        // Crear usuario admin
        const adminUser = {
            email: ADMIN_EMAIL.toLowerCase().trim(),
            password: hashedPassword,
            nombre: ADMIN_NOMBRE,
            role: 'admin',
            alumnoId: null,
            activo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null
        };
        
        const result = await usersCollection.insertOne(adminUser);
        
        console.log('');
        console.log('✅ Usuario admin creado exitosamente!');
        console.log('');
        console.log('   ╔════════════════════════════════════════╗');
        console.log('   ║       CREDENCIALES DE ACCESO           ║');
        console.log('   ╠════════════════════════════════════════╣');
        console.log(`   ║  Email:    ${ADMIN_EMAIL.padEnd(27)}║`);
        console.log(`   ║  Password: ${ADMIN_PASSWORD.padEnd(27)}║`);
        console.log('   ╚════════════════════════════════════════╝');
        console.log('');
        console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión!');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('📡 Conexión cerrada');
        }
    }
}

seedAdmin();
