require('dotenv').config()
const { pool } = require('../db/pool')
const logger = require('../utils/logger')

async function setupCategorias() {
  const client = await pool.connect()
  
  try {
    logger.info('🚀 Iniciando configuración de categorías...')
    
    // 0. Eliminar tablas existentes si existen (con CASCADE para eliminar subcategorías primero)
    await client.query(`DROP TABLE IF EXISTS subcategorias CASCADE`)
    await client.query(`DROP TABLE IF EXISTS categorias CASCADE`)
    logger.info('✓ Tablas anteriores eliminadas')
    
    // 1. Crear tabla de categorías
    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        icono VARCHAR(50),
        color VARCHAR(7),
        orden INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    logger.info('✓ Tabla categorias creada')
    
    // 2. Crear tabla de subcategorías
    await client.query(`
      CREATE TABLE IF NOT EXISTS subcategorias (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
        codigo VARCHAR(50) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        icono VARCHAR(50),
        orden INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(categoria_id, codigo)
      )
    `)
    logger.info('✓ Tabla subcategorias creada')
    
    // 3. Crear índices
    await client.query(`CREATE INDEX IF NOT EXISTS idx_categorias_orden ON categorias(orden)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias(categoria_id)`)
    logger.info('✓ Índices creados')
    
    // 4. Insertar categorías principales
    await client.query(`
      INSERT INTO categorias (codigo, nombre, descripcion, icono, color, orden) VALUES
      ('comida', 'Comida Preparada', 'Restaurantes, comida rápida y preparaciones', 'restaurant', '#FF6B6B', 1),
      ('servicios', 'Servicios Locales', 'Servicios profesionales y técnicos', 'construct', '#4ECDC4', 2),
      ('negocios', 'Tiendas & Negocios', 'Comercio local y retail', 'storefront', '#95E1D3', 3),
      ('belleza', 'Belleza & Bienestar', 'Salones, spa y estética', 'cut', '#F38181', 4)
      ON CONFLICT (codigo) DO NOTHING
    `)
    logger.info('✓ Categorías principales insertadas')
    
    // 5. Insertar subcategorías por categoría
    const subcategoriasComida = [
      'sushi', 'pizza', 'hamburguesas', 'sandwiches', 'comida_casera', 'comida_peruana',
      'comida_china', 'comida_oriental', 'pasteleria', 'vegetariano', 'comida_rapida',
      'mariscos', 'carnes', 'otro'
    ]
    
    for (let i = 0; i < subcategoriasComida.length; i++) {
      const codigo = subcategoriasComida[i]
      const nombre = codigo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      const orden = codigo === 'otro' ? 99 : i + 1
      
      await client.query(`
        INSERT INTO subcategorias (categoria_id, codigo, nombre, orden)
        SELECT id, $1, $2, $3 FROM categorias WHERE codigo = 'comida'
        ON CONFLICT (categoria_id, codigo) DO NOTHING
      `, [codigo, nombre, orden])
    }
    logger.info('✓ Subcategorías de Comida insertadas')
    
    // Servicios
    const subcategoriasServicios = [
      'construccion', 'pintura', 'gasfiteria', 'electricidad', 'computadores',
      'jardineria', 'mudanzas', 'limpieza', 'reparaciones', 'diseño', 'otro'
    ]
    
    for (let i = 0; i < subcategoriasServicios.length; i++) {
      const codigo = subcategoriasServicios[i]
      const nombre = codigo === 'gasfiteria' ? 'Gasfitería' : codigo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      const orden = codigo === 'otro' ? 99 : i + 1
      
      await client.query(`
        INSERT INTO subcategorias (categoria_id, codigo, nombre, orden)
        SELECT id, $1, $2, $3 FROM categorias WHERE codigo = 'servicios'
        ON CONFLICT (categoria_id, codigo) DO NOTHING
      `, [codigo, nombre, orden])
    }
    logger.info('✓ Subcategorías de Servicios insertadas')
    
    // Negocios
    const subcategoriasNegocios = [
      { codigo: 'almacen', nombre: 'Almacén' },
      { codigo: 'panaderia', nombre: 'Panadería' },
      { codigo: 'verduleria', nombre: 'Verdulería' },
      { codigo: 'carniceria', nombre: 'Carnicería' },
      { codigo: 'pescaderia', nombre: 'Pescadería' },
      { codigo: 'minimarket', nombre: 'Minimarket' },
      { codigo: 'licoreria', nombre: 'Licorería' },
      { codigo: 'ferreteria', nombre: 'Ferretería' },
      { codigo: 'floreria', nombre: 'Florería' },
      { codigo: 'libreria', nombre: 'Librería' },
      { codigo: 'mascotas', nombre: 'Mascotas' },
      { codigo: 'bazar', nombre: 'Bazar' },
      { codigo: 'ropa_bebe', nombre: 'Ropa de Bebe' },
      { codigo: 'vestimenta', nombre: 'Vestimenta' },
      { codigo: 'zapateria', nombre: 'Zapatería' },
      { codigo: 'orfebreria', nombre: 'Orfebrería' },
      { codigo: 'otro', nombre: 'Otro' }
    ]
    
    for (let i = 0; i < subcategoriasNegocios.length; i++) {
      const { codigo, nombre } = subcategoriasNegocios[i]
      const orden = codigo === 'otro' ? 99 : i + 1
      
      await client.query(`
        INSERT INTO subcategorias (categoria_id, codigo, nombre, orden)
        SELECT id, $1, $2, $3 FROM categorias WHERE codigo = 'negocios'
        ON CONFLICT (categoria_id, codigo) DO NOTHING
      `, [codigo, nombre, orden])
    }
    logger.info('✓ Subcategorías de Negocios insertadas')
    
    // Belleza
    const subcategoriasBelleza = [
      { codigo: 'spa', nombre: 'Spa' },
      { codigo: 'manicure', nombre: 'Manicure' },
      { codigo: 'peluqueria', nombre: 'Peluquería' },
      { codigo: 'barberia', nombre: 'Barbería' },
      { codigo: 'estetica', nombre: 'Estética' },
      { codigo: 'maquillaje', nombre: 'Maquillaje' },
      { codigo: 'depilacion', nombre: 'Depilación' },
      { codigo: 'tatuajes', nombre: 'Tatuajes' },
      { codigo: 'masajes', nombre: 'Masajes' },
      { codigo: 'peluqueria_canina', nombre: 'Peluquería Canina' },
      { codigo: 'otro', nombre: 'Otro' }
    ]
    
    for (let i = 0; i < subcategoriasBelleza.length; i++) {
      const { codigo, nombre } = subcategoriasBelleza[i]
      const orden = codigo === 'otro' ? 99 : i + 1
      
      await client.query(`
        INSERT INTO subcategorias (categoria_id, codigo, nombre, orden)
        SELECT id, $1, $2, $3 FROM categorias WHERE codigo = 'belleza'
        ON CONFLICT (categoria_id, codigo) DO NOTHING
      `, [codigo, nombre, orden])
    }
    logger.info('✓ Subcategorías de Belleza insertadas')
    
    logger.success('✅ Tablas de categorías creadas e inicializadas correctamente')
    
    // Verificar resultado
    const { rows } = await client.query(`
      SELECT 
        c.nombre as categoria,
        COUNT(s.id) as num_subcategorias
      FROM categorias c
      LEFT JOIN subcategorias s ON c.id = s.categoria_id
      GROUP BY c.id, c.nombre
      ORDER BY c.orden
    `)
    
    console.log('\n📊 Categorías creadas:')
    rows.forEach(row => {
      console.log(`  - ${row.categoria}: ${row.num_subcategorias} subcategorías`)
    })
    
    process.exit(0)
  } catch (error) {
    logger.error('❌ Error al configurar categorías:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    client.release()
  }
}

setupCategorias()

