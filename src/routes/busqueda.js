const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const logger = require('../utils/logger')

// Función para calcular el estado de horarios de un emprendimiento
const calcularEstadoHorarios = (horarios) => {
  if (!horarios || typeof horarios !== 'object') {
    return { estado: 'cerrado', horaCierre: null }
  }
  
  // Mapeo de días en español con capitalización
  const diasMap = {
    0: ['Domingo'],
    1: ['Lunes'],
    2: ['Martes'],
    3: ['Miércoles', 'Miercoles'],
    4: ['Jueves'],
    5: ['Viernes'],
    6: ['Sábado', 'Sabado']
  }
  
  const ahora = new Date()
  const diaSemana = ahora.getDay()
  const horaActual = ahora.getHours() * 100 + ahora.getMinutes()
  
  // Buscar el horario del día actual con diferentes variaciones de capitalización
  const nombresDia = diasMap[diaSemana] || []
  let horarioDia = null
  
  for (const nombreDia of nombresDia) {
    if (horarios[nombreDia] && Array.isArray(horarios[nombreDia]) && horarios[nombreDia].length > 0) {
      horarioDia = horarios[nombreDia][0]
      break
    }
  }
  
  if (!horarioDia || !horarioDia.inicio || !horarioDia.fin) {
    return { estado: 'cerrado', horaCierre: null }
  }
  
  const horaApertura = parseInt(horarioDia.inicio.replace(':', ''))
  const horaCierre = parseInt(horarioDia.fin.replace(':', ''))
  
  if (horaActual < horaApertura) {
    return { estado: 'cerrado', horaCierre: null }
  }
  
  if (horaActual >= horaCierre - 30) {
    return { estado: 'cierra_pronto', horaCierre: horarioDia.fin }
  }
  
  return { estado: 'abierto', horaCierre: horarioDia.fin }
}

// GET /api/busqueda?q=texto - Buscar emprendimientos y productos
router.get('/', async (req, res) => {
  try {
    const { q } = req.query
    
    if (!q || q.trim().length === 0) {
      return res.json({ ok: true, emprendimientos: [], productos: [] })
    }
    
    const searchTerm = `%${q.trim().toLowerCase()}%`
    logger.info(`Buscando: "${q}"`)
    
    // Buscar emprendimientos
    const emprendimientosQuery = `
      SELECT e.id, e.usuario_id, e.nombre, e.descripcion_corta, e.descripcion_larga, 
             e.comuna_id, e.direccion, e.telefono, e.logo_url, e.background_url,
             e.categoria_principal, e.subcategorias, e.horarios, e.medios_pago, 
             e.tipos_entrega, e.costo_delivery, e.latitud, e.longitud, e.estado,
             e.fecha_creacion, e.fecha_actualizacion,
             u.nombre as usuario_nombre, u.telefono as usuario_telefono,
             u.plan_id as usuario_plan_id,
             COALESCE(AVG(c.calificacion_general), 0)::NUMERIC(3,2) as calificacion_promedio,
             COUNT(c.id)::INTEGER as total_calificaciones
      FROM emprendimientos e
      LEFT JOIN usuarios u ON e.usuario_id = u.id
      LEFT JOIN calificaciones_emprendimiento c ON e.id = c.emprendimiento_id
      WHERE e.estado = 'activo'
        AND (
          LOWER(e.nombre) LIKE $1
          OR LOWER(e.descripcion_corta) LIKE $1
          OR LOWER(e.descripcion_larga) LIKE $1
          OR LOWER(e.categoria_principal) LIKE $1
        )
      GROUP BY e.id, u.nombre, u.telefono, u.plan_id
      ORDER BY e.fecha_creacion DESC
    `
    
    const { rows: empRows } = await pool.query(emprendimientosQuery, [searchTerm])
    
    // Buscar productos
    const productosQuery = `
      SELECT p.id, p.emprendimiento_id, p.nombre, p.descripcion, p.precio, 
             p.categoria, p.imagen_url, p.oferta, p.precio_oferta, p.activo,
             p.fecha_creacion, p.fecha_actualizacion,
             e.nombre as emprendimiento_nombre, e.logo_url as emprendimiento_logo,
             e.background_url as emprendimiento_background, e.descripcion_corta as emprendimiento_descripcion,
             e.direccion as emprendimiento_direccion, e.telefono as emprendimiento_telefono,
             e.usuario_id as emprendimiento_usuario_id, 
             e.categoria_principal, e.horarios
      FROM productos p
      LEFT JOIN emprendimientos e ON p.emprendimiento_id = e.id
      WHERE p.activo = true 
        AND e.estado = 'activo'
        AND (
          LOWER(p.nombre) LIKE $1
          OR LOWER(p.descripcion) LIKE $1
          OR LOWER(p.categoria::text) LIKE $1
        )
      ORDER BY p.fecha_creacion DESC
    `
    
    const { rows: prodRows } = await pool.query(productosQuery, [searchTerm])
    
    // Agregar estado calculado a emprendimientos (mostrar todos, incluso cerrados)
    const emprendimientosConEstado = empRows.map(emp => {
      const estadoHorarios = calcularEstadoHorarios(emp.horarios)
      return {
        ...emp,
        estado_calculado: estadoHorarios.estado,
        hora_cierre: estadoHorarios.horaCierre
      }
    })
    
    // Agregar estado calculado a productos (basado en su emprendimiento)
    const productosConEstado = prodRows.map(prod => {
      const estadoHorarios = calcularEstadoHorarios(prod.horarios)
      return {
        ...prod,
        estado_calculado: estadoHorarios.estado,
        hora_cierre: estadoHorarios.horaCierre
      }
    })
    
    logger.success(`Búsqueda "${q}": ${emprendimientosConEstado.length} emprendimientos, ${productosConEstado.length} productos`)
    
    res.json({ 
      ok: true, 
      emprendimientos: emprendimientosConEstado,
      productos: productosConEstado
    })
  } catch (err) {
    logger.error('Error en búsqueda:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al buscar' })
  }
})

module.exports = router

