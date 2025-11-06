const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const { sendMail } = require('../utils/mailer')
const { emailBienvenida, emailRecuperacionPassword } = require('../utils/emailTemplates')
const logger = require('../utils/logger')
const { upload, avatarsDir } = require('../middleware/upload')
const path = require('path')
const fs = require('fs')
const { port, serverIp } = require('../config/env')

// Twilio para verificación SMS
const twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

const JWT_SECRET = process.env.JWT_SECRET || 'mi_jwt_supersecreto'
const JWT_EXPIRES = '7d'

function isValidEmail(email) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email)
}

// GET /api/auth/verificar-email/:token - Verificar correo electrónico
router.get('/verificar-email/:token', async (req, res) => {
  try {
    const { token } = req.params
    
    logger.info(`Intentando verificar email con token: ${token.substring(0, 8)}...`)
    
    // Buscar usuario con ese token
    const { rows } = await pool.query(
      `SELECT id, nombre, correo, tipo_usuario, token_activacion_expira 
       FROM usuarios 
       WHERE token_activacion = $1 
       AND estado = 'pendiente_verificacion'`,
      [token]
    )
    
    if (!rows.length) {
      logger.warn('Token de verificación no válido o ya usado')
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error de Verificación - VeciApp</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
            .container { background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
            .icon { font-size: 80px; margin-bottom: 20px; }
            h1 { color: #e74c3c; font-size: 28px; margin-bottom: 15px; }
            p { color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
            .help { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; }
            .help-title { color: #856404; font-weight: bold; margin-bottom: 8px; }
            .help-text { color: #856404; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Error de Verificación</h1>
            <p>El enlace de verificación no es válido o ya ha sido utilizado.</p>
            <div class="help">
              <div class="help-title">¿Necesitas ayuda?</div>
              <div class="help-text">
                • El enlace puede haber expirado (48 horas)<br>
                • La cuenta puede haber sido verificada anteriormente<br>
                • Intenta iniciar sesión en la aplicación
              </div>
            </div>
          </div>
        </body>
        </html>
      `)
    }
    
    const usuario = rows[0]
    
    // Verificar si el token expiró
    if (new Date() > new Date(usuario.token_activacion_expira)) {
      logger.warn(`Token expirado para usuario ${usuario.id}`)
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enlace Expirado - VeciApp</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
            .container { background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
            .icon { font-size: 80px; margin-bottom: 20px; }
            h1 { color: #f39c12; font-size: 28px; margin-bottom: 15px; }
            p { color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
            .help { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; }
            .help-title { color: #856404; font-weight: bold; margin-bottom: 8px; }
            .help-text { color: #856404; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>Enlace Expirado</h1>
            <p>El enlace de verificación ha expirado. Los enlaces son válidos solo por 48 horas.</p>
            <div class="help">
              <div class="help-title">¿Qué puedo hacer?</div>
              <div class="help-text">
                • Solicita un nuevo enlace de verificación<br>
                • Contacta al soporte de VeciApp<br>
                • O registra una nueva cuenta
              </div>
            </div>
          </div>
        </body>
        </html>
      `)
    }
    
    // Activar usuario
    await pool.query(
      `UPDATE usuarios 
       SET estado = 'activo', 
           email_verificado = true, 
           token_activacion = NULL, 
           token_activacion_expira = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [usuario.id]
    )
    
    logger.success(`✅ Email verificado: ${usuario.nombre} (${usuario.correo})`)
    
    // Retornar página HTML de éxito
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verificado - VeciApp</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #2A9D8F 0%, #667eea 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .container { background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; animation: slideIn 0.5s ease-out; }
          @keyframes slideIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
          .icon { font-size: 80px; margin-bottom: 20px; animation: bounce 1s ease-in-out; }
          @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
          h1 { color: #27ae60; font-size: 32px; margin-bottom: 15px; }
          .subtitle { color: #666; font-size: 18px; margin-bottom: 30px; }
          .info-box { background: #e8f5e9; border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: left; }
          .info-item { display: flex; align-items: center; margin-bottom: 12px; color: #2c3e50; font-size: 15px; }
          .info-item:last-child { margin-bottom: 0; }
          .info-icon { margin-right: 10px; font-size: 18px; }
          .instructions { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left; }
          .instructions-title { color: #1976D2; font-weight: bold; margin-bottom: 8px; font-size: 16px; }
          .instructions-text { color: #1976D2; font-size: 14px; line-height: 1.6; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1; color: #95a5a6; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>¡Email Verificado!</h1>
          <p class="subtitle">Tu cuenta ha sido activada exitosamente</p>
          
          <div class="info-box">
            <div class="info-item">
              <span class="info-icon">👤</span>
              <strong>Nombre:</strong>&nbsp;${usuario.nombre}
            </div>
            <div class="info-item">
              <span class="info-icon">📧</span>
              <strong>Correo:</strong>&nbsp;${usuario.correo}
            </div>
            <div class="info-item">
              <span class="info-icon">🔐</span>
              <strong>Estado:</strong>&nbsp;Activo
            </div>
            <div class="info-item">
              <span class="info-icon">👔</span>
              <strong>Tipo:</strong>&nbsp;${usuario.tipo_usuario === 'emprendedor' ? 'Emprendedor' : 'Cliente'}
            </div>
          </div>
          
          <div class="instructions">
            <div class="instructions-title">📱 Próximos Pasos</div>
            <div class="instructions-text">
              1. Abre la aplicación VeciApp en tu dispositivo móvil<br>
              2. Inicia sesión con tu correo y contraseña<br>
              3. Comienza a ${usuario.tipo_usuario === 'emprendedor' ? 'crear tus emprendimientos' : 'explorar y comprar'}
            </div>
          </div>
          
          <div class="footer">
            <strong>VeciApp</strong> - Tu comunidad, más conectada
          </div>
        </div>
      </body>
      </html>
    `)
  } catch (err) {
    logger.error('Error verificando email:', err.message)
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - VeciApp</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .container { background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
          .icon { font-size: 80px; margin-bottom: 20px; }
          h1 { color: #e74c3c; font-size: 28px; margin-bottom: 15px; }
          p { color: #555; font-size: 16px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚠️</div>
          <h1>Error del Servidor</h1>
          <p>Ocurrió un error al procesar tu solicitud. Por favor contacta al soporte.</p>
        </div>
      </body>
      </html>
    `)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { correo, contrasena } = req.body || {}
  logger.auth(`Login intento: ${correo || 'sin correo'}`)
  logger.db(`Body completo: ${JSON.stringify(req.body)}`)
  
  if (!correo || !contrasena) {
    logger.warn('Login fallido: faltan credenciales')
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
    logger.db(`Usuario encontrado: ID ${usuario.id}, estado: ${usuario.estado}, tipo: ${usuario.tipo_usuario}, email_verificado: ${usuario.email_verificado}`)

    // Verificar si la cuenta está pendiente de verificación de email
    if (usuario.estado === 'pendiente_verificacion') {
      logger.warn(`Login bloqueado: email no verificado`)
      return res.status(403).json({ 
        error: 'Por favor verifica tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.',
        requiere_verificacion: true,
        correo: usuario.correo
      })
    }

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
    // Generar token de verificación de email
    const tokenVerificacion = crypto.randomBytes(32).toString('hex')
    
    const hash = await bcrypt.hash(contrasena, 10)
    logger.db('Hash bcrypt generado correctamente')
    const insert = `
      INSERT INTO usuarios (nombre, correo, contrasena, telefono, tipo_usuario, estado, email_verificado, comuna_id, token_activacion, token_activacion_expira)
      VALUES ($1, LOWER($2), $3, $4, $5, 'pendiente_verificacion', false, $6, $7, NOW() + INTERVAL '48 hours')
      RETURNING id, nombre, correo, telefono, tipo_usuario, estado, email_verificado, comuna_id, created_at, updated_at
    `
    const { rows } = await pool.query(insert, [nombre, correo, hash, telefono || null, tipo_usuario, comuna_id || null, tokenVerificacion])
    const usuario = rows[0]
    logger.success(`Usuario registrado: ID ${usuario.id}, tipo: ${usuario.tipo_usuario} - Requiere verificación de email`)
    
    // Generar enlace de verificación
    const enlaceVerificacion = `http://${serverIp}:${port}/api/auth/verificar-email/${tokenVerificacion}`
    
    // Enviar email de verificación (no de bienvenida todavía)
    try {
      const htmlContent = emailBienvenida({
        nombre: usuario.nombre,
        tipoUsuario: usuario.tipo_usuario,
        correo: usuario.correo,
        enlaceVerificacion
      })
      
      await sendMail({
        to: usuario.correo,
        subject: '📧 Verifica tu correo electrónico - VeciApp',
        text: `Hola ${usuario.nombre},

¡Bienvenido a VeciApp!

Para activar tu cuenta y comenzar a usar la aplicación, verifica tu correo haciendo clic en:

${enlaceVerificacion}

⚠️ Este enlace expirará en 48 horas.

---
VeciApp - Tu comunidad, más conectada`,
        html: htmlContent
      })
      logger.success(`📧 Email de verificación enviado a ${usuario.correo}`)
    } catch (emailError) {
      logger.error('Error enviando email de verificación:', emailError.message)
      // No detener el proceso si falla el email
    }
    
    // NO retornar token JWT hasta que verifique el email
    res.status(201).json({ 
      mensaje: 'Usuario registrado. Por favor verifica tu correo electrónico para activar tu cuenta.',
      requiere_verificacion: true,
      correo: usuario.correo
    })
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
    
    // Generar email HTML
    const htmlContent = emailRecuperacionPassword({
      nombre: usuario.nombre,
      codigo
    })
    
    await sendMail({
      to: usuario.correo,
      subject: '🔐 Código de recuperación de contraseña - VeciApp',
      text: `Hola ${usuario.nombre},

Has solicitado restablecer tu contraseña en VeciApp.

Tu código de verificación de 6 dígitos es: ${codigo}

Este código expirará en 5 minutos.

Si no solicitaste este cambio, ignora este correo.

---
VeciApp - Tu comunidad, más conectada`,
      html: htmlContent
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

// POST /api/auth/enviar-codigo-telefono - Enviar código SMS para verificar teléfono
router.post('/enviar-codigo-telefono', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { telefono } = req.body

    if (!telefono) {
      return res.status(400).json({ ok: false, error: 'Teléfono requerido' })
    }

    logger.auth(`Enviando código SMS de verificación de teléfono a: ${telefono}`)

    // Validar formato de teléfono (debe estar en formato E.164: +56...)
    if (!telefono.startsWith('+56') || telefono.length < 12) {
      return res.status(400).json({ ok: false, error: 'Formato de teléfono inválido. Debe ser +56XXXXXXXXX' })
    }

    // Enviar código mediante Twilio Verify
    try {
      const verification = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications
        .create({ 
          to: telefono, 
          channel: 'sms',
          locale: 'es'
        })
      
      logger.success(`✅ Código SMS enviado a ${telefono}. SID: ${verification.sid}`)
      
      res.json({ 
        ok: true, 
        mensaje: 'Código de verificación enviado exitosamente',
        sid: verification.sid
      })
    } catch (twilioError) {
      logger.error('Error de Twilio:', twilioError.message)
      
      // Fallback: generar código local para desarrollo
      if (process.env.NODE_ENV === 'development') {
        const codigoLocal = Math.floor(100000 + Math.random() * 900000).toString()
        logger.warn(`⚠️ FALLBACK DESARROLLO: Código generado localmente: ${codigoLocal}`)
        
        // Guardar código temporal en la base de datos
        await pool.query(
          'UPDATE usuarios SET codigo_verificacion = $1, fecha_expiracion_codigo = NOW() + INTERVAL \'10 minutes\' WHERE id = $2',
          [codigoLocal, userId]
        )
        
        return res.json({ 
          ok: true, 
          mensaje: 'Código enviado (modo desarrollo)',
          codigo_desarrollo: codigoLocal
        })
      }
      
      throw twilioError
    }
  } catch (error) {
    logger.error('Error enviando código SMS:', error.message)
    res.status(500).json({ ok: false, error: 'Error al enviar código de verificación' })
  }
})

// POST /api/auth/verificar-codigo-telefono - Verificar código SMS y actualizar teléfono
router.post('/verificar-codigo-telefono', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { telefono, codigo } = req.body

    if (!telefono || !codigo) {
      return res.status(400).json({ ok: false, error: 'Teléfono y código requeridos' })
    }

    logger.auth(`Verificando código SMS para teléfono: ${telefono}`)

    let codigoValido = false

    // Intentar verificar con Twilio Verify
    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verificationChecks
        .create({ 
          to: telefono, 
          code: codigo 
        })
      
      logger.info(`Resultado Twilio Verify: ${verificationCheck.status}`)
      codigoValido = verificationCheck.status === 'approved'
    } catch (twilioError) {
      logger.warn('Error de Twilio, usando verificación local:', twilioError.message)
      
      // Fallback: verificar código local para desarrollo
      if (process.env.NODE_ENV === 'development') {
        const { rows } = await pool.query(
          'SELECT codigo_verificacion, fecha_expiracion_codigo FROM usuarios WHERE id = $1',
          [userId]
        )
        
        if (rows.length > 0) {
          const { codigo_verificacion, fecha_expiracion_codigo } = rows[0]
          const ahora = new Date()
          
          if (codigo_verificacion === codigo && new Date(fecha_expiracion_codigo) > ahora) {
            codigoValido = true
            logger.warn('⚠️ Código verificado localmente (modo desarrollo)')
          }
        }
      }
    }

    if (!codigoValido) {
      logger.warn('Verificación fallida: código incorrecto')
      return res.status(400).json({ ok: false, error: 'Código incorrecto o expirado' })
    }

    // Actualizar teléfono del usuario
    await pool.query(
      'UPDATE usuarios SET telefono = $1, codigo_verificacion = NULL, fecha_expiracion_codigo = NULL WHERE id = $2',
      [telefono, userId]
    )

    logger.success(`✅ Teléfono verificado y actualizado para usuario ${userId}: ${telefono}`)

    res.json({ 
      ok: true, 
      mensaje: 'Teléfono verificado correctamente',
      telefono
    })
  } catch (error) {
    logger.error('Error verificando código SMS:', error.message)
    res.status(500).json({ ok: false, error: 'Error al verificar código' })
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
        // Iniciar transacción para cambiar a plan básico y desactivar productos
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          
          // Cambiar automáticamente a plan básico
          await client.query(
            'UPDATE usuarios SET plan_id = NULL, estado_suscripcion = NULL, fecha_suscripcion = NULL, vigencia_hasta = NULL WHERE id = $1',
            [userId]
          )
          
          // Desactivar todos los productos de todos los emprendimientos del usuario
          const { rows: productosDesactivados } = await client.query(
            `UPDATE productos p
             SET activo = false
             FROM emprendimientos e
             WHERE p.emprendimiento_id = e.id 
               AND e.usuario_id = $1
               AND p.activo = true
             RETURNING p.id`,
            [userId]
          )
          
          await client.query('COMMIT')
          
          logger.info(`Suscripción expirada para usuario ${userId}, cambiado a plan básico`)
          logger.info(`${productosDesactivados.length} productos desactivados automáticamente`)
          
          const { rows: updatedRows } = await pool.query(
            'SELECT plan_id, estado_suscripcion, fecha_suscripcion, vigencia_hasta FROM usuarios WHERE id = $1',
            [userId]
          )
          
          return res.json({ 
            ok: true, 
            usuario: updatedRows[0],
            productos_desactivados: productosDesactivados.length
          })
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
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
