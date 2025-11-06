const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

// POST /api/reportes - Crear un nuevo reporte
router.post('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { emprendimiento_id, categoria, titulo, descripcion, descripcion_detallada } = req.body
    
    // Validaciones
    if (!emprendimiento_id || !categoria || !titulo || !descripcion) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Faltan campos requeridos: emprendimiento_id, categoria, titulo, descripcion' 
      })
    }
    
    logger.info(`Usuario ${userId} reportando emprendimiento ${emprendimiento_id}`)
    
    // Verificar que el emprendimiento existe
    const { rows: empRows } = await pool.query(
      'SELECT id, nombre FROM emprendimientos WHERE id = $1',
      [emprendimiento_id]
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Verificar si el usuario ya reportó este emprendimiento con la misma categoría en las últimas 24 horas
    const { rows: reporteExistente } = await pool.query(
      `SELECT id FROM reportes_emprendimientos 
       WHERE emprendimiento_id = $1 
         AND usuario_id = $2 
         AND categoria = $3
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [emprendimiento_id, userId, categoria]
    )
    
    if (reporteExistente.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Ya has reportado este emprendimiento por este motivo en las últimas 24 horas' 
      })
    }
    
    // Crear el reporte
    const { rows } = await pool.query(
      `INSERT INTO reportes_emprendimientos 
       (emprendimiento_id, usuario_id, categoria, titulo, descripcion, descripcion_detallada, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
       RETURNING *`,
      [emprendimiento_id, userId, categoria, titulo, descripcion, descripcion_detallada || null]
    )
    
    logger.success(`Reporte creado exitosamente: ID ${rows[0].id}`)
    
    res.status(201).json({
      ok: true,
      mensaje: 'Reporte enviado exitosamente. Lo revisaremos a la brevedad.',
      reporte: rows[0]
    })
  } catch (err) {
    logger.error('Error creando reporte:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al crear reporte' })
  }
})

// GET /api/reportes/mis-reportes - Obtener reportes del usuario autenticado
router.get('/mis-reportes', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo reportes del usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT 
         r.*,
         e.nombre as emprendimiento_nombre,
         e.categoria as emprendimiento_categoria
       FROM reportes_emprendimientos r
       LEFT JOIN emprendimientos e ON r.emprendimiento_id = e.id
       WHERE r.usuario_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    )
    
    logger.success(`${rows.length} reportes encontrados`)
    
    res.json({
      ok: true,
      reportes: rows
    })
  } catch (err) {
    logger.error('Error obteniendo reportes:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/reportes/emprendimiento/:id - Obtener reportes de un emprendimiento (solo admin)
router.get('/emprendimiento/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { tipo_usuario } = req.auth
    
    // Solo admins pueden ver todos los reportes de un emprendimiento
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No autorizado' })
    }
    
    logger.info(`Admin consultando reportes del emprendimiento ${id}`)
    
    const { rows } = await pool.query(
      `SELECT 
         r.*,
         u.nombre as usuario_nombre,
         u.correo as usuario_correo
       FROM reportes_emprendimientos r
       LEFT JOIN usuarios u ON r.usuario_id = u.id
       WHERE r.emprendimiento_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    )
    
    logger.success(`${rows.length} reportes encontrados`)
    
    res.json({
      ok: true,
      reportes: rows
    })
  } catch (err) {
    logger.error('Error obteniendo reportes:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/reportes/:id - Actualizar estado de reporte (solo admin)
router.patch('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: adminId, tipo_usuario } = req.auth
    const { estado, respuesta_admin } = req.body
    
    // Solo admins pueden actualizar reportes
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'No autorizado' })
    }
    
    logger.info(`Admin ${adminId} actualizando reporte ${id}`)
    
    const { rows } = await pool.query(
      `UPDATE reportes_emprendimientos 
       SET estado = $1,
           respuesta_admin = $2,
           admin_revisor_id = $3,
           revisado_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [estado, respuesta_admin, adminId, id]
    )
    
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Reporte no encontrado' })
    }
    
    logger.success(`Reporte ${id} actualizado a estado: ${estado}`)
    
    res.json({
      ok: true,
      mensaje: 'Reporte actualizado exitosamente',
      reporte: rows[0]
    })
  } catch (err) {
    logger.error('Error actualizando reporte:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/reportes/estadisticas/:emprendimientoId - Estadísticas de reportes de un emprendimiento
router.get('/estadisticas/:emprendimientoId', auth, async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    const { id: userId, tipo_usuario } = req.auth
    
    // Verificar que sea el dueño del emprendimiento o admin
    if (tipo_usuario !== 'admin') {
      const { rows: empRows } = await pool.query(
        'SELECT id FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
        [emprendimientoId, userId]
      )
      
      if (!empRows.length) {
        return res.status(403).json({ ok: false, error: 'No autorizado' })
      }
    }
    
    logger.info(`Obteniendo estadísticas de reportes del emprendimiento ${emprendimientoId}`)
    
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) as total_reportes,
         COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
         COUNT(*) FILTER (WHERE estado = 'revisado') as revisados,
         COUNT(*) FILTER (WHERE estado = 'aceptado') as aceptados,
         COUNT(*) FILTER (WHERE estado = 'rechazado') as rechazados,
         COUNT(*) FILTER (WHERE categoria = 'contenido_inapropiado') as contenido_inapropiado,
         COUNT(*) FILTER (WHERE categoria = 'informacion_falsa') as informacion_falsa,
         COUNT(*) FILTER (WHERE categoria = 'productos_prohibidos') as productos_prohibidos,
         COUNT(*) FILTER (WHERE categoria = 'suplantacion_identidad') as suplantacion_identidad,
         COUNT(*) FILTER (WHERE categoria = 'practicas_fraudulentas') as practicas_fraudulentas,
         COUNT(*) FILTER (WHERE categoria = 'spam') as spam,
         COUNT(*) FILTER (WHERE categoria = 'problemas_vendedor') as problemas_vendedor,
         COUNT(*) FILTER (WHERE categoria = 'otro') as otro
       FROM reportes_emprendimientos
       WHERE emprendimiento_id = $1`,
      [emprendimientoId]
    )
    
    res.json({
      ok: true,
      estadisticas: rows[0]
    })
  } catch (err) {
    logger.error('Error obteniendo estadísticas de reportes:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

