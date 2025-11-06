const express = require('express')
const cors = require('cors')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')
const { port, uploadsDir } = require('./config/env')
const routes = require('./routes')
const requestLogger = require('./middleware/requestLogger')
const logger = require('./utils/logger')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

app.use(cors())
app.use(express.json())

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), uploadsDir)))
logger.success(`✓ Servidor de archivos estáticos en /uploads`)

// Servir archivos estáticos (assets - logos, imágenes para emails)
app.use('/assets', express.static(path.join(__dirname, 'assets')))
logger.success(`✓ Servidor de assets en /assets`)

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

// Configurar Socket.IO
io.on('connection', (socket) => {
  logger.success(`✅ Cliente WebSocket conectado: ${socket.id}`)
  
  // Manejar desconección
  socket.on('disconnect', () => {
    logger.info(`❌ Cliente WebSocket desconectado: ${socket.id}`)
  })
})

// Hacer io disponible globalmente
app.set('io', io)

if (require.main === module) {
  server.listen(port, () => {
    logger.success(`Backend iniciado en puerto ${port}`)
    logger.info(`🔗 http://localhost:${port}`)
    logger.info(`🌐 Desde red local: http://TU_IP:${port}`)
    logger.info(`⚡ WebSocket server activo`)
  })
}

module.exports = { app, server, io }
