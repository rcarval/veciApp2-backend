const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const notificationService = require('../services/notificationService')

// =====================================================
// POST /api/notificaciones/registrar-token
// Registrar FCM token del dispositivo
// =====================================================
router.post('/registrar-token', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { fcmToken } = req.body

    if (!fcmToken || fcmToken.trim().length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'El FCM token es obligatorio' 
      })
    }

    logger.info(`Registrando FCM token para usuario ${userId}`)

    const resultado = await notificationService.registrarFCMToken(userId, fcmToken)

    if (resultado.success) {
      res.json({
        ok: true,
        mensaje: 'Token registrado correctamente'
      })
    } else {
      res.status(500).json({
        ok: false,
        error: resultado.error
      })
    }
  } catch (err) {
    logger.error('Error registrando FCM token:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno al registrar token' 
    })
  }
})

// =====================================================
// DELETE /api/notificaciones/token
// Eliminar FCM token (al cerrar sesión)
// =====================================================
router.delete('/token', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth

    logger.info(`Eliminando FCM token para usuario ${userId}`)

    const resultado = await notificationService.eliminarFCMToken(userId)

    if (resultado.success) {
      res.json({
        ok: true,
        mensaje: 'Token eliminado correctamente'
      })
    } else {
      res.status(500).json({
        ok: false,
        error: resultado.error
      })
    }
  } catch (err) {
    logger.error('Error eliminando FCM token:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno al eliminar token' 
    })
  }
})

// =====================================================
// GET /api/notificaciones/mis-notificaciones
// Obtener historial de notificaciones del usuario
// =====================================================
router.get('/mis-notificaciones', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { limite = 50, offset = 0 } = req.query

    logger.info(`Obteniendo notificaciones para usuario ${userId}`)

    const { rows } = await pool.query(
      `SELECT id, titulo, mensaje, tipo, data, leida, fecha_envio, created_at
       FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limite, offset]
    )

    // Obtener total de notificaciones no leídas
    const { rows: noLeidasRows } = await pool.query(
      'SELECT COUNT(*) as total FROM notificaciones WHERE usuario_id = $1 AND leida = false',
      [userId]
    )

    res.json({
      ok: true,
      notificaciones: rows,
      noLeidas: parseInt(noLeidasRows[0].total)
    })
  } catch (err) {
    logger.error('Error obteniendo notificaciones:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno al obtener notificaciones' 
    })
  }
})

// =====================================================
// PATCH /api/notificaciones/:id/marcar-leida
// Marcar notificación como leída
// =====================================================
router.patch('/:id/marcar-leida', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const { id: notificacionId } = req.params

    logger.info(`Marcando notificación ${notificacionId} como leída`)

    await pool.query(
      `UPDATE notificaciones 
       SET leida = true, fecha_lectura = NOW()
       WHERE id = $1 AND usuario_id = $2`,
      [notificacionId, userId]
    )

    res.json({
      ok: true,
      mensaje: 'Notificación marcada como leída'
    })
  } catch (err) {
    logger.error('Error marcando notificación como leída:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno' 
    })
  }
})

// =====================================================
// PATCH /api/notificaciones/marcar-todas-leidas
// Marcar todas las notificaciones como leídas
// =====================================================
router.patch('/marcar-todas-leidas', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth

    logger.info(`Marcando todas las notificaciones como leídas para usuario ${userId}`)

    const { rowCount } = await pool.query(
      `UPDATE notificaciones 
       SET leida = true, fecha_lectura = NOW()
       WHERE usuario_id = $1 AND leida = false`,
      [userId]
    )

    res.json({
      ok: true,
      mensaje: `${rowCount} notificaciones marcadas como leídas`
    })
  } catch (err) {
    logger.error('Error marcando todas las notificaciones:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno' 
    })
  }
})

// =====================================================
// POST /api/notificaciones/test
// Endpoint de prueba para enviar notificación
// =====================================================
router.post('/test', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth

    logger.info(`Enviando notificación de prueba a usuario ${userId}`)

    const notificacion = {
      titulo: '🔔 Notificación de Prueba',
      mensaje: '¡Las notificaciones push están funcionando correctamente!',
      tipo: 'test',
      data: {
        tipo: 'test',
        timestamp: new Date().toISOString()
      }
    }

    const resultado = await notificationService.enviarNotificacionAUsuario(userId, notificacion)

    if (resultado.success) {
      res.json({
        ok: true,
        mensaje: 'Notificación de prueba enviada',
        messageId: resultado.messageId
      })
    } else {
      res.status(500).json({
        ok: false,
        error: resultado.error
      })
    }
  } catch (err) {
    logger.error('Error enviando notificación de prueba:', err.message)
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno' 
    })
  }
})

module.exports = router

