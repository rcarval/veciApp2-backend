const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')

function mapRowToApp(row) {
  return {
    id: String(row.id),
    nombre: row.nombre,
    direccion: row.direccion,
    referencia: row.referencia,
    esPrincipal: row.es_principal,
    coordenadas: (row.latitud != null && row.longitud != null)
      ? { lat: Number(row.latitud), lng: Number(row.longitud) }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// GET /api/direcciones
router.get('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Consultando direcciones del usuario ID: ${userId}`)
    const q = `SELECT id, nombre, direccion, referencia, es_principal, latitud, longitud, created_at, updated_at
               FROM direcciones WHERE usuario_id=$1 ORDER BY id DESC`
    const { rows } = await pool.query(q, [userId])
    const direcciones = rows.map(mapRowToApp)
    logger.success(`Direcciones obtenidas: ${direcciones.length}`)
    res.json({ ok: true, direcciones })
  } catch (err) {
    logger.error('[direcciones] Error obteniendo lista:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/direcciones
router.post('/', auth, async (req, res) => {
  const { nombre, direccion, referencia, es_principal, latitud, longitud } = req.body || {}
  logger.info(`Creando nueva dirección: es_principal=${es_principal}`)
  
  if (!nombre || !direccion) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' })
  }
  try {
    const { id: userId } = req.auth
    if (es_principal === true) {
      logger.info(`Desmarcando otras direcciones principales del usuario ${userId}`)
      await pool.query('UPDATE direcciones SET es_principal=false WHERE usuario_id=$1', [userId])
    }
    const insert = `INSERT INTO direcciones (usuario_id, nombre, direccion, referencia, es_principal, latitud, longitud)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    RETURNING id, nombre, direccion, referencia, es_principal, latitud, longitud, created_at, updated_at`
    const { rows } = await pool.query(insert, [userId, nombre, direccion, referencia || null, Boolean(es_principal === true), latitud || null, longitud || null])
    const dir = mapRowToApp(rows[0])
    logger.success(`Dirección ${dir.id} creada. Principal: ${dir.esPrincipal}`)
    res.status(201).json({ ok: true, mensaje: 'Dirección guardada correctamente', direccion: dir })
  } catch (err) {
    logger.error('Error creando dirección:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PUT /api/direcciones/:id
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params
  const { nombre, direccion, referencia, es_principal, latitud, longitud } = req.body || {}
  logger.info(`Actualizando dirección ${id}: es_principal=${es_principal}`)
  logger.db(`Body recibido: ${JSON.stringify(req.body)}`)
  
  if (!nombre || !direccion) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' })
  }
  try {
    const { id: userId } = req.auth
    const own = await pool.query('SELECT 1 FROM direcciones WHERE id=$1 AND usuario_id=$2', [id, userId])
    if (!own.rowCount) {
      logger.warn(`Dirección ${id} no encontrada o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Dirección no encontrada' })
    }
    if (es_principal === true) {
      logger.info(`Desmarcando otras direcciones principales del usuario ${userId}`)
      await pool.query('UPDATE direcciones SET es_principal=false WHERE usuario_id=$1 AND id<>$2', [userId, id])
    }
    const upd = `UPDATE direcciones SET nombre=$1, direccion=$2, referencia=$3, es_principal=$4, latitud=$5, longitud=$6, updated_at=NOW()
                 WHERE id=$7 AND usuario_id=$8 RETURNING id, nombre, direccion, referencia, es_principal, latitud, longitud, created_at, updated_at`
    const { rows } = await pool.query(upd, [nombre, direccion, referencia || null, Boolean(es_principal === true), latitud || null, longitud || null, id, userId])
    const dir = mapRowToApp(rows[0])
    logger.success(`Dirección ${id} actualizada. Principal: ${dir.esPrincipal}`)
    res.json({ ok: true, mensaje: 'Dirección actualizada correctamente', direccion: dir })
  } catch (err) {
    logger.error('Error actualizando dirección:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// DELETE /api/direcciones/:id
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params
  logger.info(`Eliminando dirección ${id}`)
  try {
    const { id: userId } = req.auth
    const del = await pool.query('DELETE FROM direcciones WHERE id=$1 AND usuario_id=$2', [id, userId])
    if (!del.rowCount) {
      logger.warn(`Dirección ${id} no encontrada o no pertenece al usuario ${userId}`)
      return res.status(404).json({ ok: false, error: 'Dirección no encontrada' })
    }
    logger.success(`Dirección ${id} eliminada correctamente`)
    res.json({ ok: true, mensaje: 'Dirección eliminada correctamente' })
  } catch (err) {
    logger.error('Error eliminando dirección:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router
