const admin = require('firebase-admin')
const { pool } = require('../db/pool')
const logger = require('../utils/logger')

// Inicializar Firebase Admin SDK
let firebaseApp = null

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp

  try {
    // Opción 1: Usar archivo de credenciales (más seguro para desarrollo)
    const serviceAccount = require('../config/firebase-adminsdk.json')
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
    
    logger.success('✅ Firebase Admin SDK inicializado correctamente')
  } catch (error) {
    // Opción 2: Usar variables de entorno (para producción)
    if (process.env.FIREBASE_PROJECT_ID) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
      })
      logger.success('✅ Firebase Admin SDK inicializado con variables de entorno')
    } else {
      logger.error('❌ No se pudo inicializar Firebase Admin SDK')
      logger.info('💡 Configura firebase-adminsdk.json o variables de entorno')
    }
  }

  return firebaseApp
}

// Inicializar al cargar el módulo
initializeFirebase()

/**
 * Enviar notificación push a un usuario específico
 */
const enviarNotificacionAUsuario = async (usuarioId, notificacion) => {
  try {
    // Obtener el FCM token del usuario
    const { rows } = await pool.query(
      'SELECT fcm_token FROM usuarios WHERE id = $1',
      [usuarioId]
    )

    if (rows.length === 0 || !rows[0].fcm_token) {
      logger.warn(`⚠️ Usuario ${usuarioId} no tiene FCM token registrado`)
      return { success: false, error: 'Usuario sin token FCM' }
    }

    const fcmToken = rows[0].fcm_token

    // Construir el mensaje
    const message = {
      token: fcmToken,
      notification: {
        title: notificacion.titulo,
        body: notificacion.mensaje,
      },
      data: notificacion.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'veciapp-notifications',
          color: '#2A9D8F',
          icon: 'ic_notification',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          }
        }
      }
    }

    // Enviar notificación
    const response = await admin.messaging().send(message)
    logger.success(`✅ Notificación enviada a usuario ${usuarioId}: ${response}`)

    // Guardar en historial
    await pool.query(
      `INSERT INTO notificaciones 
       (usuario_id, titulo, mensaje, tipo, data, enviada, fecha_envio)
       VALUES ($1, $2, $3, $4, $5, true, NOW())`,
      [
        usuarioId,
        notificacion.titulo,
        notificacion.mensaje,
        notificacion.tipo || 'general',
        JSON.stringify(notificacion.data || {})
      ]
    )

    return { success: true, messageId: response }
  } catch (error) {
    logger.error(`❌ Error al enviar notificación a usuario ${usuarioId}:`, error.message)
    
    // Si el token es inválido, eliminarlo de la BD
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      logger.warn(`⚠️ Token FCM inválido para usuario ${usuarioId}, eliminando...`)
      await pool.query(
        'UPDATE usuarios SET fcm_token = NULL, fcm_token_actualizado_at = NOW() WHERE id = $1',
        [usuarioId]
      )
    }

    return { success: false, error: error.message }
  }
}

/**
 * Enviar notificación a múltiples usuarios
 */
const enviarNotificacionAVarios = async (usuariosIds, notificacion) => {
  try {
    const promesas = usuariosIds.map(userId => 
      enviarNotificacionAUsuario(userId, notificacion)
    )
    
    const resultados = await Promise.all(promesas)
    
    const exitosas = resultados.filter(r => r.success).length
    const fallidas = resultados.filter(r => !r.success).length
    
    logger.info(`📊 Notificaciones enviadas: ${exitosas} exitosas, ${fallidas} fallidas`)
    
    return { exitosas, fallidas, resultados }
  } catch (error) {
    logger.error('❌ Error al enviar notificaciones a varios usuarios:', error.message)
    return { exitosas: 0, fallidas: usuariosIds.length, error: error.message }
  }
}

/**
 * Enviar notificación por nuevo pedido al emprendedor
 */
const notificarNuevoPedido = async (emprendedorId, pedido, cliente) => {
  const notificacion = {
    titulo: '🛍️ Nuevo Pedido Recibido',
    mensaje: `${cliente.nombre} ha realizado un pedido en tu emprendimiento`,
    tipo: 'pedido_nuevo',
    data: {
      tipo: 'pedido_nuevo',
      pedido_id: pedido.id.toString(),
      emprendimiento_id: pedido.emprendimiento_id?.toString(),
      cliente_nombre: cliente.nombre,
      total: pedido.total?.toString() || '0',
      screen: 'PedidosRecibidos'
    }
  }

  return await enviarNotificacionAUsuario(emprendedorId, notificacion)
}

/**
 * Enviar notificación por pedido confirmado al cliente
 */
const notificarPedidoConfirmado = async (clienteId, pedido, emprendimiento) => {
  const notificacion = {
    titulo: '✅ Pedido Confirmado',
    mensaje: `${emprendimiento.nombre} ha confirmado tu pedido`,
    tipo: 'pedido_confirmado',
    data: {
      tipo: 'pedido_confirmado',
      pedido_id: pedido.id.toString(),
      emprendimiento_id: pedido.emprendimiento_id?.toString(),
      emprendimiento_nombre: emprendimiento.nombre,
      tiempo_estimado: pedido.tiempo_entrega_minutos?.toString() || '30',
      screen: 'MisPedidos'
    }
  }

  return await enviarNotificacionAUsuario(clienteId, notificacion)
}

/**
 * Enviar notificación por pedido rechazado al cliente
 */
const notificarPedidoRechazado = async (clienteId, pedido, emprendimiento, motivo) => {
  const notificacion = {
    titulo: '⚠️ Pedido No Aceptado',
    mensaje: `${emprendimiento.nombre} no pudo aceptar tu pedido${motivo ? ': ' + motivo : ''}`,
    tipo: 'pedido_rechazado',
    data: {
      tipo: 'pedido_rechazado',
      pedido_id: pedido.id.toString(),
      emprendimiento_id: pedido.emprendimiento_id?.toString(),
      emprendimiento_nombre: emprendimiento.nombre,
      motivo: motivo || '',
      screen: 'MisPedidos'
    }
  }

  return await enviarNotificacionAUsuario(clienteId, notificacion)
}

/**
 * Enviar notificación por pedido en camino al cliente
 */
const notificarPedidoEnCamino = async (clienteId, pedido, emprendimiento) => {
  const notificacion = {
    titulo: '🚚 Pedido en Camino',
    mensaje: `Tu pedido de ${emprendimiento.nombre} está en camino`,
    tipo: 'pedido_en_camino',
    data: {
      tipo: 'pedido_en_camino',
      pedido_id: pedido.id.toString(),
      emprendimiento_id: pedido.emprendimiento_id?.toString(),
      emprendimiento_nombre: emprendimiento.nombre,
      screen: 'MisPedidos'
    }
  }

  return await enviarNotificacionAUsuario(clienteId, notificacion)
}

/**
 * Enviar notificación por pedido entregado al cliente
 */
const notificarPedidoEntregado = async (clienteId, pedido, emprendimiento) => {
  const notificacion = {
    titulo: '🎉 Pedido Entregado',
    mensaje: `Tu pedido de ${emprendimiento.nombre} ha sido entregado. ¡Califica tu experiencia!`,
    tipo: 'pedido_entregado',
    data: {
      tipo: 'pedido_entregado',
      pedido_id: pedido.id.toString(),
      emprendimiento_id: pedido.emprendimiento_id?.toString(),
      emprendimiento_nombre: emprendimiento.nombre,
      screen: 'MisPedidos'
    }
  }

  return await enviarNotificacionAUsuario(clienteId, notificacion)
}

/**
 * Enviar notificación de oferta especial
 */
const notificarOfertaEspecial = async (usuariosIds, titulo, mensaje, data = {}) => {
  const notificacion = {
    titulo,
    mensaje,
    tipo: 'oferta_especial',
    data: {
      tipo: 'oferta_especial',
      ...data
    }
  }

  return await enviarNotificacionAVarios(usuariosIds, notificacion)
}

/**
 * Registrar o actualizar FCM token de un usuario
 */
const registrarFCMToken = async (usuarioId, fcmToken) => {
  try {
    await pool.query(
      `UPDATE usuarios 
       SET fcm_token = $1, fcm_token_actualizado_at = NOW()
       WHERE id = $2`,
      [fcmToken, usuarioId]
    )
    
    logger.success(`✅ FCM token registrado para usuario ${usuarioId}`)
    return { success: true }
  } catch (error) {
    logger.error(`❌ Error al registrar FCM token:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Eliminar FCM token de un usuario (al cerrar sesión)
 */
const eliminarFCMToken = async (usuarioId) => {
  try {
    await pool.query(
      `UPDATE usuarios 
       SET fcm_token = NULL, fcm_token_actualizado_at = NOW()
       WHERE id = $1`,
      [usuarioId]
    )
    
    logger.success(`✅ FCM token eliminado para usuario ${usuarioId}`)
    return { success: true }
  } catch (error) {
    logger.error(`❌ Error al eliminar FCM token:`, error.message)
    return { success: false, error: error.message }
  }
}

module.exports = {
  enviarNotificacionAUsuario,
  enviarNotificacionAVarios,
  notificarNuevoPedido,
  notificarPedidoConfirmado,
  notificarPedidoRechazado,
  notificarPedidoEnCamino,
  notificarPedidoEntregado,
  notificarOfertaEspecial,
  registrarFCMToken,
  eliminarFCMToken
}

