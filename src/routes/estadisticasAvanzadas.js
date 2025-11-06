const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

// Función para generar insights automáticos
const generarInsights = (stats) => {
  const insights = []
  const recomendaciones = []
  
  // 1. Análisis de tasa de éxito
  if (stats.rendimiento.tasa_exito < 70) {
    insights.push({
      tipo: 'alerta',
      titulo: 'Baja tasa de éxito',
      descripcion: `Tu tasa de entrega es ${stats.rendimiento.tasa_exito}%. Deberías apuntar a más del 85%.`,
      icono: 'warning'
    })
    recomendaciones.push('Revisa los motivos de rechazo más comunes y trabaja en mejorarlos')
  } else if (stats.rendimiento.tasa_exito >= 90) {
    insights.push({
      tipo: 'exito',
      titulo: '¡Excelente desempeño!',
      descripcion: `Tienes una tasa de éxito de ${stats.rendimiento.tasa_exito}%. ¡Sigue así!`,
      icono: 'trophy'
    })
  }
  
  // 2. Análisis de tiempos de entrega
  if (stats.rendimiento.cumplimiento_tiempo < 80) {
    insights.push({
      tipo: 'alerta',
      titulo: 'Retrasos en entregas',
      descripcion: `Solo cumples el ${stats.rendimiento.cumplimiento_tiempo}% de los tiempos prometidos.`,
      icono: 'time'
    })
    recomendaciones.push('Considera aumentar el tiempo de entrega comprometido para ser más realista')
  }
  
  // 3. Análisis de rechazos
  if (stats.rendimiento.tasa_rechazo > 15) {
    insights.push({
      tipo: 'advertencia',
      titulo: 'Alta tasa de rechazo',
      descripcion: `${stats.rendimiento.tasa_rechazo}% de los pedidos son rechazados.`,
      icono: 'alert-circle'
    })
    
    if (stats.rechazos.top_motivos.length > 0) {
      const motivoPrincipal = stats.rechazos.top_motivos[0]
      recomendaciones.push(`Tu motivo principal de rechazo es "${motivoPrincipal.motivo}". Trabaja en mejorarlo.`)
    }
  }
  
  // 4. Análisis de productos
  if (stats.productos.total_productos === 0) {
    insights.push({
      tipo: 'info',
      titulo: 'Sin productos',
      descripcion: 'Aún no has agregado productos a tu vitrina virtual.',
      icono: 'cube'
    })
    recomendaciones.push('Agrega productos a tu vitrina virtual para comenzar a vender')
  } else if (stats.productos.total_productos < 5) {
    insights.push({
      tipo: 'info',
      titulo: 'Pocos productos',
      descripcion: `Solo tienes ${stats.productos.total_productos} productos. Más variedad = más ventas.`,
      icono: 'cube'
    })
    recomendaciones.push('Agrega más productos para aumentar tus oportunidades de venta')
  }
  
  // 5. Análisis de horarios
  if (stats.horarios_pico.length > 0) {
    const mejorHora = stats.horarios_pico[0]
    insights.push({
      tipo: 'exito',
      titulo: 'Horario pico identificado',
      descripcion: `Tu mejor horario es a las ${mejorHora.hora}:00 con ${mejorHora.pedidos} pedidos.`,
      icono: 'time'
    })
    recomendaciones.push(`Considera promocionar productos durante las ${mejorHora.hora}:00 hrs`)
  }
  
  // 6. Conversión de visitas a ventas
  const tasaConversion = stats.visualizaciones.total_periodo > 0 
    ? ((stats.rendimiento.total_pedidos / stats.visualizaciones.total_periodo) * 100).toFixed(1)
    : 0
    
  if (tasaConversion < 5 && stats.visualizaciones.total_periodo > 20) {
    insights.push({
      tipo: 'advertencia',
      titulo: 'Baja conversión',
      descripcion: `Solo el ${tasaConversion}% de las visitas se convierten en pedidos.`,
      icono: 'trending-down'
    })
    recomendaciones.push('Mejora las fotos y descripciones de tus productos para aumentar conversión')
  } else if (tasaConversion > 10) {
    insights.push({
      tipo: 'exito',
      titulo: 'Buena conversión',
      descripcion: `El ${tasaConversion}% de las visitas se convierten en pedidos. ¡Excelente!`,
      icono: 'trending-up'
    })
  }
  
  return { insights, recomendaciones }
}

// GET /api/estadisticas-avanzadas/:emprendimientoId
router.get('/:emprendimientoId', auth, async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    const { id: userId } = req.auth
    const { periodo = 'mes' } = req.query // año, mes, semana, dia
    
    logger.info(`Obteniendo estadísticas avanzadas del emprendimiento ${emprendimientoId}`)
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id, nombre FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Calcular fechas según período
    const ahora = new Date()
    let fechaInicio
    let nombrePeriodo
    
    switch(periodo) {
      case 'año':
        fechaInicio = new Date(ahora.getFullYear() - 1, ahora.getMonth(), ahora.getDate())
        nombrePeriodo = 'Último año'
        break
      case 'semana':
        fechaInicio = new Date(ahora.getTime() - (7 * 24 * 60 * 60 * 1000))
        nombrePeriodo = 'Última semana'
        break
      case 'dia':
        fechaInicio = new Date(ahora.getTime() - (24 * 60 * 60 * 1000))
        nombrePeriodo = 'Últimas 24 horas'
        break
      default: // mes
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate())
        nombrePeriodo = 'Último mes'
    }
    
    // 1. RENDIMIENTO GENERAL
    const { rows: rendimientoRows } = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE estado = 'entregado') as pedidos_entregados,
         COUNT(*) FILTER (WHERE estado = 'rechazado') as pedidos_rechazados,
         COUNT(*) FILTER (WHERE estado = 'cancelado') as pedidos_cancelados,
         COUNT(*) as total_pedidos,
         SUM(total) FILTER (WHERE estado = 'entregado') as ingresos_totales,
         AVG(total) FILTER (WHERE estado = 'entregado') as ticket_promedio,
         AVG(tiempo_entrega_minutos) FILTER (WHERE estado = 'entregado' AND tiempo_entrega_minutos IS NOT NULL) as tiempo_entrega_promedio
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaInicio]
    )
    
    const rendimiento = rendimientoRows[0]
    const tasaExito = rendimiento.total_pedidos > 0 
      ? ((rendimiento.pedidos_entregados / rendimiento.total_pedidos) * 100).toFixed(1)
      : 0
    const tasaRechazo = rendimiento.total_pedidos > 0 
      ? ((rendimiento.pedidos_rechazados / rendimiento.total_pedidos) * 100).toFixed(1)
      : 0
    
    // 2. ANÁLISIS DE TIEMPOS DE ENTREGA
    // Comparar tiempo comprometido (tiempo_entrega_minutos) vs tiempo real (diferencia entre created_at y updated_at cuando se entregó)
    const { rows: tiemposRows } = await pool.query(
      `SELECT 
         tiempo_entrega_minutos as tiempo_comprometido,
         EXTRACT(EPOCH FROM (updated_at - created_at))/60 as tiempo_real_minutos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 
         AND estado = 'entregado'
         AND tiempo_entrega_minutos IS NOT NULL
         AND created_at >= $2`,
      [emprendimientoId, fechaInicio]
    )
    
    let cumplimientoTiempo = 0
    let tiempoComprometidoPromedio = 0
    let tiempoRealPromedio = 0
    let diferenciaTiempoPromedio = 0
    
    if (tiemposRows.length > 0) {
      const pedidosACumplidos = tiemposRows.filter(t => 
        parseFloat(t.tiempo_real_minutos) <= parseFloat(t.tiempo_comprometido)
      ).length
      
      cumplimientoTiempo = ((pedidosACumplidos / tiemposRows.length) * 100).toFixed(1)
      
      tiempoComprometidoPromedio = (tiemposRows.reduce((sum, t) => 
        sum + parseFloat(t.tiempo_comprometido), 0
      ) / tiemposRows.length).toFixed(0)
      
      tiempoRealPromedio = (tiemposRows.reduce((sum, t) => 
        sum + parseFloat(t.tiempo_real_minutos), 0
      ) / tiemposRows.length).toFixed(0)
      
      diferenciaTiempoPromedio = (tiempoRealPromedio - tiempoComprometidoPromedio).toFixed(0)
    }
    
    // 3. ANÁLISIS DE RECHAZOS
    const { rows: rechazosRows } = await pool.query(
      `SELECT 
         motivo_rechazo,
         COUNT(*) as cantidad
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 
         AND estado = 'rechazado'
         AND motivo_rechazo IS NOT NULL
         AND created_at >= $2
       GROUP BY motivo_rechazo
       ORDER BY cantidad DESC
       LIMIT 5`,
      [emprendimientoId, fechaInicio]
    )
    
    // 4. PRODUCTOS MÁS VENDIDOS
    const { rows: productosRows } = await pool.query(
      `SELECT 
         item->>'nombre' as nombre,
         item->>'producto_id' as producto_id,
         SUM((item->>'cantidad')::int) as cantidad_vendida,
         SUM((item->>'subtotal')::numeric) as ingresos_generados,
         COUNT(DISTINCT tc.id) as num_pedidos
       FROM transaccion_comercial tc,
         jsonb_array_elements(tc.detalle) as item
       WHERE tc.emprendimiento_id = $1 
         AND tc.estado = 'entregado'
         AND tc.created_at >= $2
       GROUP BY item->>'nombre', item->>'producto_id'
       ORDER BY cantidad_vendida DESC
       LIMIT 10`,
      [emprendimientoId, fechaInicio]
    )
    
    // 5. CATEGORÍAS MÁS VENDIDAS
    const { rows: categoriasRows } = await pool.query(
      `SELECT 
         p.categoria,
         COUNT(DISTINCT tc.id) as pedidos,
         SUM((item->>'cantidad')::int) as unidades_vendidas,
         SUM((item->>'subtotal')::numeric) as ingresos
       FROM transaccion_comercial tc,
         jsonb_array_elements(tc.detalle) as item
       JOIN productos p ON p.id::text = (item->>'producto_id')
       WHERE tc.emprendimiento_id = $1 
         AND tc.estado = 'entregado'
         AND tc.created_at >= $2
       GROUP BY p.categoria
       ORDER BY unidades_vendidas DESC`,
      [emprendimientoId, fechaInicio]
    )
    
    // 6. HORARIOS PICO (análisis por hora)
    const { rows: horariosRows } = await pool.query(
      `SELECT 
         EXTRACT(HOUR FROM created_at) as hora,
         COUNT(*) as pedidos,
         SUM(total) as ingresos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 
         AND created_at >= $2
       GROUP BY hora
       ORDER BY pedidos DESC
       LIMIT 5`,
      [emprendimientoId, fechaInicio]
    )
    
    // 7. DÍAS DE LA SEMANA MÁS ACTIVOS
    const { rows: diasSemanaRows } = await pool.query(
      `SELECT 
         TO_CHAR(created_at, 'Day') as dia_nombre,
         EXTRACT(DOW FROM created_at) as dia_numero,
         COUNT(*) as pedidos,
         SUM(total) as ingresos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 
         AND created_at >= $2
       GROUP BY dia_nombre, dia_numero
       ORDER BY pedidos DESC`,
      [emprendimientoId, fechaInicio]
    )
    
    // 8. TOTAL DE PRODUCTOS ACTIVOS
    const { rows: productosActivosRows } = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE activo = true) as productos_activos,
         COUNT(*) FILTER (WHERE activo = false) as productos_inactivos,
         COUNT(*) FILTER (WHERE categoria = 'principal') as productos_principales,
         COUNT(*) FILTER (WHERE categoria = 'secundario') as productos_secundarios,
         COUNT(*) FILTER (WHERE categoria = 'oferta') as productos_ofertas,
         COUNT(*) as total_productos
       FROM productos
       WHERE emprendimiento_id = $1`,
      [emprendimientoId]
    )
    
    const productos = productosActivosRows[0] || {
      productos_activos: 0,
      productos_inactivos: 0,
      productos_principales: 0,
      productos_secundarios: 0,
      productos_ofertas: 0,
      total_productos: 0
    }
    
    // 9. VISUALIZACIONES TOTALES DEL PERÍODO
    const { rows: visualizacionesRows } = await pool.query(
      `SELECT SUM(contador) as total
       FROM visualizaciones_diarias
       WHERE emprendimiento_id = $1 AND fecha >= $2`,
      [emprendimientoId, fechaInicio]
    )
    
    const totalVisualizaciones = parseInt(visualizacionesRows[0]?.total) || 0
    
    // 10. CLIENTES ÚNICOS
    const { rows: clientesRows } = await pool.query(
      `SELECT COUNT(DISTINCT usuario_id) as clientes_unicos
       FROM transaccion_comercial
       WHERE emprendimiento_id = $1 AND created_at >= $2`,
      [emprendimientoId, fechaInicio]
    )
    
    const clientesUnicos = parseInt(clientesRows[0]?.clientes_unicos) || 0
    
    // 11. CLIENTES RECURRENTES
    const { rows: recurrentesRows } = await pool.query(
      `SELECT COUNT(*) as clientes_recurrentes
       FROM (
         SELECT usuario_id, COUNT(*) as pedidos
         FROM transaccion_comercial
         WHERE emprendimiento_id = $1 AND created_at >= $2
         GROUP BY usuario_id
         HAVING COUNT(*) > 1
       ) as clientes_con_multiples_pedidos`,
      [emprendimientoId, fechaInicio]
    )
    
    const clientesRecurrentes = parseInt(recurrentesRows[0]?.clientes_recurrentes) || 0
    
    // Construir respuesta
    const estadisticas = {
      periodo: nombrePeriodo,
      rendimiento: {
        total_pedidos: parseInt(rendimiento.total_pedidos) || 0,
        pedidos_entregados: parseInt(rendimiento.pedidos_entregados) || 0,
        pedidos_rechazados: parseInt(rendimiento.pedidos_rechazados) || 0,
        pedidos_cancelados: parseInt(rendimiento.pedidos_cancelados) || 0,
        tasa_exito: parseFloat(tasaExito),
        tasa_rechazo: parseFloat(tasaRechazo),
        ingresos_totales: parseFloat(rendimiento.ingresos_totales) || 0,
        ticket_promedio: parseFloat(rendimiento.ticket_promedio) || 0,
        tiempo_entrega_promedio: parseFloat(rendimiento.tiempo_entrega_promedio) || 0,
        cumplimiento_tiempo: parseFloat(cumplimientoTiempo),
        tiempo_comprometido_promedio: parseFloat(tiempoComprometidoPromedio),
        tiempo_real_promedio: parseFloat(tiempoRealPromedio),
        diferencia_tiempo_promedio: parseFloat(diferenciaTiempoPromedio)
      },
      rechazos: {
        top_motivos: rechazosRows.map(r => ({
          motivo: r.motivo_rechazo,
          cantidad: parseInt(r.cantidad),
          porcentaje: rendimiento.pedidos_rechazados > 0 
            ? ((parseInt(r.cantidad) / parseInt(rendimiento.pedidos_rechazados)) * 100).toFixed(1)
            : 0
        }))
      },
      productos: {
        total_productos: parseInt(productos.total_productos),
        productos_activos: parseInt(productos.productos_activos),
        productos_inactivos: parseInt(productos.productos_inactivos),
        por_categoria: {
          principal: parseInt(productos.productos_principales),
          secundario: parseInt(productos.productos_secundarios),
          oferta: parseInt(productos.productos_ofertas)
        },
        top_vendidos: productosRows.map(p => ({
          nombre: p.nombre,
          cantidad_vendida: parseInt(p.cantidad_vendida),
          ingresos: parseFloat(p.ingresos_generados),
          num_pedidos: parseInt(p.num_pedidos)
        }))
      },
      categorias_vendidas: categoriasRows.map(c => ({
        categoria: c.categoria,
        pedidos: parseInt(c.pedidos),
        unidades: parseInt(c.unidades_vendidas),
        ingresos: parseFloat(c.ingresos)
      })),
      horarios_pico: horariosRows.map(h => ({
        hora: parseInt(h.hora),
        pedidos: parseInt(h.pedidos),
        ingresos: parseFloat(h.ingresos)
      })),
      dias_semana: diasSemanaRows.map(d => ({
        dia: d.dia_nombre.trim(),
        dia_numero: parseInt(d.dia_numero),
        pedidos: parseInt(d.pedidos),
        ingresos: parseFloat(d.ingresos)
      })),
      clientes: {
        clientes_unicos: clientesUnicos,
        clientes_recurrentes: clientesRecurrentes,
        tasa_recurrencia: clientesUnicos > 0 
          ? ((clientesRecurrentes / clientesUnicos) * 100).toFixed(1)
          : 0
      },
      visualizaciones: {
        total_periodo: totalVisualizaciones,
        tasa_conversion: rendimiento.total_pedidos > 0 && totalVisualizaciones > 0
          ? ((rendimiento.total_pedidos / totalVisualizaciones) * 100).toFixed(1)
          : 0
      }
    }
    
    // Generar insights y recomendaciones
    const { insights, recomendaciones } = generarInsights(estadisticas)
    
    logger.success(`Estadísticas avanzadas del emprendimiento ${emprendimientoId} generadas`)
    res.json({
      ok: true,
      estadisticas,
      insights,
      recomendaciones
    })
  } catch (err) {
    logger.error('Error obteniendo estadísticas avanzadas:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

