const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const logger = require('../utils/logger')
const { upload, avatarsDir } = require('../middleware/upload')
const path = require('path')
const fs = require('fs')
const { port, serverIp } = require('../config/env')

const JWT_SECRET = process.env.JWT_SECRET || 'mi_jwt_supersecreto'
const JWT_EXPIRES = '7d'

function isValidEmail(email) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email)
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body || {}
  logger.auth(`Login intento: ${correo || 'sin correo'}`)
  
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan credenciales' })
  }

  try {
    const q = `SELECT * FROM usuarios WHERE LOWER(correo) = LOWER($1) LIMIT 1`
    const { rows } = await pool.query(q, [correo])
    
    if (!rows.length) {
      logger.warn(`Login fallido: usuario no encontrado`)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }
    
    const usuario = rows[0]
    logger.db(`Usuario encontrado: ID ${usuario.id}, estado: ${usuario.estado}, tipo: ${usuario.tipo_usuario}`)

    if (usuario.estado !== 'activo') {
      logger.warn(`Login bloqueado: cuenta inactiva`)
      return res.status(403).json({ error: 'Cuenta inactiva o bloqueada' })
    }

    const hasHash = typeof usuario.contrasena === 'string' && usuario.contrasena.startsWith('$2')
    const ok = hasHash ? await bcrypt.compare(contrasena, usuario.contrasena) : false
    
    if (!ok) {
      logger.warn(`Login fallido: contraseña incorrecta`)
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const payload = { id: usuario.id, correo: usuario.correo, tipo_usuario: usuario.tipo_usuario, estado: usuario.estado }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    
    const safeUser = { ...usuario }
    delete safeUser.contrasena

    logger.success(`Login exitoso: ${correo}`)
    res.json({ token, usuario: safeUser })
  } catch (err) {
    logger.error('Login error:', err.message)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  const { nombre, correo, contrasena, telefono, tipo_usuario = 'cliente', comuna_id } = req.body || {}
  logger.auth(`Registro intento: ${correo || 'sin correo'}`)
  
  if (!nombre || !correo || !contrasena) {
    logger.warn('Registro fallido: faltan campos obligatorios')
    return res.status(400).json({ error: 'Faltan campos obligatorios' })
  }
  if (!isValidEmail(correo)) {
    logger.warn('Registro fallido: correo inválido')
    return res.status(400).json({ error: 'Correo inválido' })
  }
  try {
    const existe = await pool.query('SELECT 1 FROM usuarios WHERE LOWER(correo)=LOWER($1)', [correo])
    if (existe.rowCount > 0) {
      logger.warn(`Registro fallido: correo ya existe`)
      return res.status(409).json({ error: 'El correo ya está registrado' })
    }
    const hash = await bcrypt.hash(contrasena, 10)
    logger.db('Hash bcrypt generado correctamente')
    const insert = `
      INSERT INTO usuarios (nombre, correo, contrasena, telefono, tipo_usuario, estado, email_verificado, comuna_id)
      VALUES ($1, LOWER($2), $3, $4, $5, 'activo', false, $6)
      RETURNING id, nombre, correo, telefono, tipo_usuario, estado, email_verificado, comuna_id, created_at, updated_at
    `
    const { rows } = await pool.query(insert, [nombre, correo, hash, telefono || null, tipo_usuario, comuna_id || null])
    const usuario = rows[0]
    const payload = { id: usuario.id, correo: usuario.correo, tipo_usuario: usuario.tipo_usuario, estado: usuario.estado }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    logger.success(`Usuario registrado: ID ${usuario.id}, tipo: ${usuario.tipo_usuario}`)
    res.status(201).json({ mensaje: 'Usuario registrado', token, usuario })
  } catch (err) {
    logger.error('Error en registro:', err.message)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GET /api/auth/perfil (requiere Bearer token)
router.get('/perfil', auth, async (req, res) => {
  try {
    const { id } = req.auth
    logger.auth(`Consultando perfil usuario ID: ${id}`)
    const q = `SELECT id, nombre, correo, telefono, tipo_usuario, estado, email_verificado, codigo_verificacion, codigo_recuperacion, fecha_expiracion_codigo, ultimo_acceso, comuna_id, plan_id, fecha_suscripcion, estado_suscripcion, vigencia_hasta, avatar_url, created_at, updated_at FROM usuarios WHERE id=$1`
    const { rows } = await pool.query(q, [id])
    if (!rows.length) {
      logger.warn(`Perfil no encontrado para ID: ${id}`)
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    logger.success(`Perfil obtenido: ${rows[0].nombre}`)
    res.json(rows[0])
  } catch (err) {
    logger.error('Error obteniendo perfil:', err.message)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// PUT /api/auth/perfil (requiere Bearer token)
router.put('/perfil', auth, async (req, res) => {
  const { id } = req.auth
  const { nombre, telefono, comuna_id } = req.body || {}
  logger.auth(`Actualizando perfil usuario ID: ${id}`)
  
  if (!nombre) {
    logger.warn('Actualización fallida: falta el nombre')
    return res.status(400).json({ error: 'El nombre es obligatorio' })
  }
  
  try {
    // Construir query dinámicamente solo con los campos que vienen
    const updates = []
    const values = []
    let paramCount = 1
    
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramCount}`)
      values.push(nombre)
      paramCount++
    }
    
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramCount}`)
      values.push(telefono || null)
      paramCount++
    }
    
    if (comuna_id !== undefined) {
      updates.push(`comuna_id = $${paramCount}`)
      values.push(comuna_id || null)
      paramCount++
    }
    
    if (updates.length === 0) {
      logger.warn('Actualización fallida: no hay campos para actualizar')
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }
    
    updates.push(`updated_at = NOW()`)
    values.push(id)
    
    const updateQuery = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, nombre, correo, telefono, tipo_usuario, estado, email_verificado, comuna_id, plan_id, estado_suscripcion, avatar_url, created_at, updated_at`
    
    logger.db(`Actualizando usuario: ${updateQuery}`)
    const { rows } = await pool.query(updateQuery, values)
    
    if (!rows.length) {
      logger.warn(`Usuario ID ${id} no encontrado para actualizar`)
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    
    const usuario = rows[0]
    logger.success(`Perfil actualizado: ${usuario.nombre}`)
    
    res.json({ 
      ok: true,
      mensaje: 'Perfil actualizado correctamente',
      usuario
    })
  } catch (err) {
    logger.error('Error actualizando perfil:', err.message)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/auth/recuperar-password
router.post('/recuperar-password', async (req, res) => {
  const { correo } = req.body || {}
  logger.auth(`Solicitud de recuperación de contraseña: ${correo || 'sin correo'}`)
  
  if (!correo) return res.status(400).json({ error: 'Falta correo' })
  let okMsg = { mensaje: 'Si el correo existe, recibirás un código de recuperación en los próximos minutos.' }
  try {
    const q = 'SELECT * FROM usuarios WHERE LOWER(correo)=LOWER($1)'
    const { rows } = await pool.query(q, [correo])
    if (!rows.length) {
      logger.warn(`Recuperación: usuario no encontrado para ${correo}`)
      return res.json(okMsg)
    }
    const usuario = rows[0]
    const codigo = Math.floor(100000 + Math.random()*900000).toString()
    const expira = new Date(Date.now() + 5*60*1000)
    logger.info(`Código generado para ${usuario.correo}: ${codigo}`)
    await pool.query('UPDATE usuarios SET codigo_verificacion=$1, fecha_expiracion_codigo=$2 WHERE id=$3', [codigo, expira, usuario.id])
    await sendMail({
      to: usuario.correo,
      subject: 'Código de recuperación de contraseña',
      text: `Tu código de recuperación para VeciApp es: ${codigo}.\nEste código expira en 5 minutos.`
    })
    logger.success(`Email de recuperación enviado a ${usuario.correo}`)
    return res.json(okMsg)
  } catch (err) {
    logger.error('Error en recuperación:', err.message)
    return res.json(okMsg)
  }
})

// POST /api/auth/verificar-codigo
router.post('/verificar-codigo', async (req, res) => {
  const { correo, codigo } = req.body || {}
  logger.auth(`Verificando código para: ${correo || 'sin correo'}`)
  
  if (!correo || !codigo) return res.status(400).json({ error: 'Faltan datos' })
  try {
    const q = `SELECT id, codigo_verificacion, fecha_expiracion_codigo FROM usuarios WHERE LOWER(correo)=LOWER($1)`
    const { rows } = await pool.query(q, [correo])
    if (!rows.length) {
      logger.warn('Verificación fallida: usuario no encontrado')
      return res.status(400).json({ error: 'Código inválido o expirado' })
    }
    const u = rows[0]
    const now = new Date()
    if (u.codigo_verificacion !== String(codigo) || !u.fecha_expiracion_codigo || new Date(u.fecha_expiracion_codigo) < now) {
      logger.warn('Verificación fallida: código inválido o expirado')
      return res.status(400).json({ error: 'Código inválido o expirado' })
    }
    logger.success('Código verificado correctamente')
    return res.json({ mensaje: 'Código verificado. Procede con el cambio de contraseña.' })
  } catch (err) {
    logger.error('Error verificando código:', err.message)
    return res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/auth/cambiar-password
router.post('/cambiar-password', async (req, res) => {
  const { correo, contrasena } = req.body || {}
  logger.auth(`Cambio de contraseña solicitado para: ${correo || 'sin correo'}`)
  
  if (!correo || !contrasena) return res.status(400).json({ error: 'Faltan datos' })
  const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[a-z]).{8,16}$/
  if (!regex.test(contrasena)) {
    logger.warn('Cambio de contraseña fallido: formato inválido')
    return res.status(400).json({ error: 'La contraseña debe tener 8-16 caracteres, incluir mayúscula, número y letra.' })
  }
  try {
    const hash = await bcrypt.hash(contrasena, 10)
    const upd = `UPDATE usuarios SET contrasena=$1, codigo_verificacion=NULL, fecha_expiracion_codigo=NULL WHERE LOWER(correo)=LOWER($2) RETURNING id`
    const { rowCount } = await pool.query(upd, [hash, correo])
    if (!rowCount) {
      logger.warn('Cambio de contraseña fallido: usuario no encontrado')
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    logger.success(`Contraseña actualizada para ${correo}`)
    return res.json({ mensaje: 'Contraseña actualizada correctamente.' })
  } catch (err) {
    logger.error('Error cambiando contraseña:', err.message)
    return res.status(500).json({ error: 'Error interno' })
  }
})

// POST /api/auth/subir-avatar
router.post('/subir-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('Subida de avatar fallida: no hay archivo')
      return res.status(400).json({ ok: false, error: 'No se proporcionó ningún archivo' })
    }

    const { id: userId } = req.auth
    logger.auth(`Subiendo avatar para usuario ${userId}: ${req.file.filename}`)

    // Construir URL del avatar con la IP del servidor
    const avatarUrl = `http://${serverIp}:${port}/uploads/usuarios/avatar/${req.file.filename}`

    // Obtener avatar anterior para eliminarlo
    const { rows: userRows } = await pool.query('SELECT avatar_url FROM usuarios WHERE id = $1', [userId])
    const oldAvatarUrl = userRows[0]?.avatar_url

    // Actualizar avatar_url en la base de datos
    await pool.query('UPDATE usuarios SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId])

    // Eliminar avatar anterior si existe
    if (oldAvatarUrl && oldAvatarUrl.includes('/uploads/usuarios/avatar/')) {
      const oldFilename = oldAvatarUrl.split('/').pop()
      const oldFilePath = path.join(avatarsDir, oldFilename)
      
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath)
          logger.success(`Avatar anterior eliminado: ${oldFilename}`)
        }
      } catch (err) {
        logger.error(`Error eliminando avatar anterior: ${err.message}`)
        // No falla la operación si no se puede eliminar el anterior
      }
    }

    logger.success(`Avatar actualizado para usuario ${userId}: ${avatarUrl}`)
    res.json({ 
      ok: true, 
      mensaje: 'Avatar actualizado correctamente',
      avatar_url: avatarUrl
    })
  } catch (err) {
    logger.error('Error subiendo avatar:', err.message)
    
    // Si hay error, intentar eliminar el archivo que se subió
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
        logger.info('Archivo eliminado tras error')
      } catch (e) {
        logger.error('No se pudo eliminar archivo:', e.message)
      }
    }
    
    res.status(500).json({ ok: false, error: 'Error al subir avatar' })
  }
})

// POST /api/auth/suscripcion/premium - Suscribirse al plan premium
router.post('/suscripcion/premium', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.auth(`Suscripción premium solicitada para usuario ${userId}`)
    
    // Verificar si ya tiene suscripción activa
    const { rows: userRows } = await pool.query(
      'SELECT plan_id, estado_suscripcion, vigencia_hasta FROM usuarios WHERE id = $1',
      [userId]
    )
    
    if (!userRows.length) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    
    const usuario = userRows[0]
    
    // Si ya tiene suscripción activa, no puede renovar manualmente (solo renovación automática)
    if (usuario.plan_id === 2 && usuario.estado_suscripcion === 'activa' && 
        usuario.vigencia_hasta && new Date(usuario.vigencia_hasta) > new Date()) {
      const diasRestantes = Math.ceil((new Date(usuario.vigencia_hasta) - new Date()) / (1000 * 60 * 60 * 24))
      return res.status(400).json({
        ok: false,
        error: `Ya tienes una suscripción activa. Vence en ${diasRestantes} día(s)`
      })
    }
    
    // Calcular fechas de inicio y fin (1 mes desde ahora)
    const fechaInicio = new Date()
    const fechaFin = new Date()
    fechaFin.setMonth(fechaFin.getMonth() + 1) // Agregar 1 mes
    
    const monto = 4990 // Monto del plan premium
    
    // Iniciar transacción
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Actualizar usuario
      await client.query(
        `UPDATE usuarios 
         SET plan_id = 2, 
             estado_suscripcion = 'activa',
             fecha_suscripcion = $1,
             vigencia_hasta = $2
         WHERE id = $3`,
        [fechaInicio, fechaFin, userId]
      )
      
      // Registrar pago en auditoría
      const { rows: pagoRows } = await client.query(
        `INSERT INTO pagos_suscripcion 
         (usuario_id, plan_id, monto, fecha_pago, fecha_inicio, fecha_fin, estado_pago)
         VALUES ($1, $2, $3, $4, $5, $6, 'pagado')
         RETURNING id, fecha_pago, fecha_inicio, fecha_fin`,
        [userId, 2, monto, fechaInicio, fechaInicio, fechaFin]
      )
      
      await client.query('COMMIT')
      
      logger.success(`Suscripción premium activada para usuario ${userId} hasta ${fechaFin.toISOString()}`)
      
      // Obtener usuario actualizado
      const { rows: updatedRows } = await pool.query(
        'SELECT * FROM usuarios WHERE id = $1',
        [userId]
      )
      
      res.json({
        ok: true,
        mensaje: `Suscripción premium activada hasta el ${fechaFin.toLocaleDateString('es-CL')}`,
        usuario: updatedRows[0],
        pago: pagoRows[0]
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error('Error al suscribirse:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al procesar suscripción' })
  }
})

// POST /api/auth/suscripcion/cancelar - Cancelar suscripción premium
router.post('/suscripcion/cancelar', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.auth(`Cancelación de suscripción solicitada para usuario ${userId}`)
    
    // Verificar si tiene suscripción activa
    const { rows: userRows } = await pool.query(
      'SELECT plan_id, estado_suscripcion, vigencia_hasta FROM usuarios WHERE id = $1',
      [userId]
    )
    
    if (!userRows.length) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    
    const usuario = userRows[0]
    
    if (usuario.plan_id !== 2 || usuario.estado_suscripcion !== 'activa') {
      return res.status(400).json({ ok: false, error: 'No tienes una suscripción premium activa' })
    }
    
    // Marcar como cancelada pero mantener vigencia hasta la fecha final
    await pool.query(
      `UPDATE usuarios 
       SET estado_suscripcion = 'cancelada'
       WHERE id = $1`,
      [userId]
    )
    
    logger.success(`Suscripción cancelada para usuario ${userId}. Vence el ${usuario.vigencia_hasta}`)
    
    // Obtener usuario actualizado
    const { rows: updatedRows } = await pool.query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    )
    
    const fechaVencimiento = usuario.vigencia_hasta ? new Date(usuario.vigencia_hasta).toLocaleDateString('es-CL') : null
    
    res.json({
      ok: true,
      mensaje: `Suscripción cancelada. Tu plan premium estará vigente hasta el ${fechaVencimiento}, luego volverás automáticamente al plan básico.`,
      usuario: updatedRows[0]
    })
  } catch (err) {
    logger.error('Error al cancelar suscripción:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al cancelar suscripción' })
  }
})

// GET /api/auth/suscripcion/estado - Obtener estado de suscripción
router.get('/suscripcion/estado', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Consultando estado de suscripción para usuario ${userId}`)
    
    const { rows: userRows } = await pool.query(
      'SELECT plan_id, estado_suscripcion, fecha_suscripcion, vigencia_hasta FROM usuarios WHERE id = $1',
      [userId]
    )
    
    if (!userRows.length) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    
    const usuario = userRows[0]
    
    // Verificar si la suscripción expiró
    if (usuario.vigencia_hasta && new Date(usuario.vigencia_hasta) < new Date()) {
      if (usuario.plan_id === 2) {
        // Cambiar automáticamente a plan básico
        await pool.query(
          'UPDATE usuarios SET plan_id = NULL, estado_suscripcion = NULL, fecha_suscripcion = NULL, vigencia_hasta = NULL WHERE id = $1',
          [userId]
        )
        logger.info(`Suscripción expirada para usuario ${userId}, cambiado a plan básico`)
        
        const { rows: updatedRows } = await pool.query(
          'SELECT plan_id, estado_suscripcion, fecha_suscripcion, vigencia_hasta FROM usuarios WHERE id = $1',
          [userId]
        )
        
        return res.json({ ok: true, usuario: updatedRows[0] })
      }
    }
    
    res.json({ ok: true, usuario: usuario })
  } catch (err) {
    logger.error('Error consultando estado de suscripción:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/auth/suscripcion/historial - Obtener historial de pagos
router.get('/suscripcion/historial', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Consultando historial de pagos para usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT id, plan_id, monto, fecha_pago, fecha_inicio, fecha_fin, estado_pago, 
              flow_order_id, flow_medio_pago, created_at
       FROM pagos_suscripcion
       WHERE usuario_id = $1
       ORDER BY fecha_pago DESC`,
      [userId]
    )
    
    res.json({ ok: true, pagos: rows })
  } catch (err) {
    logger.error('Error consultando historial:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router
