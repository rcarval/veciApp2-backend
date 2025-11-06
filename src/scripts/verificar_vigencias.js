/**
 * Script para verificar vigencias de suscripciones y desactivar productos
 * Se puede ejecutar manualmente o configurar como cron job
 * 
 * Ejecución manual:
 * node src/scripts/verificar_vigencias.js
 * 
 * O configurar como cron job (ejecutar diariamente a las 00:00):
 * 0 0 * * * cd /path/to/backend && node src/scripts/verificar_vigencias.js
 */

const { pool } = require('../db/pool');
const logger = require('../utils/logger');

async function verificarYDesactivarProductos() {
  try {
    logger.info('🔄 Iniciando verificación de vigencias de suscripciones...');
    
    // Buscar usuarios con plan Premium cuya vigencia haya expirado
    const { rows: usuariosExpirados } = await pool.query(
      `SELECT id, email, plan_id, vigencia_hasta 
       FROM usuarios 
       WHERE plan_id = 2 
         AND vigencia_hasta IS NOT NULL 
         AND vigencia_hasta < NOW()`
    );
    
    if (usuariosExpirados.length === 0) {
      logger.info('✓ No hay suscripciones expiradas');
      return;
    }
    
    logger.info(`⚠️  Encontrados ${usuariosExpirados.length} usuarios con suscripción expirada`);
    
    let totalProductosDesactivados = 0;
    let totalUsuariosActualizados = 0;
    
    // Procesar cada usuario en una transacción
    for (const usuario of usuariosExpirados) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Desactivar todos los productos del usuario
        const { rows: productosDesactivados } = await client.query(
          `UPDATE productos p
           SET activo = false
           FROM emprendimientos e
           WHERE p.emprendimiento_id = e.id 
             AND e.usuario_id = $1
             AND p.activo = true
           RETURNING p.id, p.nombre`,
          [usuario.id]
        );
        
        // Cambiar usuario a plan básico
        await client.query(
          `UPDATE usuarios 
           SET plan_id = NULL, 
               estado_suscripcion = NULL, 
               fecha_suscripcion = NULL, 
               vigencia_hasta = NULL
           WHERE id = $1`,
          [usuario.id]
        );
        
        await client.query('COMMIT');
        
        totalProductosDesactivados += productosDesactivados.length;
        totalUsuariosActualizados++;
        
        logger.success(
          `✓ Usuario ${usuario.email} (ID: ${usuario.id}): ` +
          `Plan cambiado a Básico, ${productosDesactivados.length} productos desactivados`
        );
        
        if (productosDesactivados.length > 0) {
          logger.db(`  Productos desactivados: ${productosDesactivados.map(p => p.nombre).join(', ')}`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`❌ Error procesando usuario ${usuario.id}: ${err.message}`);
      } finally {
        client.release();
      }
    }
    
    logger.success(
      `\n📊 Resumen de verificación:` +
      `\n   - Usuarios actualizados: ${totalUsuariosActualizados}` +
      `\n   - Productos desactivados: ${totalProductosDesactivados}` +
      `\n   - Fecha: ${new Date().toLocaleString('es-CL')}\n`
    );
    
  } catch (error) {
    logger.error('❌ Error en verificación de vigencias:', error.message);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  verificarYDesactivarProductos()
    .then(() => {
      logger.success('✓ Verificación completada exitosamente');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('❌ Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { verificarYDesactivarProductos };




