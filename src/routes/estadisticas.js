const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

// GET /api/estadisticas/:emprendimientoId - Obtener estadísticas de un emprendimiento
router.get('/:emprendimientoId', auth, async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo estadísticas del emprendimiento ${emprendimientoId} para usuario ${userId}`)
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Obtener calificaciones del emprendimiento
    const { rows: calificacionesRows } = await pool.query(
      `SELECT 
         COUNT(*) as total_calificaciones,
         AVG(calificacion_general)::NUMERIC(3,2) as calificacion_promedio,
         AVG(precio)::NUMERIC(3,2) as precio_promedio,
         AVG(calidad)::NUMERIC(3,2) as calidad_promedio,
         AVG(servicio)::NUMERIC(3,2) as servicio_promedio,
         AVG(tiempo_entrega)::NUMERIC(3,2) as tiempo_entrega_promedio
       FROM calificaciones_emprendimiento
       WHERE emprendimiento_id = $1`,
      [emprendimientoId]
    )
    
    const calificaciones = calificacionesRows[0] || {
      total_calificaciones: 0,
      calificacion_promedio: 0,
      precio_promedio: 0,
      calidad_promedio: 0,
      servicio_promedio: 0,
      tiempo_entrega_promedio: 0
    }
    
    // Obtener estadísticas de pedidos
    const { rows: pedidosRows } = await pool.query(
      `SELECT 
         COUNT(*) as total_pedidos,
         SUM(total) as monto_total,
         AVG(total) as promedio_pedido
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1`,
      [emprendimientoId]
    )
    
    const estadisticasPedidos = pedidosRows[0] || {
      total_pedidos: 0,
      monto_total: 0,
      promedio_pedido: 0
    }
    
    // Obtener pedidos por período
    const ahora = new Date()
    
    // Último año
    const fechaAñoInicio = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate())
    const { rows: pedidosAñoRows } = await pool.query(
      `SELECT COUNT(*) as pedidos, SUM(total) as monto
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaAñoInicio]
    )
    
    // Último mes
    const fechaMesInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate())
    const { rows: pedidosMesRows } = await pool.query(
      `SELECT COUNT(*) as pedidos, SUM(total) as monto
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaMesInicio]
    )
    
    // Última semana
    const fechaSemanaInicio = new Date(ahora.getTime() - (7 * 24 * 60 * 60 * 1000))
    const { rows: pedidosSemanaRows } = await pool.query(
      `SELECT COUNT(*) as pedidos, SUM(total) as monto
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaSemanaInicio]
    )
    
    // Último día
    const fechaDiaInicio = new Date(ahora.getTime() - (24 * 60 * 60 * 1000))
    const { rows: pedidosDiaRows } = await pool.query(
      `SELECT COUNT(*) as pedidos, SUM(total) as monto
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaDiaInicio]
    )
    
    // Función auxiliar para crear array de longitud fija rellenado con datos
    // periodo: 'año' | 'mes' | 'semana' | 'dia'
    const crearArrayCompleto = (datos, longitud, nombreColumna = 'visualizaciones', periodo) => {
      const resultado = Array(longitud).fill(0)
      if (!datos || datos.length === 0) return resultado
      
      const ahora = new Date()
      let fechaInicio
      
      switch(periodo) {
        case 'año':
          fechaInicio = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate())
          break
        case 'mes':
          fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate())
          break
        case 'semana':
          fechaInicio = new Date(ahora.getTime() - (7 * 24 * 60 * 60 * 1000))
          break
        case 'dia':
          fechaInicio = new Date(ahora.getTime() - (24 * 60 * 60 * 1000))
          break
      }
      
      datos.forEach(row => {
        let indice = -1
        let fecha
        
        // Parsear fecha según el tipo de dato devuelto
        if (row.mes) {
          // Formato "YYYY-MM"
          const [ano, mes] = row.mes.split('-')
          fecha = new Date(parseInt(ano), parseInt(mes) - 1, 1)
        } else if (row.fecha) {
          // Campo 'fecha' de visualizaciones_diarias (DATE)
          fecha = row.fecha instanceof Date ? row.fecha : new Date(row.fecha)
        } else if (row.dia) {
          // DATE_TRUNC devuelve un Date object
          fecha = row.dia instanceof Date ? row.dia : new Date(row.dia)
        } else if (row.hora) {
          // DATE_TRUNC devuelve un Date object
          fecha = row.hora instanceof Date ? row.hora : new Date(row.hora)
        }
        
        if (periodo === 'año') {
          // Calcular meses transcurridos desde fechaInicio
          const mesesDiff = (ahora.getFullYear() - fecha.getFullYear()) * 12 + (ahora.getMonth() - fecha.getMonth())
          indice = 11 - mesesDiff // Invertir para que el más reciente sea el último
        } else if (periodo === 'mes') {
          // Últimos 30 días divididos en 5 puntos de 6 días cada uno
          const diasDiff = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24))
          indice = Math.floor((30 - diasDiff) / 6)
        } else if (periodo === 'semana') {
          // Últimos 7 días
          const diasDiff = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24))
          indice = 6 - diasDiff
        } else if (periodo === 'dia') {
          // Últimas 24 horas divididas en 8 puntos de 3 horas cada uno
          const horasDiff = (ahora - fecha) / (1000 * 60 * 60) // No floor aquí
          indice = Math.min(longitud - 1, Math.floor((24 - horasDiff) / 3))
          logger.db(`[${periodo}] Fecha: ${fecha}, Ahora: ${ahora}, Horas diff: ${horasDiff.toFixed(2)}, Índice: ${indice}`)
        }
        
        const valor = parseInt(row[nombreColumna]) || 0
        if (indice >= 0 && indice < longitud) {
          resultado[indice] = valor
        } else {
          logger.warn(`Índice fuera de rango: ${indice} para período ${periodo} (longitud: ${longitud})`)
        }
      })
      
      return resultado
    }
    
    // Obtener visualizaciones distribuidas por período (para gráficos)
    // Usamos visualizaciones_diarias (optimizado) para períodos largos
    // Para día necesitamos más granularidad, usamos visualizaciones_emprendimiento
    
    // Año: últimos 12 meses - usar visualizaciones_diarias agregadas por mes
    const { rows: visualizacionesAñoDistribuidas } = await pool.query(
      `SELECT 
         TO_CHAR(fecha, 'YYYY-MM') as mes,
         SUM(contador) as visualizaciones
       FROM visualizaciones_diarias
       WHERE emprendimiento_id = $1 AND fecha >= $2
       GROUP BY mes
       ORDER BY mes`,
      [emprendimientoId, fechaAñoInicio]
    )
    
    // Mes: últimos 30 días agrupados en 5 puntos - usar visualizaciones_diarias
    const { rows: visualizacionesMesDistribuidas } = await pool.query(
      `SELECT 
         fecha as dia,
         contador as visualizaciones
       FROM visualizaciones_diarias
       WHERE emprendimiento_id = $1 AND fecha >= $2
       ORDER BY dia`,
      [emprendimientoId, fechaMesInicio]
    )
    
    // Semana: últimos 7 días - usar visualizaciones_diarias
    const { rows: visualizacionesSemanaDistribuidas } = await pool.query(
      `SELECT 
         fecha as dia,
         contador as visualizaciones
       FROM visualizaciones_diarias
       WHERE emprendimiento_id = $1 AND fecha >= $2
       ORDER BY dia`,
      [emprendimientoId, fechaSemanaInicio]
    )
    
    // Día: últimos 24 horas - mantener visualizaciones_emprendimiento para granularidad horaria
    // Esto sigue siendo necesario para ver el detalle del día actual
    const { rows: visualizacionesDiaDistribuidas } = await pool.query(
      `SELECT 
         DATE_TRUNC('hour', fecha_visualizacion) as hora,
         COUNT(*) as visualizaciones
       FROM visualizaciones_emprendimiento
       WHERE emprendimiento_id = $1 AND fecha_visualizacion >= $2
       GROUP BY hora
       ORDER BY hora`,
      [emprendimientoId, fechaDiaInicio]
    )
    
    // Obtener pedidos distribuidas por período (para gráficos)
    const { rows: pedidosAñoDistribuidas } = await pool.query(
      `SELECT 
         TO_CHAR(created_at, 'YYYY-MM') as mes,
         COUNT(*) as pedidos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2
       GROUP BY mes
       ORDER BY mes`,
      [emprendimientoId, fechaAñoInicio]
    )
    
    const { rows: pedidosMesDistribuidas } = await pool.query(
      `SELECT 
         DATE_TRUNC('day', created_at) as dia,
         COUNT(*) as pedidos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2
       GROUP BY dia
       ORDER BY dia`,
      [emprendimientoId, fechaMesInicio]
    )
    
    const { rows: pedidosSemanaDistribuidas } = await pool.query(
      `SELECT 
         DATE_TRUNC('day', created_at) as dia,
         COUNT(*) as pedidos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2
       GROUP BY dia
       ORDER BY dia`,
      [emprendimientoId, fechaSemanaInicio]
    )
    
    const { rows: pedidosDiaDistribuidas } = await pool.query(
      `SELECT 
         DATE_TRUNC('hour', created_at) as hora,
         COUNT(*) as pedidos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2
       GROUP BY hora
       ORDER BY hora`,
      [emprendimientoId, fechaDiaInicio]
    )
    
    const resultado = {
      ok: true,
      estadisticas: {
        calificaciones: {
          total_calificaciones: parseInt(calificaciones.total_calificaciones) || 0,
          calificacion_promedio: parseFloat(calificaciones.calificacion_promedio) || 0,
          precio_promedio: parseFloat(calificaciones.precio_promedio) || 0,
          calidad_promedio: parseFloat(calificaciones.calidad_promedio) || 0,
          servicio_promedio: parseFloat(calificaciones.servicio_promedio) || 0,
          tiempo_entrega_promedio: parseFloat(calificaciones.tiempo_entrega_promedio) || 0
        },
        pedidos: {
          total: parseInt(estadisticasPedidos.total_pedidos) || 0,
          monto_total: parseFloat(estadisticasPedidos.monto_total) || 0,
          promedio_pedido: parseFloat(estadisticasPedidos.promedio_pedido) || 0,
          por_periodo: {
            año: {
              pedidos: parseInt(pedidosAñoRows[0]?.pedidos) || 0,
              monto: parseFloat(pedidosAñoRows[0]?.monto) || 0
            },
            mes: {
              pedidos: parseInt(pedidosMesRows[0]?.pedidos) || 0,
              monto: parseFloat(pedidosMesRows[0]?.monto) || 0
            },
            semana: {
              pedidos: parseInt(pedidosSemanaRows[0]?.pedidos) || 0,
              monto: parseFloat(pedidosSemanaRows[0]?.monto) || 0
            },
            dia: {
              pedidos: parseInt(pedidosDiaRows[0]?.pedidos) || 0,
              monto: parseFloat(pedidosDiaRows[0]?.monto) || 0
            }
          }
        },
        visualizaciones: {
          año: crearArrayCompleto(visualizacionesAñoDistribuidas, 12, 'visualizaciones', 'año'),
          mes: crearArrayCompleto(visualizacionesMesDistribuidas, 5, 'visualizaciones', 'mes'),
          semana: crearArrayCompleto(visualizacionesSemanaDistribuidas, 7, 'visualizaciones', 'semana'),
          dia: crearArrayCompleto(visualizacionesDiaDistribuidas, 8, 'visualizaciones', 'dia')
        },
        pedidos_grafico: {
          año: crearArrayCompleto(pedidosAñoDistribuidas, 12, 'pedidos', 'año'),
          mes: crearArrayCompleto(pedidosMesDistribuidas, 5, 'pedidos', 'mes'),
          semana: crearArrayCompleto(pedidosSemanaDistribuidas, 7, 'pedidos', 'semana'),
          dia: crearArrayCompleto(pedidosDiaDistribuidas, 8, 'pedidos', 'dia')
        }
      }
    }
    
    logger.success(`Estadísticas del emprendimiento ${emprendimientoId} obtenidas`)
    res.json(resultado)
  } catch (err) {
    logger.error('Error obteniendo estadísticas:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/estadisticas/:emprendimientoId/registrar-visualizacion - Registrar una visualización
router.post('/:emprendimientoId/registrar-visualizacion', async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    
    logger.info(`Registrando visualización del emprendimiento ${emprendimientoId}`)
    
    // Incrementar contador diario usando función optimizada
    await pool.query(
      `SELECT incrementar_visualizacion($1)`,
      [emprendimientoId]
    )
    
    logger.success(`Visualización registrada para emprendimiento ${emprendimientoId}`)
    res.json({ ok: true, mensaje: 'Visualización registrada' })
  } catch (err) {
    logger.error('Error registrando visualización:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

