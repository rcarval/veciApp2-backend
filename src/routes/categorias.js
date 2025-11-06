const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const logger = require('../utils/logger')

// GET /api/categorias - Obtener todas las categorías con sus subcategorías
router.get('/', async (req, res) => {
  try {
    logger.info('Listando categorías con subcategorías')
    
    // Obtener categorías activas ordenadas
    const { rows: categorias } = await pool.query(
      `SELECT id, codigo, nombre, descripcion, icono, color, orden
       FROM categorias
       WHERE activo = true
       ORDER BY orden ASC`
    )
    
    // Obtener subcategorías activas para todas las categorías
    const { rows: subcategorias } = await pool.query(
      `SELECT id, categoria_id, codigo, nombre, descripcion, icono, orden
       FROM subcategorias
       WHERE activo = true
       ORDER BY orden ASC`
    )
    
    // Agrupar subcategorías por categoría
    const categoriasConSubcategorias = categorias.map(cat => ({
      id: cat.codigo, // Usar código como ID para compatibilidad con frontend
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      icono: cat.icono,
      color: cat.color,
      subcategorias: subcategorias
        .filter(sub => sub.categoria_id === cat.id)
        .map(sub => ({
          id: sub.codigo, // Usar código como ID
          nombre: sub.nombre,
          descripcion: sub.descripcion,
          icono: sub.icono
        }))
    }))
    
    res.json({
      ok: true,
      categorias: categoriasConSubcategorias
    })
  } catch (err) {
    logger.error('Error al listar categorías:', err.message)
    res.status(500).json({ ok: false, error: 'Error al obtener categorías' })
  }
})

// GET /api/categorias/:codigo - Obtener una categoría específica con sus subcategorías
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params
    logger.info(`Obteniendo categoría: ${codigo}`)
    
    const { rows: categorias } = await pool.query(
      `SELECT id, codigo, nombre, descripcion, icono, color, orden
       FROM categorias
       WHERE codigo = $1 AND activo = true`,
      [codigo]
    )
    
    if (categorias.length === 0) {
      return res.status(404).json({ ok: false, error: 'Categoría no encontrada' })
    }
    
    const categoria = categorias[0]
    
    // Obtener subcategorías
    const { rows: subcategorias } = await pool.query(
      `SELECT id, codigo, nombre, descripcion, icono, orden
       FROM subcategorias
       WHERE categoria_id = $1 AND activo = true
       ORDER BY orden ASC`,
      [categoria.id]
    )
    
    res.json({
      ok: true,
      categoria: {
        id: categoria.codigo,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        icono: categoria.icono,
        color: categoria.color,
        subcategorias: subcategorias.map(sub => ({
          id: sub.codigo,
          nombre: sub.nombre,
          descripcion: sub.descripcion,
          icono: sub.icono
        }))
      }
    })
  } catch (err) {
    logger.error('Error al obtener categoría:', err.message)
    res.status(500).json({ ok: false, error: 'Error al obtener categoría' })
  }
})

module.exports = router

