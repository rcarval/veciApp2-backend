const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const logger = require('../utils/logger')

// GET /api/comunas
router.get('/', async (req, res) => {
  try {
    logger.info('Consultando listado de comunas')
    const { rows } = await pool.query('SELECT id, nombre, region FROM comunas ORDER BY nombre ASC')
    logger.success(`Comunas obtenidas: ${rows.length}`)
    res.json({ comunas: rows })
  } catch (err) {
    logger.error('[comunas] Error obteniendo lista:', err.message)
    res.status(500).json({ error: 'Error interno al listar comunas' })
  }
})

module.exports = router
