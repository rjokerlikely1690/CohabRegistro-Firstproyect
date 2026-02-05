// Script para actualizar automáticamente las fechas de pago al final de mes
// Ejecutar este script diariamente usando un cron job o scheduler
// Ejemplo: node actualizar-mensualidades.js

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cohabsancarlos:Papapapateto1.1@cohab.oefjuvo.mongodb.net/?appName=cohab';
const DB_NAME = process.env.DB_NAME || 'cohab';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'alumnos';

async function actualizarMensualidades() {
    let client = null;
    
    try {
        console.log('🔄 Conectando a MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Conectado a MongoDB');
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        // Obtener todos los alumnos
        const alumnos = await collection.find({}).toArray();
        console.log(`📋 Encontrados ${alumnos.length} alumnos`);
        
        const hoy = new Date();
        const diaActual = hoy.getDate();
        const mesActual = hoy.getMonth();
        const añoActual = hoy.getFullYear();
        
        let actualizados = 0;
        let sinCambios = 0;
        
        for (const alumno of alumnos) {
            if (!alumno.fechaPago) {
                console.log(`⚠️ Alumno ${alumno.nombre} sin fecha de pago, omitiendo...`);
                sinCambios++;
                continue;
            }
            
            const fechaPago = new Date(alumno.fechaPago);
            const diaPago = alumno.diaPago || 30; // Día de pago del alumno (por defecto día 30)
            
            // Si estamos en el último día del mes o después del día de pago del mes actual
            // y la fecha de pago es del mes anterior o anterior, actualizar
            const ultimoDiaDelMes = new Date(añoActual, mesActual + 1, 0).getDate();
            const esUltimoDia = diaActual >= ultimoDiaDelMes;
            const esDespuesDelDiaPago = diaActual >= diaPago;
            
            const mesPago = fechaPago.getMonth();
            const añoPago = fechaPago.getFullYear();
            
            // Verificar si necesita actualización
            const necesitaActualizacion = 
                (mesPago < mesActual || (mesPago === mesActual - 1 && añoPago === añoActual)) &&
                (esUltimoDia || esDespuesDelDiaPago);
            
            if (necesitaActualizacion) {
                // Calcular nueva fecha: día de pago del mes actual o siguiente
                let nuevaFecha;
                if (esDespuesDelDiaPago && mesPago < mesActual) {
                    // Ya pasó el día de pago este mes, ponerlo para el próximo mes
                    nuevaFecha = new Date(añoActual, mesActual + 1, diaPago);
                } else {
                    // Ponerlo para el día de pago de este mes
                    nuevaFecha = new Date(añoActual, mesActual, diaPago);
                }
                
                // Actualizar en la base de datos
                await collection.updateOne(
                    { id: alumno.id },
                    { 
                        $set: { 
                            fechaPago: nuevaFecha,
                            fechaActualizacion: new Date(),
                            actualizadoAutomaticamente: true
                        } 
                    }
                );
                
                console.log(`✅ Actualizado: ${alumno.nombre} - Nueva fecha: ${nuevaFecha.toLocaleDateString()}`);
                actualizados++;
            } else {
                sinCambios++;
            }
        }
        
        console.log('\n📊 Resumen:');
        console.log(`✅ Actualizados: ${actualizados}`);
        console.log(`➖ Sin cambios: ${sinCambios}`);
        console.log(`📋 Total procesados: ${alumnos.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 Desconectado de MongoDB');
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    actualizarMensualidades()
        .then(() => {
            console.log('✨ Proceso completado');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { actualizarMensualidades };

