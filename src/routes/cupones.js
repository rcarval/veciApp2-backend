const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

// =====================================================
// POST /api/cupones/validar - Validar un cupón
// =====================================================
router.post('/validar', auth, async (req, res) => {
  try {
    const { id: userId, tipo_usuario } = req.auth
    const { codigo } = req.body
    
    if (!codigo || codigo.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'El código del cupón es obligatorio' })
    }
    
    logger.info(`Validando cupón: ${codigo} para usuario ${userId} (${tipo_usuario})`)
    
    // Buscar el cupón
    const { rows: cuponRows } = await pool.query(
      `SELECT c.*, 
              e.nombre as emprendimiento_nombre,
              p.nombre as producto_nombre
       FROM cupones c
       LEFT JOIN emprendimientos e ON c.emprendimiento_id = e.id
       LEFT JOIN productos p ON c.producto_id = p.id
       WHERE UPPER(c.codigo) = UPPER($1)`,
      [codigo.trim()]
    )
    
    if (cuponRows.length === 0) {
      logger.warn(`Cupón no encontrado: ${codigo}`)
      return res.status(404).json({ 
        ok: false, 
        error: 'Cupón no válido',
        detalle: 'El código ingresado no existe o ha sido eliminado'
      })
    }
    
    const cupon = cuponRows[0]
    
    // Validaciones
    const validaciones = []
    
    // 1. Verificar si está activo
    if (!cupon.activo) {
      validaciones.push('Este cupón ha sido desactivado')
    }
    
    // 2. Verificar fecha de inicio
    if (cupon.fecha_inicio && new Date() < new Date(cupon.fecha_inicio)) {
      validaciones.push('Este cupón aún no está disponible')
    }
    
    // 3. Verificar fecha de expiración
    if (cupon.fecha_expiracion && new Date() > new Date(cupon.fecha_expiracion)) {
      validaciones.push('Este cupón ha expirado')
    }
    
    // 4. Verificar usos máximos
    if (cupon.usos_maximos !== null && cupon.usos_actuales >= cupon.usos_maximos) {
      validaciones.push('Este cupón ha alcanzado su límite de usos')
    }
    
    // 5. Verificar tipo de usuario
    if (cupon.tipo_usuario !== 'ambos' && cupon.tipo_usuario !== tipo_usuario) {
      const tipoRequerido = cupon.tipo_usuario === 'emprendedor' ? 'emprendedores' : 'clientes'
      validaciones.push(`Este cupón es exclusivo para ${tipoRequerido}`)
    }
    
    // 6. Verificar si el usuario ya usó este cupón
    const { rows: usosRows } = await pool.query(
      'SELECT COUNT(*) as total FROM cupones_usuarios WHERE cupon_id = $1 AND usuario_id = $2',
      [cupon.id, userId]
    )
    
    const usosUsuario = parseInt(usosRows[0].total)
    if (cupon.usos_por_usuario && usosUsuario >= cupon.usos_por_usuario) {
      validaciones.push('Ya has usado este cupón el máximo de veces permitidas')
    }
    
    // Si hay errores de validación, retornar
    if (validaciones.length > 0) {
      logger.warn(`Cupón ${codigo} no válido: ${validaciones.join(', ')}`)
      return res.json({
        ok: false,
        valido: false,
        error: validaciones[0],
        validaciones: validaciones,
        cupon: null
      })
    }
    
    // Cupón válido
    logger.success(`✅ Cupón ${codigo} válido para usuario ${userId}`)
    
    res.json({
      ok: true,
      valido: true,
      mensaje: 'Cupón válido',
      cupon: {
        id: cupon.id,
        codigo: cupon.codigo,
        descripcion: cupon.descripcion,
        tipo_beneficio: cupon.tipo_beneficio,
        tipo_usuario: cupon.tipo_usuario,
        valor_beneficio: cupon.valor_beneficio,
        emprendimiento_id: cupon.emprendimiento_id,
        emprendimiento_nombre: cupon.emprendimiento_nombre,
        producto_id: cupon.producto_id,
        producto_nombre: cupon.producto_nombre,
        fecha_expiracion: cupon.fecha_expiracion,
        usos_disponibles: cupon.usos_maximos ? (cupon.usos_maximos - cupon.usos_actuales) : null,
        usos_usuario_restantes: cupon.usos_por_usuario ? (cupon.usos_por_usuario - usosUsuario) : null
      }
    })
  } catch (err) {
    logger.error('Error validando cupón:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al validar cupón' })
  }
})

// =====================================================
// POST /api/cupones/canjear - Canjear un cupón
// =====================================================
router.post('/canjear', auth, async (req, res) => {
  try {
    const { id: userId, tipo_usuario } = req.auth
    const { codigo } = req.body
    
    if (!codigo || codigo.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'El código del cupón es obligatorio' })
    }
    
    logger.info(`Canjeando cupón: ${codigo} para usuario ${userId}`)
    
    // Iniciar transacción
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Buscar y bloquear el cupón (FOR UPDATE para evitar race conditions)
      const { rows: cuponRows } = await client.query(
        'SELECT * FROM cupones WHERE UPPER(codigo) = UPPER($1) FOR UPDATE',
        [codigo.trim()]
      )
      
      if (cuponRows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ ok: false, error: 'Cupón no válido' })
      }
      
      const cupon = cuponRows[0]
      
      // Realizar todas las validaciones (igual que en /validar)
      if (!cupon.activo) {
        await client.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Este cupón ha sido desactivado' })
      }
      
      if (cupon.fecha_inicio && new Date() < new Date(cupon.fecha_inicio)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Este cupón aún no está disponible' })
      }
      
      if (cupon.fecha_expiracion && new Date() > new Date(cupon.fecha_expiracion)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Este cupón ha expirado' })
      }
      
      if (cupon.usos_maximos !== null && cupon.usos_actuales >= cupon.usos_maximos) {
        await client.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Este cupón ha alcanzado su límite de usos' })
      }
      
      if (cupon.tipo_usuario !== 'ambos' && cupon.tipo_usuario !== tipo_usuario) {
        await client.query('ROLLBACK')
        const tipoRequerido = cupon.tipo_usuario === 'emprendedor' ? 'emprendedores' : 'clientes'
        return res.status(400).json({ ok: false, error: `Este cupón es exclusivo para ${tipoRequerido}` })
      }
      
      // Verificar usos por usuario
      const { rows: usosRows } = await client.query(
        'SELECT COUNT(*) as total FROM cupones_usuarios WHERE cupon_id = $1 AND usuario_id = $2',
        [cupon.id, userId]
      )
      
      const usosUsuario = parseInt(usosRows[0].total)
      if (cupon.usos_por_usuario && usosUsuario >= cupon.usos_por_usuario) {
        await client.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Ya has usado este cupón el máximo de veces permitidas' })
      }
      
      // Calcular fecha de expiración del beneficio
      let fechaExpiracionBeneficio = null
      
      if (cupon.tipo_beneficio === 'premium_gratis') {
        // El beneficio expira después de N días
        fechaExpiracionBeneficio = new Date()
        fechaExpiracionBeneficio.setDate(fechaExpiracionBeneficio.getDate() + cupon.valor_beneficio)
      } else if (cupon.fecha_expiracion) {
        // Para descuentos, usar la fecha de expiración del cupón
        fechaExpiracionBeneficio = cupon.fecha_expiracion
      }
      
      // Registrar el canje
      const { rows: canjeRows } = await client.query(
        `INSERT INTO cupones_usuarios (cupon_id, usuario_id, fecha_expiracion_beneficio, estado)
         VALUES ($1, $2, $3, 'activo')
         RETURNING *`,
        [cupon.id, userId, fechaExpiracionBeneficio]
      )
      
      const canje = canjeRows[0]
      
      // Incrementar usos del cupón
      await client.query(
        'UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = $1',
        [cupon.id]
      )
      
      // Si es premium gratis, crear beneficio activo Y actualizar plan del usuario
      if (cupon.tipo_beneficio === 'premium_gratis') {
        await client.query(
          `INSERT INTO beneficios_activos 
           (usuario_id, cupon_usuario_id, tipo_beneficio, descripcion, valor, fecha_expiracion)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, canje.id, cupon.tipo_beneficio, cupon.descripcion, cupon.valor_beneficio, fechaExpiracionBeneficio]
        )
        
        // Verificar si el usuario ya tiene plan premium activo
        const { rows: usuarioRows } = await client.query(
          'SELECT plan_id, vigencia_hasta FROM usuarios WHERE id = $1',
          [userId]
        )
        
        const usuarioActual = usuarioRows[0]
        const tienePremiumActivo = usuarioActual.plan_id === 2
        
        let nuevaVigencia = new Date()
        
        if (tienePremiumActivo && usuarioActual.vigencia_hasta) {
          // Si ya tiene premium, extender desde la fecha de vigencia actual
          const vigenciaActual = new Date(usuarioActual.vigencia_hasta)
          
          // Si la vigencia actual es futura, extender desde ahí
          if (vigenciaActual > nuevaVigencia) {
            nuevaVigencia = new Date(vigenciaActual)
          }
          
          // Agregar los días del cupón
          nuevaVigencia.setDate(nuevaVigencia.getDate() + cupon.valor_beneficio)
          
          logger.info(`📅 Extendiendo plan premium existente: ${usuarioActual.vigencia_hasta} → ${nuevaVigencia}`)
        } else {
          // Si no tiene premium, activarlo desde ahora
          nuevaVigencia.setDate(nuevaVigencia.getDate() + cupon.valor_beneficio)
          
          logger.info(`🆕 Activando plan premium nuevo: ${nuevaVigencia}`)
        }
        
        // Actualizar el usuario con el plan premium
        await client.query(
          `UPDATE usuarios 
           SET plan_id = 2,
               fecha_suscripcion = COALESCE(fecha_suscripcion, NOW()),
               vigencia_hasta = $1,
               estado_suscripcion = 'activa',
               metodo_pago = COALESCE(metodo_pago, 'cupón'),
               fecha_actualizacion = NOW()
           WHERE id = $2`,
          [nuevaVigencia, userId]
        )
        
        logger.success(`✅ Plan premium ${tienePremiumActivo ? 'extendido' : 'activado'} hasta ${nuevaVigencia} para usuario ${userId}`)
      }
      
      // Si es un descuento, también crear beneficio activo
      if (cupon.tipo_beneficio === 'descuento_porcentaje' || cupon.tipo_beneficio === 'descuento_monto' || cupon.tipo_beneficio === 'envio_gratis') {
        await client.query(
          `INSERT INTO beneficios_activos 
           (usuario_id, cupon_usuario_id, tipo_beneficio, descripcion, valor, fecha_expiracion)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, canje.id, cupon.tipo_beneficio, cupon.descripcion, cupon.valor_beneficio, fechaExpiracionBeneficio]
        )
        
        logger.success(`✅ Beneficio de descuento creado para usuario ${userId}`)
      }
      
      await client.query('COMMIT')
      
      logger.success(`✅ Cupón ${codigo} canjeado por usuario ${userId}`)
      
      res.json({
        ok: true,
        mensaje: '¡Cupón canjeado exitosamente!',
        canje: {
          id: canje.id,
          cupon_codigo: cupon.codigo,
          descripcion: cupon.descripcion,
          tipo_beneficio: cupon.tipo_beneficio,
          valor_beneficio: cupon.valor_beneficio,
          fecha_canje: canje.fecha_canje,
          fecha_expiracion: fechaExpiracionBeneficio
        }
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error('Error canjeando cupón:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al canjear cupón' })
  }
})

// =====================================================
// GET /api/cupones/mis-cupones - Obtener cupones canjeados del usuario
// =====================================================
router.get('/mis-cupones', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo cupones del usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT cu.id, cu.fecha_canje, cu.fecha_expiracion_beneficio, cu.estado,
              c.codigo, c.descripcion, c.tipo_beneficio, c.valor_beneficio,
              c.emprendimiento_id, c.producto_id,
              e.nombre as emprendimiento_nombre,
              p.nombre as producto_nombre
       FROM cupones_usuarios cu
       JOIN cupones c ON cu.cupon_id = c.id
       LEFT JOIN emprendimientos e ON c.emprendimiento_id = e.id
       LEFT JOIN productos p ON c.producto_id = p.id
       WHERE cu.usuario_id = $1
       ORDER BY cu.fecha_canje DESC`,
      [userId]
    )
    
    logger.success(`Cupones obtenidos: ${rows.length}`)
    res.json({ ok: true, cupones: rows })
  } catch (err) {
    logger.error('Error obteniendo cupones del usuario:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// =====================================================
// GET /api/cupones/beneficios-activos - Obtener beneficios activos del usuario
// =====================================================
router.get('/beneficios-activos', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo beneficios activos del usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT ba.*, cu.cupon_id, c.codigo, c.emprendimiento_id, c.producto_id
       FROM beneficios_activos ba
       LEFT JOIN cupones_usuarios cu ON ba.cupon_usuario_id = cu.id
       LEFT JOIN cupones c ON cu.cupon_id = c.id
       WHERE ba.usuario_id = $1 
         AND ba.activo = true 
         AND (ba.fecha_expiracion IS NULL OR ba.fecha_expiracion > NOW())
       ORDER BY ba.fecha_expiracion NULLS LAST, ba.fecha_inicio DESC`,
      [userId]
    )
    
    logger.success(`Beneficios activos obtenidos: ${rows.length}`)
    res.json({ ok: true, beneficios: rows })
  } catch (err) {
    logger.error('Error obteniendo beneficios activos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// =====================================================
// POST /api/cupones/usar-beneficio - Marcar beneficio como usado
// =====================================================
router.post('/usar-beneficio', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { beneficio_id, transaccion_id } = req.body
    
    logger.info(`Marcando beneficio ${beneficio_id} como usado en transacción ${transaccion_id}`)
    
    // Verificar que el beneficio pertenece al usuario
    const { rows: beneficioRows } = await pool.query(
      'SELECT * FROM beneficios_activos WHERE id = $1 AND usuario_id = $2',
      [beneficio_id, userId]
    )
    
    if (beneficioRows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Beneficio no encontrado' })
    }
    
    const beneficio = beneficioRows[0]
    
    // Actualizar cupon_usuario con la transacción
    if (beneficio.cupon_usuario_id) {
      await pool.query(
        `UPDATE cupones_usuarios 
         SET transaccion_id = $1, estado = 'usado', updated_at = NOW()
         WHERE id = $2`,
        [transaccion_id, beneficio.cupon_usuario_id]
      )
    }
    
    // Desactivar el beneficio
    await pool.query(
      'UPDATE beneficios_activos SET activo = false, updated_at = NOW() WHERE id = $1',
      [beneficio_id]
    )
    
    logger.success(`✅ Beneficio ${beneficio_id} marcado como usado`)
    res.json({ ok: true, mensaje: 'Beneficio aplicado exitosamente' })
  } catch (err) {
    logger.error('Error usando beneficio:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// =====================================================
// RUTAS ADMIN - Crear y gestionar cupones
// =====================================================

// GET /api/cupones/admin/todos - Listar todos los cupones (solo admin)
router.get('/admin/todos', auth, async (req, res) => {
  try {
    const { tipo_usuario } = req.auth
    
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado' })
    }
    
    const { rows } = await pool.query(
      `SELECT c.*, 
              e.nombre as emprendimiento_nombre,
              p.nombre as producto_nombre,
              u.nombre as creador_nombre
       FROM cupones c
       LEFT JOIN emprendimientos e ON c.emprendimiento_id = e.id
       LEFT JOIN productos p ON c.producto_id = p.id
       LEFT JOIN usuarios u ON c.creado_por = u.id
       ORDER BY c.created_at DESC`
    )
    
    res.json({ ok: true, cupones: rows })
  } catch (err) {
    logger.error('Error listando cupones:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/cupones/admin/crear - Crear nuevo cupón (solo admin)
router.post('/admin/crear', auth, async (req, res) => {
  try {
    const { id: adminId, tipo_usuario } = req.auth
    
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado' })
    }
    
    const {
      codigo,
      descripcion,
      tipo_beneficio,
      tipo_usuario: tipoUsuarioCupon,
      valor_beneficio,
      emprendimiento_id,
      producto_id,
      usos_maximos,
      usos_por_usuario,
      fecha_inicio,
      fecha_expiracion
    } = req.body
    
    if (!codigo || !descripcion || !tipo_beneficio || !valor_beneficio) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' })
    }
    
    // Verificar que el código no exista
    const { rows: existeRows } = await pool.query(
      'SELECT id FROM cupones WHERE UPPER(codigo) = UPPER($1)',
      [codigo]
    )
    
    if (existeRows.length > 0) {
      return res.status(400).json({ ok: false, error: 'Ya existe un cupón con ese código' })
    }
    
    const { rows } = await pool.query(
      `INSERT INTO cupones (
        codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio,
        emprendimiento_id, producto_id, usos_maximos, usos_por_usuario,
        fecha_inicio, fecha_expiracion, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        codigo.trim().toUpperCase(),
        descripcion,
        tipo_beneficio,
        tipoUsuarioCupon || 'ambos',
        valor_beneficio,
        emprendimiento_id || null,
        producto_id || null,
        usos_maximos || null,
        usos_por_usuario || 1,
        fecha_inicio || null,
        fecha_expiracion || null,
        adminId
      ]
    )
    
    logger.success(`✅ Cupón creado: ${codigo}`)
    res.status(201).json({ ok: true, mensaje: 'Cupón creado exitosamente', cupon: rows[0] })
  } catch (err) {
    logger.error('Error creando cupón:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al crear cupón' })
  }
})

// PATCH /api/cupones/admin/:id - Actualizar cupón (solo admin)
router.patch('/admin/:id', auth, async (req, res) => {
  try {
    const { tipo_usuario } = req.auth
    const { id } = req.params
    
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado' })
    }
    
    const { activo, usos_maximos, fecha_expiracion } = req.body
    
    await pool.query(
      `UPDATE cupones 
       SET activo = COALESCE($1, activo),
           usos_maximos = COALESCE($2, usos_maximos),
           fecha_expiracion = COALESCE($3, fecha_expiracion),
           updated_at = NOW()
       WHERE id = $4`,
      [activo, usos_maximos, fecha_expiracion, id]
    )
    
    logger.success(`✅ Cupón ${id} actualizado`)
    res.json({ ok: true, mensaje: 'Cupón actualizado exitosamente' })
  } catch (err) {
    logger.error('Error actualizando cupón:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// DELETE /api/cupones/admin/:id - Eliminar cupón (solo admin)
router.delete('/admin/:id', auth, async (req, res) => {
  try {
    const { tipo_usuario } = req.auth
    const { id } = req.params
    
    if (tipo_usuario !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Acceso denegado' })
    }
    
    await pool.query('DELETE FROM cupones WHERE id = $1', [id])
    
    logger.success(`✅ Cupón ${id} eliminado`)
    res.json({ ok: true, mensaje: 'Cupón eliminado exitosamente' })
  } catch (err) {
    logger.error('Error eliminando cupón:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

