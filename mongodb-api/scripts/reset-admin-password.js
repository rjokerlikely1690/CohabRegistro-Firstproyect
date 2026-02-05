// Script para resetear la contraseña del admin
// Ejecutar con: node scripts/reset-admin-password.js

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.@cohab.oefjuvo.mongodb.net/?appName=cohab';
const DB_NAME = process.env.DB_NAME || 'cohab';

// Nueva contraseña para el admin
const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD || 'Admin123!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cohab.cl';

async function resetPassword() {
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
        
        // Buscar admin
        const admin = await usersCollection.findOne({ email: ADMIN_EMAIL.toLowerCase() });
        
        if (!admin) {
            console.log('❌ No se encontró usuario con email:', ADMIN_EMAIL);
            console.log('   Creando nuevo admin...');
            
            const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
            await usersCollection.insertOne({
                email: ADMIN_EMAIL.toLowerCase(),
                password: hashedPassword,
                nombre: 'Administrador COHAB',
                role: 'admin',
                alumnoId: null,
                activo: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            console.log('✅ Admin creado!');
        } else {
            // Actualizar contraseña
            const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
            
            await usersCollection.updateOne(
                { email: ADMIN_EMAIL.toLowerCase() },
                { 
                    $set: { 
                        password: hashedPassword,
                        nombre: admin.nombre || 'Administrador COHAB',
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log('✅ Contraseña actualizada!');
        }
        
        console.log('');
        console.log('   ╔════════════════════════════════════════╗');
        console.log('   ║       CREDENCIALES DE ADMIN            ║');
        console.log('   ╠════════════════════════════════════════╣');
        console.log(`   ║  Email:    ${ADMIN_EMAIL.padEnd(27)}║`);
        console.log(`   ║  Password: ${NEW_PASSWORD.padEnd(27)}║`);
        console.log('   ╚════════════════════════════════════════╝');
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

resetPassword();
