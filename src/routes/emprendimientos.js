const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const path = require('path')
const fs = require('fs')
const { port, serverIp } = require('../config/env')
const multer = require('multer')

// Directorio de uploads para emprendimientos
const emprendimientosDir = path.join(process.cwd(), 'uploads', 'emprendimientos')
if (!fs.existsSync(emprendimientosDir)) {
  fs.mkdirSync(emprendimientosDir, { recursive: true })
  logger.success(`✓ Directorio de emprendimientos creado: ${emprendimientosDir}`)
}

// Configurar almacenamiento para emprendimientos - se configura por endpoint
const createStorage = (tipo) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(emprendimientosDir, tipo)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      const filename = `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`
      cb(null, filename)
    }
  })
}

const fileFilterEmprendimientos = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const mimetype = allowedTypes.test(file.mimetype)
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  
  if (mimetype && extname) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos de imagen'))
  }
}

// Crear instancias de multer por tipo
const uploadLogo = multer({
  storage: createStorage('logo'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterEmprendimientos
})

const uploadBackground = multer({
  storage: createStorage('background'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilterEmprendimientos
})

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

// GET /api/emprendimientos - Listar todos los emprendimientos del usuario autenticado
router.get('/mis-emprendimientos', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    logger.info(`Listando emprendimientos para usuario ${userId}`)
    
    const { rows } = await pool.query(
      `SELECT id, usuario_id, nombre, descripcion_corta, descripcion_larga, 
              comuna_id, direccion, telefono, logo_url, background_url,
              categoria_principal, subcategorias, horarios, medios_pago, 
              tipos_entrega, costo_delivery, latitud, longitud, estado,
              fecha_creacion, fecha_actualizacion
       FROM emprendimientos 
       WHERE usuario_id = $1 
       ORDER BY fecha_creacion DESC`,
      [userId]
    )
    
    logger.success(`Emprendimientos obtenidos: ${rows.length}`)
    res.json({ ok: true, emprendimientos: rows })
  } catch (err) {
    logger.error('Error listando emprendimientos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar emprendimientos' })
  }
})

// GET /api/emprendimientos - Listar emprendimientos públicos (para clientes)
router.get('/', async (req, res) => {
  try {
    logger.info('Listando emprendimientos públicos')
    
    const { rows } = await pool.query(
      `SELECT e.id, e.usuario_id, e.nombre, e.descripcion_corta, e.descripcion_larga, 
              e.comuna_id, e.direccion, e.telefono, e.logo_url, e.background_url,
              e.categoria_principal, e.subcategorias, e.horarios, e.medios_pago, 
              e.tipos_entrega, e.costo_delivery, e.latitud, e.longitud, e.estado,
              e.fecha_creacion, e.fecha_actualizacion,
              u.nombre as usuario_nombre, u.telefono as usuario_telefono,
              u.plan_id as usuario_plan_id
       FROM emprendimientos e
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.estado = 'activo'
       ORDER BY e.fecha_creacion DESC`
    )
    
    // Filtrar y agregar estado calculado según horarios
    const emprendimientosFiltrados = rows
      .map(emp => {
        const estadoHorarios = calcularEstadoHorarios(emp.horarios)
        
        // Agregar estado calculado al emprendimiento
        return {
          ...emp,
          estado_calculado: estadoHorarios.estado,
          hora_cierre: estadoHorarios.horaCierre
        }
      })
      .filter(emp => emp.estado_calculado !== 'cerrado') // Filtrar cerrados
    
    logger.success(`Emprendimientos públicos obtenidos: ${emprendimientosFiltrados.length} (filtrados de ${rows.length})`)
    res.json({ ok: true, emprendimientos: emprendimientosFiltrados })
  } catch (err) {
    logger.error('Error listando emprendimientos públicos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar emprendimientos' })
  }
})

// GET /api/emprendimientos/:id - Obtener un emprendimiento específico (público)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    logger.info(`Obteniendo emprendimiento ${id}`)
    
    const { rows } = await pool.query(
      `SELECT e.*, u.nombre as usuario_nombre, u.telefono as usuario_telefono
       FROM emprendimientos e
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.id = $1`,
      [id]
    )
    
    if (!rows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Agregar estado calculado según horarios
    const emprendimiento = rows[0]
    const estadoHorarios = calcularEstadoHorarios(emprendimiento.horarios)
    emprendimiento.estado_calculado = estadoHorarios.estado
    emprendimiento.hora_cierre = estadoHorarios.horaCierre
    
    logger.success(`Emprendimiento obtenido: ${emprendimiento.nombre}`)
    res.json({ ok: true, emprendimiento })
  } catch (err) {
    logger.error('Error obteniendo emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/emprendimientos - Crear nuevo emprendimiento
router.post('/', auth, async (req, res) => {
  try {
    const { id: userId } = req.auth
    const {
      nombre, descripcion_corta, descripcion_larga, comuna_id,
      direccion, telefono, categoria_principal, subcategorias,
      horarios, medios_pago, tipos_entrega, costo_delivery,
      latitud, longitud
    } = req.body || {}
    
    logger.info(`Creando emprendimiento para usuario ${userId}: ${nombre}`)
    
    if (!nombre || !direccion) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' })
    }
    
    const insert = `
      INSERT INTO emprendimientos 
      (usuario_id, nombre, descripcion_corta, descripcion_larga, comuna_id,
       direccion, telefono, categoria_principal, subcategorias, horarios,
       medios_pago, tipos_entrega, costo_delivery, latitud, longitud)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, nombre, descripcion_corta, descripcion_larga, comuna_id,
                direccion, telefono, logo_url, background_url, categoria_principal,
                subcategorias, horarios, medios_pago, tipos_entrega, costo_delivery,
                latitud, longitud, estado, fecha_creacion
    `
    
    const { rows } = await pool.query(insert, [
      userId, nombre, descripcion_corta || null, descripcion_larga || null,
      comuna_id || null, direccion, telefono || null, categoria_principal || null,
      JSON.stringify(subcategorias || []), JSON.stringify(horarios || {}),
      JSON.stringify(medios_pago || {}), JSON.stringify(tipos_entrega || {}),
      costo_delivery || null, latitud || null, longitud || null
    ])
    
    logger.success(`Emprendimiento creado: ID ${rows[0].id}`)
    res.status(201).json({ 
      ok: true, 
      mensaje: 'Emprendimiento creado exitosamente',
      emprendimiento: rows[0]
    })
  } catch (err) {
    logger.error('Error creando emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al crear emprendimiento' })
  }
})

// PUT /api/emprendimientos/:id - Actualizar emprendimiento
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    const {
      nombre, descripcion_corta, descripcion_larga, comuna_id,
      direccion, telefono, categoria_principal, subcategorias,
      horarios, medios_pago, tipos_entrega, costo_delivery,
      latitud, longitud
    } = req.body || {}
    
    logger.info(`Actualizando emprendimiento ${id} del usuario ${userId}`)
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: ownRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const update = `
      UPDATE emprendimientos SET
        nombre = COALESCE($3, nombre),
        descripcion_corta = COALESCE($4, descripcion_corta),
        descripcion_larga = COALESCE($5, descripcion_larga),
        comuna_id = COALESCE($6, comuna_id),
        direccion = COALESCE($7, direccion),
        telefono = COALESCE($8, telefono),
        categoria_principal = COALESCE($9, categoria_principal),
        subcategorias = COALESCE($10::jsonb, subcategorias),
        horarios = COALESCE($11::jsonb, horarios),
        medios_pago = COALESCE($12::jsonb, medios_pago),
        tipos_entrega = COALESCE($13::jsonb, tipos_entrega),
        costo_delivery = COALESCE($14, costo_delivery),
        latitud = COALESCE($15, latitud),
        longitud = COALESCE($16, longitud),
        fecha_actualizacion = NOW()
      WHERE id = $1 AND usuario_id = $2
      RETURNING id, nombre, descripcion_corta, descripcion_larga, comuna_id,
                direccion, telefono, logo_url, background_url, categoria_principal,
                subcategorias, horarios, medios_pago, tipos_entrega, costo_delivery,
                latitud, longitud, estado, fecha_creacion, fecha_actualizacion
    `
    
    const { rows } = await pool.query(update, [
      id, userId, nombre, descripcion_corta, descripcion_larga, comuna_id,
      direccion, telefono, categoria_principal, JSON.stringify(subcategorias),
      JSON.stringify(horarios), JSON.stringify(medios_pago),
      JSON.stringify(tipos_entrega), costo_delivery, latitud, longitud
    ])
    
    logger.success(`Emprendimiento ${id} actualizado`)
    res.json({ 
      ok: true, 
      mensaje: 'Emprendimiento actualizado correctamente',
      emprendimiento: rows[0]
    })
  } catch (err) {
    logger.error('Error actualizando emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// PATCH /api/emprendimientos/:id - Actualizar estado del emprendimiento
router.patch('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    const { estado } = req.body || {}
    
    logger.info(`Actualizando estado del emprendimiento ${id}: ${estado}`)
    
    if (!estado) {
      return res.status(400).json({ ok: false, error: 'Estado requerido' })
    }
    
    // Verificar que pertenece al usuario
    const { rows: ownRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const { rows } = await pool.query(
      'UPDATE emprendimientos SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2 AND usuario_id = $3 RETURNING id, estado',
      [estado, id, userId]
    )
    
    logger.success(`Estado del emprendimiento ${id} actualizado a ${estado}`)
    res.json({ ok: true, mensaje: 'Estado actualizado correctamente', emprendimiento: rows[0] })
  } catch (err) {
    logger.error('Error actualizando estado:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// DELETE /api/emprendimientos/:id - Eliminar emprendimiento
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { id: userId } = req.auth
    logger.info(`Eliminando emprendimiento ${id}`)
    
    const { rows: ownRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    await pool.query('DELETE FROM emprendimientos WHERE id = $1 AND usuario_id = $2', [id, userId])
    
    logger.success(`Emprendimiento ${id} eliminado correctamente`)
    res.json({ ok: true, mensaje: 'Emprendimiento eliminado correctamente' })
  } catch (err) {
    logger.error('Error eliminando emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/emprendimientos/:id/logo - Subir logo del emprendimiento
router.post('/:id/logo', auth, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No se proporcionó archivo' })
    }
    
    const { id } = req.params
    const { id: userId } = req.auth
    logger.info(`Subiendo logo para emprendimiento ${id}`)
    
    // Verificar ownership
    const { rows: ownRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      // Limpiar archivo subido
      if (req.file.path) fs.unlinkSync(req.file.path)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Construir URL
    const logoUrl = `http://${serverIp}:${port}/uploads/emprendimientos/logo/${req.file.filename}`
    
    // Obtener URL anterior ANTES de actualizar
    const { rows: oldRows } = await pool.query('SELECT logo_url FROM emprendimientos WHERE id = $1', [id])
    const oldLogoUrl = oldRows[0]?.logo_url
    
    logger.db(`Logo anterior: ${oldLogoUrl || 'ninguno'}`)
    
    // Actualizar
    await pool.query('UPDATE emprendimientos SET logo_url = $1 WHERE id = $2', [logoUrl, id])
    
    // Eliminar logo anterior - BÚSQUEDA ROBUSTA
    if (oldLogoUrl) {
      try {
        // Intentar extraer nombre de archivo de diferentes formatos de URL
        const oldFilename = oldLogoUrl.split('/').pop()
        const oldPath = path.join(emprendimientosDir, 'logo', oldFilename)
        
        logger.db(`Intentando eliminar: ${oldPath}`)
        
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath)
          logger.success(`Logo anterior eliminado: ${oldFilename}`)
        } else {
          logger.warn(`Logo anterior no encontrado en: ${oldPath}`)
        }
      } catch (err) {
        logger.error(`Error eliminando logo anterior: ${err.message}`)
      }
    } else {
      logger.info('No hay logo anterior que eliminar')
    }
    
    logger.success(`Logo actualizado para emprendimiento ${id}`)
    res.json({ ok: true, mensaje: 'Logo actualizado correctamente', logo_url: logoUrl })
  } catch (err) {
    logger.error('Error subiendo logo:', err.message)
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path) } catch (e) {}
    }
    res.status(500).json({ ok: false, error: 'Error al subir logo' })
  }
})

// POST /api/emprendimientos/:id/background - Subir imagen de fondo del emprendimiento
router.post('/:id/background', auth, uploadBackground.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No se proporcionó archivo' })
    }
    
    const { id } = req.params
    const { id: userId } = req.auth
    logger.info(`Subiendo background para emprendimiento ${id}`)
    
    // Verificar ownership
    const { rows: ownRows } = await pool.query(
      'SELECT 1 FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      if (req.file.path) fs.unlinkSync(req.file.path)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Construir URL
    const backgroundUrl = `http://${serverIp}:${port}/uploads/emprendimientos/background/${req.file.filename}`
    
    // Obtener URL anterior ANTES de actualizar
    const { rows: oldRows } = await pool.query('SELECT background_url FROM emprendimientos WHERE id = $1', [id])
    const oldBackgroundUrl = oldRows[0]?.background_url
    
    logger.db(`Background anterior: ${oldBackgroundUrl || 'ninguno'}`)
    
    // Actualizar
    await pool.query('UPDATE emprendimientos SET background_url = $1 WHERE id = $2', [backgroundUrl, id])
    
    // Eliminar background anterior - BÚSQUEDA ROBUSTA
    if (oldBackgroundUrl) {
      try {
        // Intentar extraer nombre de archivo de diferentes formatos de URL
        const oldFilename = oldBackgroundUrl.split('/').pop()
        const oldPath = path.join(emprendimientosDir, 'background', oldFilename)
        
        logger.db(`Intentando eliminar: ${oldPath}`)
        
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath)
          logger.success(`Background anterior eliminado: ${oldFilename}`)
        } else {
          logger.warn(`Background anterior no encontrado en: ${oldPath}`)
        }
      } catch (err) {
        logger.error(`Error eliminando background anterior: ${err.message}`)
      }
    } else {
      logger.info('No hay background anterior que eliminar')
    }
    
    logger.success(`Background actualizado para emprendimiento ${id}`)
    res.json({ ok: true, mensaje: 'Imagen de fondo actualizada correctamente', background_url: backgroundUrl })
  } catch (err) {
    logger.error('Error subiendo background:', err.message)
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path) } catch (e) {}
    }
    res.status(500).json({ ok: false, error: 'Error al subir imagen de fondo' })
  }
})

module.exports = router

