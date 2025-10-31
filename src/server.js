const express = require('express')
const cors = require('cors')
const path = require('path')
const { port, uploadsDir } = require('./config/env')
const routes = require('./routes')
const requestLogger = require('./middleware/requestLogger')
const logger = require('./utils/logger')

const app = express()
app.use(cors())
app.use(express.json())

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), uploadsDir)))
logger.success(`✓ Servidor de archivos estáticos en /uploads`)

// Middleware de logging de peticiones
app.use(requestLogger)

app.use('/api', routes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

if (require.main === module) {
  app.listen(port, () => {
    logger.success(`Backend iniciado en puerto ${port}`)
    logger.info(`🔗 http://localhost:${port}`)
    logger.info(`🌐 Desde red local: http://TU_IP:${port}`)
  })
}

module.exports = app
