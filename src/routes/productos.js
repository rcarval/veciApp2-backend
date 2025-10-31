const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { port, serverIp } = require('../config/env')

// Directorio de uploads para productos
const productosDir = path.join(process.cwd(), 'uploads', 'productos')
if (!fs.existsSync(productosDir)) {
  fs.mkdirSync(productosDir, { recursive: true })
  logger.success(`✓ Directorio de productos creado: ${productosDir}`)
}

// Configurar almacenamiento para productos
const storageProductos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productosDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`
    cb(null, filename)
  }
})

const fileFilterProductos = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const mimetype = allowedTypes.test(file.mimetype)
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  
  if (mimetype && extname) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos de imagen'))
  }
}

const uploadProducto = multer({
  storage: storageProductos,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterProductos
})

// GET /api/emprendimientos/:id/mis-productos - Listar productos del emprendimiento (con auth, para gestión)
router.get('/emprendimientos/:emprendimientoId/mis-productos', auth, async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Listando productos del emprendimiento ${emprendimientoId} para gestión`)
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, precio, categoria, imagen_url, 
              oferta, precio_oferta, activo, fecha_creacion, fecha_actualizacion
       FROM productos 
       WHERE emprendimiento_id = $1 
       ORDER BY fecha_creacion DESC`,
      [emprendimientoId]
    )
    
    logger.success(`Productos obtenidos: ${rows.length}`)
    res.json({ ok: true, productos: rows })
  } catch (err) {
    logger.error('Error listando productos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar productos' })
  }
})

// GET /api/emprendimientos/:id/productos - Listar productos públicos de un emprendimiento (sin auth)
// Función auxiliar para calcular el estado del emprendimiento basándose en horarios
const calcularEstadoHorarios = (horarios) => {
  if (!horarios || typeof horarios !== 'object') {
    return { estado: 'cerrado', horaCierre: null }
  }
  
  const ahora = new Date()
  const diaActual = ahora.toLocaleDateString('es-CL', { weekday: 'long' })
  const horaActual = ahora.getHours()
  const minutosActuales = ahora.getMinutes()
  const horaActualMinutos = horaActual * 60 + minutosActuales
  
  // Mapear días en español a los nombres usados en la BD
  const diasMap = {
    'lunes': 'Lunes',
    'martes': 'Martes',
    'miércoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes',
    'sábado': 'Sábado',
    'domingo': 'Domingo'
  }
  
  const diaCapitalizado = diaActual.charAt(0).toUpperCase() + diaActual.slice(1).toLowerCase()
  const diaEnBD = diasMap[diaActual.toLowerCase()] || diaCapitalizado
  
  // Obtener horarios del día actual
  const horariosDia = horarios[diaEnBD]
  
  if (!horariosDia || !Array.isArray(horariosDia) || horariosDia.length === 0) {
    return { estado: 'cerrado', horaCierre: null }
  }
  
  // Verificar si está abierto en alguno de los horarios del día
  for (const horario of horariosDia) {
    if (!horario.inicio || !horario.fin) continue
    
    // Convertir horarios a minutos desde medianoche
    const [horaInicio, minInicio] = horario.inicio.split(':').map(Number)
    const [horaFin, minFin] = horario.fin.split(':').map(Number)
    const inicioMinutos = horaInicio * 60 + minInicio
    const finMinutos = horaFin * 60 + minFin
    
    // Verificar si la hora actual está dentro del rango
    if (horaActualMinutos >= inicioMinutos && horaActualMinutos <= finMinutos) {
      // Está abierto - verificar si cierra pronto (menos de 1 hora)
      const minutosRestantes = finMinutos - horaActualMinutos
      if (minutosRestantes <= 60) {
        return { 
          estado: 'cierra_pronto', 
          horaCierre: horario.fin,
          minutosRestantes: minutosRestantes
        }
      }
      return { 
        estado: 'abierto', 
        horaCierre: horario.fin 
      }
    }
  }
  
  return { estado: 'cerrado', horaCierre: null }
}

router.get('/emprendimientos/:emprendimientoId/productos', async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    
    logger.info(`Listando productos públicos del emprendimiento ${emprendimientoId}`)
    
    // Verificar que el emprendimiento existe, está activo y obtener sus horarios
    const { rows: empRows } = await pool.query(
      'SELECT id, estado, horarios FROM emprendimientos WHERE id = $1 AND estado = $2',
      [emprendimientoId, 'activo']
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no está disponible`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const emprendimiento = empRows[0]
    
    // Verificar si está abierto según horarios
    const estadoHorarios = calcularEstadoHorarios(emprendimiento.horarios)
    
    // Si está cerrado, no devolver productos
    if (estadoHorarios.estado === 'cerrado') {
      logger.info(`Emprendimiento ${emprendimientoId} está cerrado, no se devuelven productos`)
      return res.json({ ok: true, productos: [] })
    }
    
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, precio, categoria, imagen_url, 
              oferta, precio_oferta, activo, fecha_creacion, fecha_actualizacion
       FROM productos 
       WHERE emprendimiento_id = $1 AND activo = true
       ORDER BY categoria, fecha_creacion DESC`,
      [emprendimientoId]
    )
    
    logger.success(`Productos públicos obtenidos: ${rows.length}`)
    res.json({ ok: true, productos: rows })
  } catch (err) {
    logger.error('Error listando productos públicos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar productos' })
  }
})

// GET /api/emprendimientos/:id/productos/:productoId - Obtener un producto específico
router.get('/emprendimientos/:emprendimientoId/productos/:productoId', auth, async (req, res) => {
  try {
    const { emprendimientoId, productoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo producto ${productoId} del emprendimiento ${emprendimientoId}`)
    
    // Verificar ownership del emprendimiento
    const { rows: empRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const { rows } = await pool.query(
      `SELECT * FROM productos 
       WHERE id = $1 AND emprendimiento_id = $2`,
      [productoId, emprendimientoId]
    )
    
    if (!rows.length) {
      logger.warn(`Producto ${productoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Producto no encontrado' })
    }
    
    logger.success(`Producto obtenido: ${rows[0].nombre}`)
    res.json({ ok: true, producto: rows[0] })
  } catch (err) {
    logger.error('Error obteniendo producto:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/emprendimientos/:id/productos - Crear nuevo producto
router.post('/emprendimientos/:emprendimientoId/productos', auth, uploadProducto.single('imagen'), async (req, res) => {
  try {
    const { emprendimientoId } = req.params
    const { id: userId } = req.auth
    const {
      nombre, descripcion, precio, categoria,
      oferta, precio_oferta
    } = req.body || {}
    
    logger.info(`Creando producto para emprendimiento ${emprendimientoId}: ${nombre}`)
    logger.db(`Body recibido: ${JSON.stringify({ nombre, descripcion, precio, categoria, oferta, precio_oferta })}`)
    
    // Validar campos obligatorios
    if (!nombre || !descripcion || !precio) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (nombre, descripcion, precio)' })
    }
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path)
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Construir URL de la imagen si existe
    let imagenUrl = null
    if (req.file) {
      imagenUrl = `http://${serverIp}:${port}/uploads/productos/${req.file.filename}`
    }
    
    // Validar categoría
    const categoriasValidas = ['principal', 'oferta', 'secundario']
    const categoriaValida = categoriasValidas.includes(categoria) ? categoria : 'principal'
    
    // Insertar producto
    const insert = `
      INSERT INTO productos 
      (emprendimiento_id, nombre, descripcion, precio, categoria, 
       imagen_url, oferta, precio_oferta, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, nombre, descripcion, precio, categoria, imagen_url, 
                oferta, precio_oferta, activo, fecha_creacion, fecha_actualizacion
    `
    
    const ofertaBool = oferta === 'true' || oferta === true
    const { rows } = await pool.query(insert, [
      emprendimientoId, nombre, descripcion, precio, categoriaValida,
      imagenUrl, ofertaBool, precio_oferta || null
    ])
    
    logger.success(`Producto creado: ID ${rows[0].id}`)
    res.status(201).json({ 
      ok: true, 
      mensaje: 'Producto creado exitosamente',
      producto: rows[0]
    })
  } catch (err) {
    logger.error('Error creando producto:', err.message)
    
    // Limpiar archivo si hubo error
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path) } catch (e) {}
    }
    
    res.status(500).json({ ok: false, error: 'Error interno al crear producto' })
  }
})

// PUT /api/emprendimientos/:id/productos/:productoId - Actualizar producto
router.put('/emprendimientos/:emprendimientoId/productos/:productoId', auth, uploadProducto.single('imagen'), async (req, res) => {
  try {
    const { emprendimientoId, productoId } = req.params
    const { id: userId } = req.auth
    const {
      nombre, descripcion, precio, categoria,
      oferta, precio_oferta, activo
    } = req.body || {}
    
    logger.info(`Actualizando producto ${productoId} del emprendimiento ${emprendimientoId}`)
    logger.db(`Body recibido: ${JSON.stringify({ nombre, descripcion, precio, categoria, oferta, precio_oferta, activo })}`)
    
    // Verificar ownership del emprendimiento
    const { rows: empRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path)
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Verificar que el producto existe y pertenece al emprendimiento
    const { rows: prodRows } = await pool.query(
      'SELECT * FROM productos WHERE id = $1 AND emprendimiento_id = $2',
      [productoId, emprendimientoId]
    )
    
    if (!prodRows.length) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path)
      logger.warn(`Producto ${productoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Producto no encontrado' })
    }
    
    // Obtener imagen anterior
    const oldImagenUrl = prodRows[0].imagen_url
    let newImagenUrl = oldImagenUrl
    
    // Si hay nueva imagen, construir URL
    if (req.file) {
      newImagenUrl = `http://${serverIp}:${port}/uploads/productos/${req.file.filename}`
    }
    
    // Validar categoría si viene en el body
    let categoriaValida = prodRows[0].categoria
    if (categoria) {
      const categoriasValidas = ['principal', 'oferta', 'secundario']
      if (categoriasValidas.includes(categoria)) {
        categoriaValida = categoria
      }
    }
    
    // Actualizar producto
    const update = `
      UPDATE productos SET
        nombre = COALESCE($3, nombre),
        descripcion = COALESCE($4, descripcion),
        precio = COALESCE($5, precio),
        categoria = COALESCE($6, categoria),
        imagen_url = COALESCE($7, imagen_url),
        oferta = COALESCE($8, oferta),
        precio_oferta = COALESCE($9, precio_oferta),
        activo = COALESCE($10, activo),
        fecha_actualizacion = NOW()
      WHERE id = $1 AND emprendimiento_id = $2
      RETURNING id, nombre, descripcion, precio, categoria, imagen_url, 
                oferta, precio_oferta, activo, fecha_creacion, fecha_actualizacion
    `
    
    const ofertaBool = oferta === 'true' || oferta === true
    const activoBool = activo !== undefined ? (activo === 'true' || activo === true) : undefined
    
    const { rows } = await pool.query(update, [
      productoId, emprendimientoId, nombre || null, descripcion || null, precio || null,
      categoriaValida || null, newImagenUrl || null, ofertaBool, precio_oferta || null, activoBool
    ])
    
    // Eliminar imagen anterior si se subió nueva
    if (req.file && oldImagenUrl && oldImagenUrl.includes('/uploads/productos/')) {
      const oldFilename = oldImagenUrl.split('/').pop()
      const oldPath = path.join(productosDir, oldFilename)
      try {
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath)
          logger.success(`Imagen anterior eliminada: ${oldFilename}`)
        }
      } catch (err) {
        logger.error(`Error eliminando imagen anterior: ${err.message}`)
      }
    }
    
    logger.success(`Producto ${productoId} actualizado`)
    res.json({ 
      ok: true, 
      mensaje: 'Producto actualizado correctamente',
      producto: rows[0]
    })
  } catch (err) {
    logger.error('Error actualizando producto:', err.message)
    
    // Limpiar archivo si hubo error
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path) } catch (e) {}
    }
    
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// DELETE /api/emprendimientos/:id/productos/:productoId - Eliminar producto
router.delete('/emprendimientos/:emprendimientoId/productos/:productoId', auth, async (req, res) => {
  try {
    const { emprendimientoId, productoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Eliminando producto ${productoId} del emprendimiento ${emprendimientoId}`)
    
    // Verificar ownership del emprendimiento
    const { rows: empRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Obtener imagen para eliminarla
    const { rows: prodRows } = await pool.query(
      'SELECT imagen_url FROM productos WHERE id = $1 AND emprendimiento_id = $2',
      [productoId, emprendimientoId]
    )
    
    if (!prodRows.length) {
      logger.warn(`Producto ${productoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Producto no encontrado' })
    }
    
    // Eliminar el producto
    await pool.query(
      'DELETE FROM productos WHERE id = $1 AND emprendimiento_id = $2',
      [productoId, emprendimientoId]
    )
    
    // Eliminar imagen si existe
    const imagenUrl = prodRows[0].imagen_url
    if (imagenUrl && imagenUrl.includes('/uploads/productos/')) {
      const filename = imagenUrl.split('/').pop()
      const filePath = path.join(productosDir, filename)
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          logger.success(`Imagen eliminada: ${filename}`)
        }
      } catch (err) {
        logger.error(`Error eliminando imagen: ${err.message}`)
      }
    }
    
    logger.success(`Producto ${productoId} eliminado correctamente`)
    res.json({ ok: true, mensaje: 'Producto eliminado correctamente' })
  } catch (err) {
    logger.error('Error eliminando producto:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

module.exports = router

