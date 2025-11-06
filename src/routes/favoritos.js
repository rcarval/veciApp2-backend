const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

// Función auxiliar para calcular estado de horarios
const calcularEstadoHorarios = (horarios) => {
  if (!horarios || typeof horarios !== 'object') {
    return { estado: 'cerrado', horaCierre: null }
  }

  const ahora = new Date()
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes()
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const diaHoy = diasSemana[ahora.getDay()]

  // Buscar el horario del día (probando con mayúsculas y minúsculas)
  const horarioDia = horarios[diaHoy] || horarios[diaHoy.toLowerCase()]

  if (!horarioDia || horarioDia.length === 0) {
    return { estado: 'cerrado', horaCierre: null }
  }

  for (const horario of horarioDia) {
    if (!horario.inicio || !horario.fin) continue

    const [horaInicio, minInicio] = horario.inicio.split(':').map(Number)
    const [horaFin, minFin] = horario.fin.split(':').map(Number)
    
    const minutoInicio = horaInicio * 60 + minInicio
    const minutoFin = horaFin * 60 + minFin

    if (horaActual >= minutoInicio && horaActual < minutoFin) {
      const minutosRestantes = minutoFin - horaActual
      
      if (minutosRestantes <= 30) {
        return { estado: 'cierra_pronto', horaCierre: horario.fin }
      }
      
      return { estado: 'abierto', horaCierre: horario.fin }
    }
  }
  
  return { estado: 'cerrado', horaCierre: null }
}

// GET /api/favoritos - Obtener favoritos del usuario
router.get('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Listando favoritos del usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT f.id as favorito_id, f.created_at as fecha_favorito,
              e.id, e.usuario_id, e.nombre, e.descripcion_corta, e.descripcion_larga, 
              e.comuna_id, e.direccion, e.telefono, e.logo_url, e.background_url,
              e.categoria_principal, e.subcategorias, e.horarios, e.medios_pago, 
              e.tipos_entrega, e.costo_delivery, e.latitud, e.longitud, e.estado,
              e.fecha_creacion, e.fecha_actualizacion,
              u.nombre as usuario_nombre, u.telefono as usuario_telefono,
              u.plan_id as usuario_plan_id,
              COALESCE(AVG(c.calificacion_general), 0)::NUMERIC(3,2) as calificacion_promedio,
              COUNT(c.id)::INTEGER as total_calificaciones
       FROM favoritos f
       LEFT JOIN emprendimientos e ON f.emprendimiento_id = e.id
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       LEFT JOIN calificaciones_emprendimiento c ON e.id = c.emprendimiento_id
       WHERE f.usuario_id = $1
       AND e.id IS NOT NULL
       AND e.estado = 'activo'
       GROUP BY f.id, e.id, u.nombre, u.telefono, u.plan_id
       ORDER BY f.created_at DESC`,
      [userId]
    )
    
    // Agregar estado calculado según horarios (mostrar activos, incluso si están cerrados por horario)
    const favoritosConEstado = rows.map(emp => {
      const estadoHorarios = calcularEstadoHorarios(emp.horarios)
      return {
        ...emp,
        estado_calculado: estadoHorarios.estado,
        hora_cierre: estadoHorarios.horaCierre
      }
    })
    
    logger.success(`Favoritos obtenidos: ${favoritosConEstado.length}`)
    res.json({ ok: true, favoritos: favoritosConEstado })
  } catch (err) {
    logger.error('Error listando favoritos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar favoritos' })
  }
})

// POST /api/favoritos - Agregar emprendimiento a favoritos
router.post('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { emprendimiento_id } = req.body || {}
    
    if (!emprendimiento_id) {
      return res.status(400).json({ ok: false, error: 'Falta emprendimiento_id' })
    }
    
    logger.info(`Usuario ${userId} agregando emprendimiento ${emprendimiento_id} a favoritos`)
    
    // Verificar que el emprendimiento existe
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1 AND estado = $2',
      [emprendimiento_id, 'activo']
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Insertar favorito (si ya existe, el UNIQUE constraint lo evitará)
    const { rows } = await pool.query(
      `INSERT INTO favoritos (usuario_id, emprendimiento_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, emprendimiento_id) DO NOTHING
       RETURNING id, created_at`,
      [userId, emprendimiento_id]
    )
    
    if (rows.length > 0) {
      logger.success(`Favorito agregado: ${rows[0].id}`)
      res.status(201).json({ 
        ok: true, 
        mensaje: 'Emprendimiento agregado a favoritos',
        favorito: rows[0]
      })
    } else {
      logger.info(`Favorito ya existía`)
      res.json({ 
        ok: true, 
        mensaje: 'El emprendimiento ya estaba en favoritos'
      })
    }
  } catch (err) {
    logger.error('Error agregando favorito:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al agregar favorito' })
  }
})

// DELETE /api/favoritos/:emprendimientoId - Eliminar emprendimiento de favoritos
router.delete('/:emprendimientoId', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { emprendimientoId } = req.params
    
    logger.info(`Usuario ${userId} eliminando emprendimiento ${emprendimientoId} de favoritos`)
    
    const { rowCount } = await pool.query(
      'DELETE FROM favoritos WHERE usuario_id = $1 AND emprendimiento_id = $2',
      [userId, emprendimientoId]
    )
    
    if (rowCount > 0) {
      logger.success(`Favorito eliminado`)
      res.json({ ok: true, mensaje: 'Emprendimiento eliminado de favoritos' })
    } else {
      logger.warn(`Favorito no encontrado`)
      res.status(404).json({ ok: false, error: 'Favorito no encontrado' })
    }
  } catch (err) {
    logger.error('Error eliminando favorito:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al eliminar favorito' })
  }
})

// GET /api/favoritos/check/:emprendimientoId - Verificar si un emprendimiento está en favoritos
router.get('/check/:emprendimientoId', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { emprendimientoId } = req.params
    
    const { rows } = await pool.query(
      'SELECT id FROM favoritos WHERE usuario_id = $1 AND emprendimiento_id = $2',
      [userId, emprendimientoId]
    )
    
    const esFavorito = rows.length > 0
    
    res.json({ ok: true, esFavorito, favorito_id: esFavorito ? rows[0].id : null })
  } catch (err) {
    logger.error('Error verificando favorito:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

