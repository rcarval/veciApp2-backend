const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const notificationService = require('../services/notificationService')

// GET /api/pedidos - Obtener mis pedidos (cliente)
router.get('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Listando pedidos del cliente ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT tc.*, 
              e.nombre as emprendimiento_nombre,
              e.logo_url as emprendimiento_logo,
              e.telefono as emprendimiento_telefono
       FROM transaccion_comercial tc
       LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
       WHERE tc.usuario_id = $1
       AND NOT (tc.estado = 'rechazado' AND tc.rechazo_confirmado = false)
       ORDER BY tc.created_at DESC`,
      [userId]
    )
    
    logger.success(`Pedidos obtenidos: ${rows.length}`)
    res.json({ ok: true, pedidos: rows })
  } catch (err) {
    logger.error('Error listando pedidos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar pedidos' })
  }
})

// GET /api/pedidos/recibidos - Obtener pedidos recibidos (emprendedor o vendedor)
router.get('/recibidos', auth, async (req, res) => {
  try {
    const { id: userId, tipo_usuario } = req.auth
    logger.info(`Listando pedidos recibidos para usuario ${userId}, tipo: ${tipo_usuario}`)
    
    let emprendimientoIds = []
    let empDict = {}
    
    if (tipo_usuario === 'vendedor') {
      // Vendedor: obtener emprendimiento asignado
      const { rows: userRows } = await pool.query(
        'SELECT emprendimiento_asignado_id FROM usuarios WHERE id = $1',
        [userId]
      )
      
      if (!userRows.length || !userRows[0].emprendimiento_asignado_id) {
        return res.json({ ok: true, pedidos: [] })
      }
      
      const { rows: empRows } = await pool.query(
        'SELECT id, nombre as emprendimiento_nombre, logo_url as emprendimiento_logo FROM emprendimientos WHERE id = $1',
        [userRows[0].emprendimiento_asignado_id]
      )
      
      if (!empRows.length) {
        return res.json({ ok: true, pedidos: [] })
      }
      
      emprendimientoIds = [empRows[0].id]
      empDict[empRows[0].id] = { nombre: empRows[0].emprendimiento_nombre, logo: empRows[0].emprendimiento_logo }
    } else {
      // Emprendedor: obtener todos sus emprendimientos
      const { rows: empRows } = await pool.query(
        'SELECT id, nombre as emprendimiento_nombre, logo_url as emprendimiento_logo FROM emprendimientos WHERE usuario_id = $1',
        [userId]
      )
      
      if (!empRows.length) {
        return res.json({ ok: true, pedidos: [] })
      }
      
      emprendimientoIds = empRows.map(emp => emp.id)
      empRows.forEach(emp => {
        empDict[emp.id] = { nombre: emp.emprendimiento_nombre, logo: emp.emprendimiento_logo }
      })
    }
    
    const { rows } = await pool.query(
      `SELECT tc.*, 
              u.nombre as cliente_nombre,
              u.telefono as cliente_telefono,
              u.avatar_url as cliente_avatar,
              phc.total_pedidos,
              phc.primera_compra,
              phc.ultima_compra
       FROM transaccion_comercial tc
       LEFT JOIN usuarios u ON tc.usuario_id = u.id
       LEFT JOIN pedidos_historial_cliente phc ON phc.cliente_id = tc.usuario_id AND phc.emprendimiento_id = tc.emprendimiento_id
       WHERE tc.emprendimiento_id = ANY($1)
       ORDER BY tc.created_at ASC`,
      [emprendimientoIds]
    )
    
    // Mapear datos adicionales
    const pedidosMapeados = rows.map(pedido => ({
      ...pedido,
      emprendimiento_nombre: empDict[pedido.emprendimiento_id]?.nombre || '',
      emprendimiento_logo: empDict[pedido.emprendimiento_id]?.logo || null
    }))
    
    logger.success(`Pedidos recibidos obtenidos: ${rows.length}`)
    res.json({ ok: true, pedidos: pedidosMapeados })
  } catch (err) {
    logger.error('Error listando pedidos recibidos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar pedidos' })
  }
})

// GET /api/pedidos/:id - Obtener detalle de un pedido
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    logger.info(`Obteniendo pedido ${id}`)
    
    const { rows } = await pool.query(
      `SELECT tc.*, 
              e.nombre as emprendimiento_nombre,
              e.logo_url as emprendimiento_logo,
              e.telefono as emprendimiento_telefono,
              u.nombre as cliente_nombre,
              u.telefono as cliente_telefono
       FROM transaccion_comercial tc
       LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
       LEFT JOIN usuarios u ON tc.usuario_id = u.id
       WHERE tc.id = $1`,
      [id]
    )
    
    if (!rows.length) {
      logger.warn(`Pedido ${id} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' })
    }
    
    const pedido = rows[0]
    
    // Verificar que el usuario tenga permiso (sea cliente o emprendedor)
    const esCliente = pedido.usuario_id === userId
    const esEmprendedor = pedido.emprendimiento_id && await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [pedido.emprendimiento_id, userId]
    ).then(r => r.rowCount > 0)
    
    if (!esCliente && !esEmprendedor) {
      logger.warn(`Usuario ${userId} no tiene permiso para ver pedido ${id}`)
      return res.status(403).json({ ok: false, error: 'Sin permiso para ver este pedido' })
    }
    
    logger.success(`Pedido ${id} obtenido`)
    res.json({ ok: true, pedido })
  } catch (err) {
    logger.error('Error obteniendo pedido:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/pedidos - Crear nuevo pedido
router.post('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const {
      emprendimiento_id,
      productos, // Array de { producto_id, nombre, cantidad, precio_unitario, precio_oferta }
      direccion_entrega,
      telefono_cliente,
      modo_entrega, // 'delivery' o 'retiro'
      costo_delivery, // ✅ Costo de delivery
      cupon_aplicado, // ✅ Info del cupón { codigo, tipo_beneficio, valor, descuento_aplicado }
      subtotal, // ✅ Subtotal sin delivery ni descuentos
      total // ✅ Total final del frontend
    } = req.body || {}
    
    logger.info(`Creando pedido para emprendimiento ${emprendimiento_id}`)
    logger.db(`Body recibido: ${JSON.stringify({ emprendimiento_id, productos: productos?.length || 0, direccion_entrega, modo_entrega, costo_delivery, cupon_aplicado, subtotal, total })}`)
    
    // Validar campos obligatorios
    if (!emprendimiento_id || !productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (emprendimiento_id, productos)' })
    }
    
    if (!modo_entrega || !['delivery', 'retiro'].includes(modo_entrega)) {
      return res.status(400).json({ ok: false, error: 'modo_entrega debe ser "delivery" o "retiro"' })
    }
    
    // Verificar que el emprendimiento existe
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1',
      [emprendimiento_id]
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Calcular total en el backend (validación)
    const subtotalCalculado = productos.reduce((sum, prod) => {
      // Usar precio de oferta si existe, si no usar precio normal
      const precioFinal = (prod.precio_oferta && prod.precio_oferta > 0) ? prod.precio_oferta : prod.precio_unitario;
      return sum + (prod.cantidad * precioFinal);
    }, 0);
    
    const costoDeliveryFinal = costo_delivery || 0;
    const descuentoCuponFinal = cupon_aplicado?.descuento_aplicado || 0;
    const totalCalculado = subtotalCalculado + costoDeliveryFinal - descuentoCuponFinal;
    
    logger.info(`💰 Cálculo de totales - Subtotal: ${subtotalCalculado}, Delivery: ${costoDeliveryFinal}, Descuento: ${descuentoCuponFinal}, Total: ${totalCalculado}`);
    
    // Preparar detalle con subtotales y precios de oferta
    const detalle = productos.map(prod => {
      const precioFinal = (prod.precio_oferta && prod.precio_oferta > 0) ? prod.precio_oferta : prod.precio_unitario;
      return {
        producto_id: prod.producto_id,
        nombre: prod.nombre,
        cantidad: prod.cantidad,
        precio_unitario: prod.precio_unitario,
        precio_oferta: prod.precio_oferta || null, // ✅ Guardar precio de oferta
        precio_final: precioFinal, // ✅ Precio que realmente se cobra
        subtotal: prod.cantidad * precioFinal
      };
    });
    
    // Insertar pedido con campos adicionales
    const insert = `
      INSERT INTO transaccion_comercial 
      (usuario_id, emprendimiento_id, total, estado, detalle, 
       direccion_entrega, telefono_cliente, modo_entrega, 
       costo_delivery, cupon_codigo, descuento_cupon, subtotal)
      VALUES ($1, $2, $3, 'pendiente', $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `
    
    const { rows } = await pool.query(insert, [
      userId, 
      emprendimiento_id, 
      totalCalculado, // Usar total calculado del backend
      JSON.stringify(detalle),
      direccion_entrega || null, 
      telefono_cliente || null, 
      modo_entrega,
      costoDeliveryFinal, // ✅ Costo de delivery
      cupon_aplicado?.codigo || null, // ✅ Código del cupón
      descuentoCuponFinal, // ✅ Descuento aplicado
      subtotalCalculado // ✅ Subtotal de productos
    ])
    
    logger.success(`Pedido creado: ID ${rows[0].id}`)
    
    // Obtener datos del emprendimiento y emprendedor
    const { rows: empDataRows } = await pool.query(
      'SELECT e.usuario_id, e.nombre, u.nombre as emprendedor_nombre FROM emprendimientos e LEFT JOIN usuarios u ON e.usuario_id = u.id WHERE e.id = $1',
      [emprendimiento_id]
    )
    
    let emprendedorId = null
    let emprendimientoNombre = ''
    
    if (empDataRows.length > 0) {
      emprendedorId = empDataRows[0].usuario_id
      emprendimientoNombre = empDataRows[0].nombre
    }
    
    // Obtener datos del cliente
    const { rows: clienteRows } = await pool.query(
      'SELECT nombre FROM usuarios WHERE id = $1',
      [userId]
    )
    const clienteNombre = clienteRows[0]?.nombre || 'Un cliente'
    
    // Emitir evento WebSocket al emprendedor
    const io = req.app.get('io')
    if (io && emprendedorId) {
      io.emit(`pedido:nuevo:${emprendedorId}`, {
        pedido: rows[0],
        tipo: 'nuevo_pedido'
      })
      logger.info(`📡 Evento WebSocket emitido: pedido:nuevo:${emprendedorId}`)
      
      // Enviar notificación push al emprendedor
      notificationService.notificarNuevoPedido(
        emprendedorId,
        rows[0],
        { nombre: clienteNombre }
      ).catch(err => logger.error('Error enviando notificación push:', err.message))
    }
    
    // ✅ También emitir al CLIENTE para que actualice su popup
    if (io) {
      io.emit(`pedido:estado:${userId}`, {
        pedido: rows[0],
        pedidoId: rows[0].id,
        estado: 'pendiente',
        tipo: 'pedido_creado'
      })
      logger.info(`📡 Evento WebSocket emitido al cliente: pedido:estado:${userId}`)
    }
    
    // También emitir al vendedor asignado al emprendimiento (si existe)
    const { rows: vendedorRows } = await pool.query(
      'SELECT id, nombre FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2',
      [emprendimiento_id, 'vendedor']
    )
    if (vendedorRows.length > 0) {
      const vendedorId = vendedorRows[0].id
      
      if (io) {
        io.emit(`pedido:nuevo:${vendedorId}`, {
          pedido: rows[0],
          tipo: 'nuevo_pedido'
        })
        logger.info(`📡 Evento WebSocket emitido: pedido:nuevo:${vendedorId}`)
      }
      
      // Enviar notificación push al vendedor
      notificationService.notificarNuevoPedido(
        vendedorId,
        rows[0],
        { nombre: clienteNombre }
      ).catch(err => logger.error('Error enviando notificación push al vendedor:', err.message))
    }
    
    res.status(201).json({
      ok: true,
      mensaje: 'Pedido creado exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error creando pedido:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al crear pedido' })
  }
})

// PATCH /api/pedidos/:id/confirmar - Confirmar pedido (emprendedor)
router.patch('/:id/confirmar', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    const { tiempo_entrega_minutos } = req.body || {}
    
    logger.info(`Confirmando pedido ${id}`)
    
    // Verificar que el pedido existe y pertenece a uno de los emprendimientos del usuario
    const { tipo_usuario } = req.auth
    let pedidoRows = []
    
    if (tipo_usuario === 'vendedor') {
      // Vendedor: verificar que el pedido pertenece a su emprendimiento asignado
      const { rows: userRows } = await pool.query(
        'SELECT emprendimiento_asignado_id FROM usuarios WHERE id = $1',
        [userId]
      )
      
      if (userRows.length && userRows[0].emprendimiento_asignado_id) {
        const { rows: vendedorRows } = await pool.query(
          'SELECT tc.* FROM transaccion_comercial tc WHERE tc.id = $1 AND tc.emprendimiento_id = $2',
          [id, userRows[0].emprendimiento_asignado_id]
        )
        pedidoRows = vendedorRows
      }
    } else {
      // Emprendedor: verificar normalmente
      const { rows: empRows } = await pool.query(
        `SELECT tc.* FROM transaccion_comercial tc
         LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
         WHERE tc.id = $1 AND e.usuario_id = $2`,
        [id, userId]
      )
      pedidoRows = empRows
    }
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' })
    }
    
    const pedido = pedidoRows[0]
    
    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ ok: false, error: `El pedido ya está en estado: ${pedido.estado}` })
    }
    
    // Actualizar estado y tiempo de entrega si se proporciona
    const updates = ['estado = $1', 'updated_at = NOW()']
    const values = ['confirmado']
    let paramIndex = 2
    
    if (tiempo_entrega_minutos) {
      updates.push(`tiempo_entrega_minutos = $${paramIndex}`)
      values.push(tiempo_entrega_minutos)
      paramIndex++
    }
    
    values.push(id)
    
    const { rows } = await pool.query(
      `UPDATE transaccion_comercial 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )
    
    logger.success(`Pedido ${id} confirmado`)
    
    const pedidoConfirmado = rows[0]
    
    // Obtener datos del emprendimiento para la notificación
    const { rows: empDataRows } = await pool.query(
      'SELECT nombre FROM emprendimientos WHERE id = $1',
      [pedidoConfirmado.emprendimiento_id]
    )
    const emprendimientoNombre = empDataRows[0]?.nombre || 'El emprendimiento'
    
    // Emitir evento WebSocket al cliente
    const io = req.app.get('io')
    if (io && rows.length > 0) {
      const pedido = rows[0]
      io.emit(`pedido:estado:${pedido.usuario_id}`, {
        pedidoId: id,
        estado: 'confirmado',
        pedido: pedido,
        tipo: 'pedido_confirmado'
      })
      logger.info(`📡 Evento WebSocket emitido: pedido:estado:${pedido.usuario_id}`)
      
      // Enviar notificación push al cliente
      notificationService.notificarPedidoConfirmado(
        pedido.usuario_id,
        pedido,
        { nombre: emprendimientoNombre }
      ).catch(err => logger.error('Error enviando notificación push al cliente:', err.message))
      
      // También emitir al emprendedor y vendedor (si no es el que está confirmando)
      const { rows: empRows } = await pool.query(
        'SELECT usuario_id FROM emprendimientos WHERE id = $1',
        [pedido.emprendimiento_id]
      )
      
      if (empRows.length > 0) {
        // ✅ SIEMPRE emitir al emprendedor (para actualizar su contador de badge)
        const emprendedorId = empRows[0].usuario_id
        io.emit(`pedido:estado:${emprendedorId}`, {
          pedidoId: id,
          estado: 'confirmado',
          pedido: pedido,
          tipo: 'pedido_confirmado',
          esPropio: emprendedorId === userId
        })
        logger.info(`📡 Evento WebSocket emitido: pedido:estado:${emprendedorId} (propio: ${emprendedorId === userId})`)
      }
      
      // Buscar y notificar al vendedor (si existe)
      const { rows: vendedorRows } = await pool.query(
        'SELECT id FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2',
        [pedido.emprendimiento_id, 'vendedor']
      )
      if (vendedorRows.length > 0) {
        // ✅ SIEMPRE emitir al vendedor (para actualizar su contador)
        const vendedorId = vendedorRows[0].id
        io.emit(`pedido:estado:${vendedorId}`, {
          pedidoId: id,
          estado: 'confirmado',
          pedido: pedido,
          tipo: 'pedido_confirmado',
          esPropio: vendedorId === userId
        })
        logger.info(`📡 Evento WebSocket emitido: pedido:estado:${vendedorId} (propio: ${vendedorId === userId})`)
      }
    }
    
    res.json({
      ok: true,
      mensaje: 'Pedido confirmado exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error confirmando pedido:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/pedidos/:id/estado - Cambiar estado del pedido
router.patch('/:id/estado', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    const { estado, motivo_rechazo } = req.body || {}
    
    logger.info(`Cambiando estado del pedido ${id} a ${estado}`)
    logger.db(`Body recibido: ${JSON.stringify(req.body)}`)
    
    // Validar estado
    const estadosValidos = ['pendiente', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado']
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}` })
    }
    
    // Verificar que el pedido existe y pertenece a uno de los emprendimientos del usuario
    const { tipo_usuario } = req.auth
    let pedidoRows = []
    
    if (tipo_usuario === 'vendedor') {
      // Vendedor: verificar que el pedido pertenece a su emprendimiento asignado
      const { rows: userRows } = await pool.query(
        'SELECT emprendimiento_asignado_id FROM usuarios WHERE id = $1',
        [userId]
      )
      
      if (userRows.length && userRows[0].emprendimiento_asignado_id) {
        const { rows: vendedorRows } = await pool.query(
          'SELECT tc.* FROM transaccion_comercial tc WHERE tc.id = $1 AND tc.emprendimiento_id = $2',
          [id, userRows[0].emprendimiento_asignado_id]
        )
        pedidoRows = vendedorRows
      }
    } else {
      // Emprendedor o cliente: verificar normalmente
      const { rows: empRows } = await pool.query(
        `SELECT tc.* FROM transaccion_comercial tc
         LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
         WHERE tc.id = $1 AND e.usuario_id = $2`,
        [id, userId]
      )
      pedidoRows = empRows
    }
    
    if (!pedidoRows.length) {
      // Verificar si es el cliente quien lo cancela
      const { rows: clienteRows } = await pool.query(
        'SELECT * FROM transaccion_comercial WHERE id = $1 AND usuario_id = $2',
        [id, userId]
      )
      
      if (!clienteRows.length) {
        return res.status(404).json({ ok: false, error: 'Pedido no encontrado' })
      }
      
      // Solo el cliente puede cancelar (otros estados requieren ser emprendedor o vendedor)
      if (estado !== 'cancelado') {
        return res.status(403).json({ ok: false, error: 'Solo el emprendedor o vendedor puede cambiar el estado a ' + estado })
      }
    }
    
    // Si es rechazo, validar que tenga motivo
    if (estado === 'rechazado' && !motivo_rechazo) {
      return res.status(400).json({ ok: false, error: 'Se requiere motivo de rechazo' })
    }
    
    // Actualizar estado y motivo de rechazo si se proporciona
    const updates = ['estado = $1', 'updated_at = NOW()']
    const values = [estado]
    let paramIndex = 2
    
    if (motivo_rechazo) {
      updates.push(`motivo_rechazo = $${paramIndex}`)
      values.push(motivo_rechazo)
      paramIndex++
    }
    
    values.push(id)
    
    const { rows } = await pool.query(
      `UPDATE transaccion_comercial 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    )
    
    logger.success(`Estado del pedido ${id} actualizado a ${estado}`)
    
    const pedidoActualizado = rows[0]
    
    // Obtener datos del emprendimiento para las notificaciones
    const { rows: empDataRows } = await pool.query(
      'SELECT nombre FROM emprendimientos WHERE id = $1',
      [pedidoActualizado.emprendimiento_id]
    )
    const emprendimientoNombre = empDataRows[0]?.nombre || 'El emprendimiento'
    
    // Emitir evento WebSocket al cliente
    const io = req.app.get('io')
    if (io && rows.length > 0) {
      const pedido = rows[0]
      io.emit(`pedido:estado:${pedido.usuario_id}`, {
        pedidoId: id,
        estado: estado,
        pedido: pedido,
        tipo: 'cambio_estado'
      })
      logger.info(`📡 Evento WebSocket emitido: pedido:estado:${pedido.usuario_id}`)
      
      // Enviar notificaciones push según el estado
      if (estado === 'en_camino') {
        notificationService.notificarPedidoEnCamino(
          pedido.usuario_id,
          pedido,
          { nombre: emprendimientoNombre }
        ).catch(err => logger.error('Error enviando notificación push:', err.message))
      } else if (estado === 'entregado') {
        notificationService.notificarPedidoEntregado(
          pedido.usuario_id,
          pedido,
          { nombre: emprendimientoNombre }
        ).catch(err => logger.error('Error enviando notificación push:', err.message))
      } else if (estado === 'rechazado') {
        notificationService.notificarPedidoRechazado(
          pedido.usuario_id,
          pedido,
          { nombre: emprendimientoNombre },
          motivo_rechazo || 'No especificado'
        ).catch(err => logger.error('Error enviando notificación push:', err.message))
      }
      
      // También emitir al emprendedor y vendedor (si lo cambia un emprendedor o vendedor)
      // Buscar emprendimiento para obtener el emprendedor y el vendedor
      const { rows: empRows } = await pool.query(
        'SELECT usuario_id FROM emprendimientos WHERE id = $1',
        [pedido.emprendimiento_id]
      )
      
      if (empRows.length > 0) {
        // ✅ SIEMPRE emitir al emprendedor (para actualizar su contador de badge)
        const emprendedorId = empRows[0].usuario_id
        io.emit(`pedido:estado:${emprendedorId}`, {
          pedidoId: id,
          estado: estado,
          pedido: pedido,
          tipo: 'cambio_estado',
          esPropio: emprendedorId === userId // Flag para saber si es su propia acción
        })
        logger.info(`📡 Evento WebSocket emitido: pedido:estado:${emprendedorId} (propio: ${emprendedorId === userId})`)
      }
      
      // Buscar y notificar al vendedor (si existe)
      const { rows: vendedorRows } = await pool.query(
        'SELECT id FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2',
        [pedido.emprendimiento_id, 'vendedor']
      )
      if (vendedorRows.length > 0) {
        // ✅ SIEMPRE emitir al vendedor (para actualizar su contador)
        const vendedorId = vendedorRows[0].id
        io.emit(`pedido:estado:${vendedorId}`, {
          pedidoId: id,
          estado: estado,
          pedido: pedido,
          tipo: 'cambio_estado',
          esPropio: vendedorId === userId
        })
        logger.info(`📡 Evento WebSocket emitido: pedido:estado:${vendedorId} (propio: ${vendedorId === userId})`)
      }
    }
    
    res.json({
      ok: true,
      mensaje: 'Estado actualizado exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error cambiando estado:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/pedidos/:id/confirmar-rechazo - Confirmar que el cliente vio el rechazo
router.patch('/:id/confirmar-rechazo', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Confirmando rechazo del pedido ${id} por cliente ${userId}`)
    
    // Verificar que el pedido existe y pertenece al usuario
    const { rows: pedidoRows } = await pool.query(
      'SELECT * FROM transaccion_comercial WHERE id = $1 AND usuario_id = $2 AND estado = $3',
      [id, userId, 'rechazado']
    )
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido rechazado no encontrado' })
    }
    
    // Marcar rechazo como confirmado
    const { rows } = await pool.query(
      `UPDATE transaccion_comercial 
       SET rechazo_confirmado = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )
    
    logger.success(`Rechazo del pedido ${id} confirmado por cliente`)
    res.json({
      ok: true,
      mensaje: 'Rechazo confirmado exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error confirmando rechazo:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/pedidos/:id/confirmar-cancelacion - Confirmar que el emprendedor aceptó la cancelación
router.patch('/:id/confirmar-cancelacion', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Confirmando cancelación del pedido ${id} por emprendedor ${userId}`)
    
    // Verificar que el pedido existe y pertenece a uno de los emprendimientos del usuario
    const { tipo_usuario } = req.auth
    let pedidoRows = []
    
    if (tipo_usuario === 'vendedor') {
      // Vendedor: verificar que el pedido pertenece a su emprendimiento asignado
      const { rows: userRows } = await pool.query(
        'SELECT emprendimiento_asignado_id FROM usuarios WHERE id = $1',
        [userId]
      )
      
      if (userRows.length && userRows[0].emprendimiento_asignado_id) {
        const { rows: vendedorRows } = await pool.query(
          'SELECT tc.* FROM transaccion_comercial tc WHERE tc.id = $1 AND tc.emprendimiento_id = $2 AND tc.estado = $3',
          [id, userRows[0].emprendimiento_asignado_id, 'cancelado']
        )
        pedidoRows = vendedorRows
      }
    } else {
      // Emprendedor: verificar normalmente
      const { rows: empRows } = await pool.query(
        `SELECT tc.* FROM transaccion_comercial tc
         LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
         WHERE tc.id = $1 AND e.usuario_id = $2 AND tc.estado = $3`,
        [id, userId, 'cancelado']
      )
      pedidoRows = empRows
    }
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido cancelado no encontrado' })
    }
    
    // Marcar cancelación como confirmada
    const { rows } = await pool.query(
      `UPDATE transaccion_comercial 
       SET cancelacion_confirmada = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )
    
    logger.success(`Cancelación del pedido ${id} confirmada por emprendedor`)
    res.json({
      ok: true,
      mensaje: 'Cancelación confirmada exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error confirmando cancelación:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/pedidos/:id/confirmar-entrega - Confirmar que el cliente recibió el pedido
router.patch('/:id/confirmar-entrega', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Confirmando entrega del pedido ${id} por cliente ${userId}`)
    
    // Verificar que el pedido existe, pertenece al usuario y está en estado entregado
    const { rows: pedidoRows } = await pool.query(
      'SELECT * FROM transaccion_comercial WHERE id = $1 AND usuario_id = $2 AND estado = $3',
      [id, userId, 'entregado']
    )
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido entregado no encontrado' })
    }
    
    // Marcar entrega como confirmada
    const { rows } = await pool.query(
      `UPDATE transaccion_comercial 
       SET entrega_confirmada = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    )
    
    logger.success(`Entrega del pedido ${id} confirmada por cliente`)
    res.json({
      ok: true,
      mensaje: 'Entrega confirmada exitosamente',
      pedido: rows[0]
    })
  } catch (err) {
    logger.error('Error confirmando entrega:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/pedidos/:id/calificar-cliente - Calificar a un cliente por el emprendedor
router.post('/:id/calificar-cliente', auth, async (req, res) => {
  try {
    const { id: pedidoId } = req.params
    const { id: emprendedorId } = req.auth
    const { puntualidad, comunicacion, amabilidad, cooperacion } = req.body || {}
    
    logger.info(`Calificando cliente del pedido ${pedidoId} por emprendedor ${emprendedorId}`)
    
    // Validar que todos los criterios estén presentes
    if (!puntualidad || !comunicacion || !amabilidad || !cooperacion) {
      return res.status(400).json({ ok: false, error: 'Se requieren todos los criterios de calificación' })
    }
    
    // Verificar que los valores estén en el rango correcto
    const criterios = [puntualidad, comunicacion, amabilidad, cooperacion]
    if (criterios.some(val => val < 1 || val > 5)) {
      return res.status(400).json({ ok: false, error: 'Las calificaciones deben estar entre 1 y 5' })
    }
    
    // Verificar que el pedido existe y pertenece a un emprendimiento del usuario
    const { rows: pedidoRows } = await pool.query(
      `SELECT tc.*, e.usuario_id as emprendedor_user_id 
       FROM transaccion_comercial tc
       LEFT JOIN emprendimientos e ON tc.emprendimiento_id = e.id
       WHERE tc.id = $1 AND e.usuario_id = $2`,
      [pedidoId, emprendedorId]
    )
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' })
    }
    
    const pedido = pedidoRows[0]
    
    // Calcular calificación general
    const calificacionGeneral = (puntualidad + comunicacion + amabilidad + cooperacion) / 4
    
    // Guardar o actualizar calificación
    const { rows } = await pool.query(
      `INSERT INTO calificaciones_cliente 
       (pedido_id, emprendedor_id, cliente_id, calificacion_general, puntualidad, comunicacion, amabilidad, cooperacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (pedido_id, emprendedor_id) 
       DO UPDATE SET
         calificacion_general = EXCLUDED.calificacion_general,
         puntualidad = EXCLUDED.puntualidad,
         comunicacion = EXCLUDED.comunicacion,
         amabilidad = EXCLUDED.amabilidad,
         cooperacion = EXCLUDED.cooperacion,
         updated_at = NOW()
       RETURNING *`,
      [pedidoId, emprendedorId, pedido.usuario_id, calificacionGeneral, puntualidad, comunicacion, amabilidad, cooperacion]
    )
    
    logger.success(`Calificación del cliente guardada para pedido ${pedidoId}`)
    res.json({
      ok: true,
      mensaje: 'Calificación guardada exitosamente',
      calificacion: rows[0]
    })
  } catch (err) {
    logger.error('Error calificando cliente:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/pedidos/:id/calificacion-cliente - Obtener calificación promedio de un cliente
router.get('/cliente/:clienteId/calificacion', auth, async (req, res) => {
  try {
    const { clienteId } = req.params
    
    logger.info(`Obteniendo calificación promedio del cliente ${clienteId}`)
    
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) as total_calificaciones,
         AVG(calificacion_general)::NUMERIC(3,2) as calificacion_promedio,
         AVG(puntualidad)::NUMERIC(3,2) as puntualidad_promedio,
         AVG(comunicacion)::NUMERIC(3,2) as comunicacion_promedio,
         AVG(amabilidad)::NUMERIC(3,2) as amabilidad_promedio,
         AVG(cooperacion)::NUMERIC(3,2) as cooperacion_promedio
       FROM calificaciones_cliente
       WHERE cliente_id = $1`,
      [clienteId]
    )
    
    if (!rows[0].total_calificaciones || rows[0].total_calificaciones === 0) {
      return res.json({
        ok: true,
        calificacion: {
          total_calificaciones: 0,
          calificacion_promedio: 0,
          puntualidad_promedio: 0,
          comunicacion_promedio: 0,
          amabilidad_promedio: 0,
          cooperacion_promedio: 0
        }
      })
    }
    
    logger.success(`Calificación promedio del cliente ${clienteId}: ${rows[0].calificacion_promedio}`)
    res.json({
      ok: true,
      calificacion: rows[0]
    })
  } catch (err) {
    logger.error('Error obteniendo calificación del cliente:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/pedidos/:id/calificar-emprendimiento - Calificar a un emprendimiento por el cliente
router.post('/:id/calificar-emprendimiento', auth, async (req, res) => {
  try {
    const { id: pedidoId } = req.params
    const { id: clienteId } = req.auth
    const { precio, calidad, servicio, tiempo_entrega, comentario } = req.body || {}
    
    logger.info(`Calificando emprendimiento del pedido ${pedidoId} por cliente ${clienteId}`)
    
    // Validar que todos los criterios estén presentes
    if (!precio || !calidad || !servicio || !tiempo_entrega) {
      return res.status(400).json({ ok: false, error: 'Se requieren todos los criterios de calificación' })
    }
    
    // Verificar que los valores estén en el rango correcto
    const criterios = [precio, calidad, servicio, tiempo_entrega]
    if (criterios.some(val => val < 1 || val > 5)) {
      return res.status(400).json({ ok: false, error: 'Las calificaciones deben estar entre 1 y 5' })
    }
    
    // Verificar que el pedido existe y pertenece al cliente
    const { rows: pedidoRows } = await pool.query(
      `SELECT tc.emprendimiento_id, tc.estado 
       FROM transaccion_comercial tc
       WHERE tc.id = $1 AND tc.usuario_id = $2`,
      [pedidoId, clienteId]
    )
    
    if (!pedidoRows.length) {
      return res.status(404).json({ ok: false, error: 'Pedido no encontrado' })
    }
    
    const pedido = pedidoRows[0]
    const emprendimientoId = pedido.emprendimiento_id
    
    // Calcular calificación general
    const calificacionGeneral = (precio + calidad + servicio + tiempo_entrega) / 4
    
    // Guardar calificación
    const { rows } = await pool.query(
      `INSERT INTO calificaciones_emprendimiento 
       (cliente_id, emprendimiento_id, pedido_id, precio, calidad, servicio, tiempo_entrega, calificacion_general, comentario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [clienteId, emprendimientoId, pedidoId, precio, calidad, servicio, tiempo_entrega, calificacionGeneral, comentario || null]
    )
    
    logger.success(`Calificación del emprendimiento ${emprendimientoId} guardada para pedido ${pedidoId}`)
    res.json({
      ok: true,
      mensaje: 'Calificación guardada exitosamente',
      calificacion: rows[0]
    })
  } catch (err) {
    logger.error('Error calificando emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/pedidos/emprendimiento/:emprendimientoId/calificacion - Obtener calificación promedio de un emprendimiento
router.get('/emprendimiento/:emprendimientoId/calificacion', async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    
    logger.info(`Obteniendo calificación promedio del emprendimiento ${emprendimientoId}`)
    
    const { rows } = await pool.query(
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
    
    if (!rows[0].total_calificaciones || rows[0].total_calificaciones === 0) {
      return res.json({
        ok: true,
        calificacion: {
          total_calificaciones: 0,
          calificacion_promedio: 0,
          precio_promedio: 0,
          calidad_promedio: 0,
          servicio_promedio: 0,
          tiempo_entrega_promedio: 0
        }
      })
    }
    
    logger.success(`Calificación promedio del emprendimiento ${emprendimientoId}: ${rows[0].calificacion_promedio}`)
    res.json({
      ok: true,
      calificacion: rows[0]
    })
  } catch (err) {
    logger.error('Error obteniendo calificación del emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

