/**
 * Script para ejecutar la migración de desglose de pedidos
 * Ejecutar con: node ejecutar-migracion-desglose.js
 */

const { pool } = require('./src/db/pool');
const fs = require('fs');
const path = require('path');

const ejecutarMigracion = async () => {
  try {
    console.log('🚀 Iniciando migración de desglose de pedidos...\n');
    
    // Leer archivo SQL
    const sqlPath = path.join(__dirname, 'migrations', 'add_pedido_desglose_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Archivo de migración cargado:', sqlPath);
    console.log('📦 Contenido:');
    console.log('─'.repeat(60));
    console.log(sql.substring(0, 200) + '...\n');
    console.log('─'.repeat(60));
    
    // Ejecutar migración
    console.log('\n🔧 Ejecutando migración...\n');
    const result = await pool.query(sql);
    
    console.log('✅ ¡Migración ejecutada exitosamente!\n');
    
    // Verificar que las columnas se crearon
    console.log('🔍 Verificando columnas creadas...\n');
    const verificacion = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transaccion_comercial'
      AND column_name IN ('costo_delivery', 'cupon_codigo', 'descuento_cupon', 'subtotal')
      ORDER BY column_name;
    `);
    
    if (verificacion.rows.length === 4) {
      console.log('✅ Todas las columnas se crearon correctamente:\n');
      verificacion.rows.forEach(col => {
        console.log(`   ✓ ${col.column_name.padEnd(20)} | ${col.data_type.padEnd(20)} | Default: ${col.column_default || 'NULL'}`);
      });
    } else {
      console.log(`⚠️ Se esperaban 4 columnas, pero solo se encontraron ${verificacion.rows.length}`);
    }
    
    console.log('\n🎉 ¡Migración completada! Ya puedes crear pedidos con desglose completo.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error al ejecutar la migración:', error.message);
    console.error('\nDetalles del error:');
    console.error(error);
    
    // Sugerencias según el tipo de error
    if (error.message.includes('already exists')) {
      console.log('\n💡 Las columnas ya existen. La migración ya fue ejecutada anteriormente.');
      process.exit(0);
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n💡 La tabla transaccion_comercial no existe. Ejecuta primero las migraciones base.');
    } else if (error.message.includes('connection')) {
      console.log('\n💡 Verifica que PostgreSQL esté ejecutándose y que DATABASE_URL sea correcta.');
    }
    
    process.exit(1);
  }
};

// Ejecutar migración
ejecutarMigracion();

