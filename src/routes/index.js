const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')

router.get('/health', (req, res) => {
  logger.info('Health check solicitado')
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

logger.success('✓ Rutas cargadas: /auth, /comunas, /direcciones, /emprendimientos, /emprendimientos/:id/productos, /auth/suscripcion, /pedidos, /estadisticas')

router.use('/auth', require('./auth'))
router.use('/comunas', require('./comunas'))
router.use('/direcciones', require('./direcciones'))
router.use('/pedidos', require('./pedidos'))
router.use('/emprendimientos', require('./emprendimientos'))
router.use('/estadisticas', require('./estadisticas'))
router.use('/', require('./productos')) // Productos después para capturar rutas anidadas

module.exports = router
