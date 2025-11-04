const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { verificarYDesactivarProductos } = require('../scripts/verificar_vigencias');

/**
 * Middleware para verificar que el usuario es admin
 */
const esAdmin = async (req, res, next) => {
  try {
    const { id: userId } = req.auth;
    
    const { rows } = await pool.query(
      'SELECT tipo_usuario FROM usuarios WHERE id = $1',
      [userId]
    );
    
    if (!rows.length || rows[0].tipo_usuario !== 'admin') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Acceso denegado. Solo administradores pueden ejecutar esta acción.' 
      });
    }
    
    next();
  } catch (err) {
    logger.error('Error en middleware esAdmin:', err.message);
    res.status(500).json({ ok: false, error: 'Error de autenticación' });
  }
};

/**
 * POST /api/admin/verificar-vigencias
 * Ejecuta manualmente la verificación de vigencias y desactivación de productos
 */
router.post('/verificar-vigencias', auth, esAdmin, async (req, res) => {
  try {
    logger.info('📌 Verificación de vigencias iniciada manualmente por admin');
    
    await verificarYDesactivarProductos();
    
    res.json({ 
      ok: true, 
      mensaje: 'Verificación de vigencias completada exitosamente' 
    });
  } catch (err) {
    logger.error('Error en verificación manual de vigencias:', err.message);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al verificar vigencias' 
    });
  }
});

/**
 * GET /api/admin/estadisticas-planes
 * Obtiene estadísticas generales de planes y suscripciones
 */
router.get('/estadisticas-planes', auth, esAdmin, async (req, res) => {
  try {
    logger.info('Obteniendo estadísticas de planes');
    
    // Contar usuarios por plan
    const { rows: planStats } = await pool.query(
      `SELECT 
         plan_id,
         COUNT(*) as total,
         COUNT(CASE WHEN vigencia_hasta > NOW() THEN 1 END) as activas,
         COUNT(CASE WHEN vigencia_hasta <= NOW() THEN 1 END) as expiradas
       FROM usuarios
       WHERE plan_id IS NOT NULL
       GROUP BY plan_id`
    );
    
    // Contar productos activos vs inactivos
    const { rows: productoStats } = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN activo = true THEN 1 END) as activos,
         COUNT(CASE WHEN activo = false THEN 1 END) as inactivos
       FROM productos`
    );
    
    // Usuarios con suscripción próxima a vencer (menos de 7 días)
    const { rows: proximosVencer } = await pool.query(
      `SELECT id, email, vigencia_hasta
       FROM usuarios
       WHERE plan_id = 2
         AND vigencia_hasta > NOW()
         AND vigencia_hasta < NOW() + INTERVAL '7 days'
       ORDER BY vigencia_hasta ASC`
    );
    
    res.json({ 
      ok: true, 
      estadisticas: {
        planes: planStats,
        productos: productoStats[0],
        proximos_a_vencer: proximosVencer
      }
    });
  } catch (err) {
    logger.error('Error obteniendo estadísticas:', err.message);
    res.status(500).json({ ok: false, error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/admin/emprendimientos/pendientes
 * Listar emprendimientos pendientes de aprobación
 */
router.get('/emprendimientos/pendientes', auth, esAdmin, async (req, res) => {
  try {
    logger.info('Listando emprendimientos pendientes de aprobación');
    
    const { rows: emprendimientos } = await pool.query(
      `SELECT e.*, u.nombre as nombre_usuario, u.email as email_usuario
       FROM emprendimientos e
       JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.estado = 'pendiente' AND e.es_borrador = false
       ORDER BY e.verificado_at DESC`
    );
    
    res.json({ 
      ok: true, 
      emprendimientos
    });
  } catch (err) {
    logger.error('Error listando emprendimientos pendientes:', err.message);
    res.status(500).json({ ok: false, error: 'Error al listar emprendimientos' });
  }
});

/**
 * POST /api/admin/emprendimientos/:id/aprobar
 * Aprobar un emprendimiento pendiente (cambia a estado 'inactivo')
 */
router.post('/emprendimientos/:id/aprobar', auth, esAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Admin aprobando emprendimiento ${id}`);
    
    // Verificar que el emprendimiento existe y está pendiente
    const { rows: empRows } = await pool.query(
      'SELECT id, nombre, estado FROM emprendimientos WHERE id = $1',
      [id]
    );
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' });
    }
    
    const emprendimiento = empRows[0];
    
    if (emprendimiento.estado !== 'pendiente') {
      return res.status(400).json({ 
        ok: false, 
        error: `El emprendimiento no está en estado pendiente (estado actual: ${emprendimiento.estado})` 
      });
    }
    
    // Cambiar estado a 'inactivo' (listo para que el emprendedor lo active)
    const { rows: updatedRows } = await pool.query(
      `UPDATE emprendimientos 
       SET estado = 'inactivo', fecha_aprobacion = NOW()
       WHERE id = $1
       RETURNING id, nombre, estado, fecha_aprobacion`,
      [id]
    );
    
    logger.success(`✓ Emprendimiento ${id} aprobado y cambiado a estado 'inactivo'`);
    
    res.json({ 
      ok: true, 
      mensaje: 'Emprendimiento aprobado exitosamente. El emprendedor ya puede activarlo.',
      emprendimiento: updatedRows[0]
    });
  } catch (err) {
    logger.error('Error aprobando emprendimiento:', err.message);
    res.status(500).json({ ok: false, error: 'Error al aprobar emprendimiento' });
  }
});

/**
 * POST /api/admin/emprendimientos/:id/rechazar
 * Rechazar un emprendimiento pendiente
 */
router.post('/emprendimientos/:id/rechazar', auth, esAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body || {};
    
    logger.info(`Admin rechazando emprendimiento ${id}`);
    
    // Verificar que el emprendimiento existe y está pendiente
    const { rows: empRows } = await pool.query(
      'SELECT id, nombre, estado FROM emprendimientos WHERE id = $1',
      [id]
    );
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' });
    }
    
    const emprendimiento = empRows[0];
    
    if (emprendimiento.estado !== 'pendiente') {
      return res.status(400).json({ 
        ok: false, 
        error: `El emprendimiento no está en estado pendiente (estado actual: ${emprendimiento.estado})` 
      });
    }
    
    // Cambiar estado a 'rechazado'
    const { rows: updatedRows } = await pool.query(
      `UPDATE emprendimientos 
       SET estado = 'rechazado', motivo_rechazo = $2, fecha_rechazo = NOW()
       WHERE id = $1
       RETURNING id, nombre, estado, motivo_rechazo, fecha_rechazo`,
      [id, motivo || 'No especificado']
    );
    
    logger.warn(`⚠️  Emprendimiento ${id} rechazado`);
    
    res.json({ 
      ok: true, 
      mensaje: 'Emprendimiento rechazado.',
      emprendimiento: updatedRows[0]
    });
  } catch (err) {
    logger.error('Error rechazando emprendimiento:', err.message);
    res.status(500).json({ ok: false, error: 'Error al rechazar emprendimiento' });
  }
});

module.exports = router;

