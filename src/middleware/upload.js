const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { uploadsDir } = require('../config/env')
const logger = require('../utils/logger')

// Crear directorio de uploads si no existe
const avatarsDir = path.join(process.cwd(), uploadsDir, 'usuarios', 'avatar')
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true })
  logger.success(`✓ Directorio de avatares creado: ${avatarsDir}`)
}

// Configurar almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir)
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp + número aleatorio + extensión
    const ext = path.extname(file.originalname)
    const filename = `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`
    cb(null, filename)
  }
})

// Filtrar solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const mimetype = allowedTypes.test(file.mimetype)
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  
  if (mimetype && extname) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'))
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter
})

module.exports = { upload, avatarsDir }

