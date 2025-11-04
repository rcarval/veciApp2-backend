const express = require('express')
const router = express.Router()
const { pool } = require('../db/pool')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const path = require('path')
const fs = require('fs')
const { port, serverIp } = require('../config/env')
const multer = require('multer')
const bcrypt = require('bcrypt')

// Configuración de Twilio Verify para SMS
const twilioClient = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

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
              es_borrador, emprendimiento_original_id,
              fecha_creacion, fecha_actualizacion
       FROM emprendimientos 
       WHERE usuario_id = $1 AND estado != 'inactivo'
       ORDER BY CASE 
         WHEN es_borrador = true THEN 0 
         ELSE 1 
       END, fecha_creacion DESC`,
      [userId]
    )
    
    logger.success(`Emprendimientos obtenidos: ${rows.length} (incluye borradores)`)
    res.json({ ok: true, emprendimientos: rows })
  } catch (err) {
    logger.error('Error listando emprendimientos:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al listar emprendimientos' })
  }
})

// GET /api/emprendimientos - Listar emprendimientos públicos (para clientes)
// Soporta filtrado por categoría: ?categoria=comida
router.get('/', async (req, res) => {
  try {
    const { categoria } = req.query
    
    logger.info(`Listando emprendimientos públicos${categoria ? ` - categoría: ${categoria}` : ''}`)
    
    let query = `SELECT e.id, e.usuario_id, e.nombre, e.descripcion_corta, e.descripcion_larga, 
              e.comuna_id, e.direccion, e.telefono, e.logo_url, e.background_url,
              e.categoria_principal, e.subcategorias, e.horarios, e.medios_pago, 
              e.tipos_entrega, e.costo_delivery, e.latitud, e.longitud, e.estado,
              e.fecha_creacion, e.fecha_actualizacion,
              u.nombre as usuario_nombre, u.telefono as usuario_telefono,
              u.plan_id as usuario_plan_id
       FROM emprendimientos e
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.estado = 'activo'`
    
    const params = []
    
    // Agregar filtro de categoría si existe
    if (categoria) {
      query += ` AND e.categoria_principal = $1`
      params.push(categoria)
    }
    
    query += ` ORDER BY e.fecha_creacion DESC`
    
    const { rows } = await pool.query(query, params)
    
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

// POST /api/emprendimientos/:id/vendedor - Crear usuario vendedor para un emprendimiento
router.post('/:id/vendedor', auth, async (req, res) => {
  try {
    const { id: emprendimientoId } = req.params
    const { id: userId } = req.auth
    const { nombre, correo, contrasena } = req.body || {}
    
    logger.info(`Creando vendedor para emprendimiento ${emprendimientoId} por usuario ${userId}`)
    
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' })
    }
    
    // Verificar que el emprendimiento existe y pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Verificar que no existe otro vendedor para este emprendimiento
    const { rows: existingVendedor } = await pool.query(
      'SELECT id FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2',
      [emprendimientoId, 'vendedor']
    )
    
    if (existingVendedor.length > 0) {
      logger.warn(`Ya existe un vendedor para emprendimiento ${emprendimientoId}`)
      return res.status(409).json({ ok: false, error: 'Este emprendimiento ya tiene un vendedor asignado' })
    }
    
    // Verificar que el correo no esté registrado
    const { rows: existingEmail } = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(correo) = LOWER($1)',
      [correo]
    )
    
    if (existingEmail.length > 0) {
      logger.warn(`Correo ${correo} ya está registrado`)
      return res.status(409).json({ ok: false, error: 'El correo ya está registrado' })
    }
    
    // Crear usuario vendedor
    const hash = await bcrypt.hash(contrasena, 10)
    
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, correo, contrasena, tipo_usuario, estado, email_verificado, emprendimiento_asignado_id)
       VALUES ($1, LOWER($2), $3, 'vendedor', 'activo', true, $4)
       RETURNING id, nombre, correo, tipo_usuario, estado, emprendimiento_asignado_id, created_at`,
      [nombre, correo, hash, emprendimientoId]
    )
    
    logger.success(`Vendedor creado: ID ${rows[0].id}`)
    res.status(201).json({
      ok: true,
      mensaje: 'Vendedor creado exitosamente',
      vendedor: rows[0]
    })
  } catch (err) {
    logger.error('Error creando vendedor:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// GET /api/emprendimientos/:id/vendedor - Obtener vendedor de un emprendimiento
router.get('/:id/vendedor', auth, async (req, res) => {
  try {
    const { id: emprendimientoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Obteniendo vendedor para emprendimiento ${emprendimientoId}`)
    
    // Verificar que el emprendimiento existe y pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Buscar vendedor asignado
    const { rows } = await pool.query(
      'SELECT id, nombre, correo, tipo_usuario, estado, emprendimiento_asignado_id, created_at FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2',
      [emprendimientoId, 'vendedor']
    )
    
    if (!rows.length) {
      return res.json({ ok: true, vendedor: null })
    }
    
    logger.success(`Vendedor encontrado: ID ${rows[0].id}`)
    res.json({ ok: true, vendedor: rows[0] })
  } catch (err) {
    logger.error('Error obteniendo vendedor:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// DELETE /api/emprendimientos/:id/vendedor - Eliminar vendedor de un emprendimiento
router.delete('/:id/vendedor', auth, async (req, res) => {
  try {
    const { id: emprendimientoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Eliminando vendedor para emprendimiento ${emprendimientoId}`)
    
    // Verificar que el emprendimiento existe y pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    // Buscar y eliminar vendedor
    const { rows } = await pool.query(
      'DELETE FROM usuarios WHERE emprendimiento_asignado_id = $1 AND tipo_usuario = $2 RETURNING id',
      [emprendimientoId, 'vendedor']
    )
    
    if (!rows.length) {
      return res.json({ ok: true, mensaje: 'No había vendedor asignado' })
    }
    
    logger.success(`Vendedor eliminado: ID ${rows[0].id}`)
    res.json({ ok: true, mensaje: 'Vendedor eliminado correctamente' })
  } catch (err) {
    logger.error('Error eliminando vendedor:', err.message)
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
       medios_pago, tipos_entrega, costo_delivery, latitud, longitud, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'verificacion')
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
    
    logger.success(`Emprendimiento creado en estado 'verificacion': ID ${rows[0].id}`)
    res.status(201).json({ 
      ok: true, 
      mensaje: 'Emprendimiento creado. Se requiere verificación por SMS.',
      emprendimiento: rows[0],
      requiere_verificacion: true
    })
  } catch (err) {
    logger.error('Error creando emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno al crear emprendimiento' })
  }
})

// PUT /api/emprendimientos/:id - Actualizar emprendimiento (crea borrador si ya existe)
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
    
    // Verificar que el emprendimiento pertenece al usuario y obtener su estado
    const { rows: empRows } = await pool.query(
      'SELECT id, estado, logo_url, background_url FROM emprendimientos WHERE id = $1 AND usuario_id = $2 AND es_borrador = false',
      [id, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const emprendimientoOriginal = empRows[0]
    
    // Si el emprendimiento ya está activo o en cualquier estado diferente a 'verificacion',
    // crear un BORRADOR en lugar de actualizar directamente
    if (emprendimientoOriginal.estado !== 'verificacion') {
      logger.info(`Creando borrador para emprendimiento ${id} (original está en estado: ${emprendimientoOriginal.estado})`)
      
      // Primero eliminar cualquier borrador anterior de este emprendimiento
      await pool.query(
        'DELETE FROM emprendimientos WHERE emprendimiento_original_id = $1 AND es_borrador = true',
        [id]
      )
      
      // Crear nuevo borrador
      const insertBorrador = `
        INSERT INTO emprendimientos 
        (usuario_id, nombre, descripcion_corta, descripcion_larga, comuna_id,
         direccion, telefono, categoria_principal, subcategorias, horarios,
         medios_pago, tipos_entrega, costo_delivery, latitud, longitud,
         logo_url, background_url, estado, es_borrador, emprendimiento_original_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'verificacion', true, $18)
        RETURNING id, nombre, descripcion_corta, descripcion_larga, comuna_id,
                  direccion, telefono, logo_url, background_url, categoria_principal,
                  subcategorias, horarios, medios_pago, tipos_entrega, costo_delivery,
                  latitud, longitud, estado, es_borrador, emprendimiento_original_id, fecha_creacion
      `
      
      const { rows: borradorRows } = await pool.query(insertBorrador, [
        userId, nombre, descripcion_corta || null, descripcion_larga || null,
        comuna_id || null, direccion, telefono || null, categoria_principal || null,
        JSON.stringify(subcategorias || []), JSON.stringify(horarios || {}),
        JSON.stringify(medios_pago || {}), JSON.stringify(tipos_entrega || {}),
        costo_delivery || null, latitud || null, longitud || null,
        emprendimientoOriginal.logo_url, emprendimientoOriginal.background_url, id
      ])
      
      logger.success(`Borrador creado: ID ${borradorRows[0].id} (original: ${id})`)
      return res.json({ 
        ok: true, 
        mensaje: 'Borrador creado. Se requiere verificación por SMS.',
        emprendimiento: borradorRows[0],
        requiere_verificacion: true,
        es_borrador: true
      })
    }
    
    // Si está en estado 'verificacion' (es un emprendimiento nuevo o un borrador),
    // actualizar directamente
    logger.info(`Actualizando emprendimiento en verificación ${id}`)
    
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
                latitud, longitud, estado, es_borrador, emprendimiento_original_id, fecha_creacion, fecha_actualizacion
    `
    
    const { rows } = await pool.query(update, [
      id, userId, nombre, descripcion_corta, descripcion_larga, comuna_id,
      direccion, telefono, categoria_principal, JSON.stringify(subcategorias),
      JSON.stringify(horarios), JSON.stringify(medios_pago),
      JSON.stringify(tipos_entrega), costo_delivery, latitud, longitud
    ])
    
    logger.success(`Emprendimiento ${id} actualizado, requiere verificación`)
    res.json({ 
      ok: true, 
      mensaje: 'Emprendimiento actualizado. Se requiere verificación por SMS.',
      emprendimiento: rows[0],
      requiere_verificacion: true
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
    logger.info(`Procesando eliminación de emprendimiento ${id}`)
    
    const { rows: ownRows } = await pool.query(
      'SELECT es_borrador FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [id, userId]
    )
    
    if (!ownRows.length) {
      logger.warn(`Emprendimiento ${id} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const esBorrador = ownRows[0].es_borrador
    
    if (esBorrador) {
      // Si es borrador, eliminar físicamente (hard delete)
      logger.info(`Eliminando borrador ${id} físicamente`)
      await pool.query(
        'DELETE FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
        [id, userId]
      )
      logger.success(`Borrador ${id} eliminado físicamente`)
      res.json({ ok: true, mensaje: 'Borrador eliminado correctamente' })
    } else {
      // Si no es borrador, desactivar (soft delete)
      logger.info(`Desactivando emprendimiento ${id} y sus productos`)
      
      // Desactivar emprendimiento
      await pool.query(
        `UPDATE emprendimientos 
         SET estado = 'inactivo', fecha_actualizacion = NOW() 
         WHERE id = $1 AND usuario_id = $2`,
        [id, userId]
      )
      
      // Desactivar todos los productos asociados
      const { rowCount } = await pool.query(
        'UPDATE productos SET activo = false, fecha_actualizacion = NOW() WHERE emprendimiento_id = $1',
        [id]
      )
      
      logger.success(`Emprendimiento ${id} y ${rowCount} productos desactivados correctamente (soft delete)`)
      res.json({ 
        ok: true, 
        mensaje: 'Emprendimiento eliminado correctamente',
        productos_desactivados: rowCount
      })
    }
  } catch (err) {
    logger.error('Error procesando eliminación de emprendimiento:', err.message)
    res.status(500).json({ ok: false, error: 'Error interno' })
  }
})

// POST /api/emprendimientos/:id/enviar-codigo - Enviar código de verificación por SMS
router.post('/:id/enviar-codigo', auth, async (req, res) => {
  try {
    const { id: emprendimientoId } = req.params
    const { id: userId } = req.auth
    
    logger.info(`Enviando código de verificación para emprendimiento ${emprendimientoId}`)
    
    // Verificar que el emprendimiento pertenece al usuario
    const { rows: empRows } = await pool.query(
      'SELECT id, nombre, estado, telefono FROM emprendimientos WHERE id = $1 AND usuario_id = $2',
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado o no pertenece al usuario`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const emprendimiento = empRows[0]
    
    // Verificar que está en estado 'verificacion'
    if (emprendimiento.estado !== 'verificacion') {
      return res.status(400).json({ 
        ok: false, 
        error: 'El emprendimiento no requiere verificación' 
      })
    }
    
    // Formatear número de teléfono a formato E.164 si es necesario
    let telefonoFormateado = emprendimiento.telefono
    if (telefonoFormateado && !telefonoFormateado.startsWith('+')) {
      // Si empieza con 56, agregar +
      if (telefonoFormateado.startsWith('56')) {
        telefonoFormateado = '+' + telefonoFormateado
      } 
      // Si empieza con 9, agregar +56
      else if (telefonoFormateado.startsWith('9')) {
        telefonoFormateado = '+56' + telefonoFormateado
      }
    }
    
    // Registrar timestamp de envío
    await pool.query(
      `UPDATE emprendimientos 
       SET codigo_enviado_at = NOW() 
       WHERE id = $1`,
      [emprendimientoId]
    )
    
    try {
      // Usar Twilio Verify para enviar código
      const verification = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications
        .create({ 
          to: telefonoFormateado, 
          channel: 'sms',
          locale: 'es' // Español
        })
      
      logger.success(`✅ SMS de verificación enviado a ${telefonoFormateado}. SID: ${verification.sid}`)
      
      res.json({ 
        ok: true, 
        mensaje: `Código de verificación enviado al número ${emprendimiento.telefono}`,
        verification_sid: verification.sid
      })
    } catch (twilioError) {
      logger.error(`❌ Error de Twilio: ${twilioError.message}`)
      
      // Si es desarrollo o Twilio falla, usar modo de desarrollo
      if (process.env.NODE_ENV === 'development' || twilioError.code === 20003) {
        const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString()
        
        await pool.query(
          `UPDATE emprendimientos 
           SET codigo_verificacion = $1 
           WHERE id = $2`,
          [codigoVerificacion, emprendimientoId]
        )
        
        logger.warn(`⚠️  MODO DESARROLLO: SMS simulado. Código: ${codigoVerificacion}`)
        
        return res.json({ 
          ok: true, 
          mensaje: `Código de verificación (DEV) generado`,
          codigo_dev: codigoVerificacion,
          modo_desarrollo: true
        })
      }
      
      throw twilioError
    }
  } catch (err) {
    logger.error('Error enviando código de verificación:', err.message)
    res.status(500).json({ ok: false, error: 'Error al enviar código de verificación' })
  }
})

// POST /api/emprendimientos/:id/verificar-codigo - Verificar código de 6 dígitos
router.post('/:id/verificar-codigo', auth, async (req, res) => {
  try {
    const { id: emprendimientoId } = req.params
    const { id: userId } = req.auth
    const { codigo } = req.body || {}
    
    logger.info(`Verificando código para emprendimiento ${emprendimientoId}`)
    
    if (!codigo || codigo.length !== 6) {
      return res.status(400).json({ ok: false, error: 'Código inválido. Debe tener 6 dígitos' })
    }
    
    // Obtener emprendimiento con código
    const { rows: empRows } = await pool.query(
      `SELECT id, nombre, estado, codigo_verificacion, codigo_enviado_at, es_borrador, emprendimiento_original_id,
              usuario_id, descripcion_corta, descripcion_larga, comuna_id, direccion, telefono,
              categoria_principal, subcategorias, horarios, medios_pago, tipos_entrega, costo_delivery,
              latitud, longitud, logo_url, background_url
       FROM emprendimientos 
       WHERE id = $1 AND usuario_id = $2`,
      [emprendimientoId, userId]
    )
    
    if (!empRows.length) {
      logger.warn(`Emprendimiento ${emprendimientoId} no encontrado`)
      return res.status(404).json({ ok: false, error: 'Emprendimiento no encontrado' })
    }
    
    const emprendimiento = empRows[0]
    
    // Verificar que está en estado 'verificacion'
    if (emprendimiento.estado !== 'verificacion') {
      return res.status(400).json({ 
        ok: false, 
        error: 'El emprendimiento no está en proceso de verificación' 
      })
    }
    
    // Formatear número de teléfono a formato E.164
    let telefonoFormateado = emprendimiento.telefono
    if (telefonoFormateado && !telefonoFormateado.startsWith('+')) {
      if (telefonoFormateado.startsWith('56')) {
        telefonoFormateado = '+' + telefonoFormateado
      } else if (telefonoFormateado.startsWith('9')) {
        telefonoFormateado = '+56' + telefonoFormateado
      }
    }
    
    // Intentar verificar con Twilio Verify
    let codigoValido = false
    
    try {
      const verificationCheck = await twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verificationChecks
        .create({ 
          to: telefonoFormateado, 
          code: codigo 
        })
      
      logger.info(`Resultado Twilio Verify: ${verificationCheck.status}`)
      codigoValido = verificationCheck.status === 'approved'
      
      if (!codigoValido) {
        logger.warn(`Código incorrecto para emprendimiento ${emprendimientoId} (Twilio)`)
        return res.status(400).json({ 
          ok: false, 
          error: 'Código incorrecto. Verifica e intenta nuevamente.' 
        })
      }
    } catch (twilioError) {
      logger.warn(`Error al verificar con Twilio: ${twilioError.message}`)
      
      // Fallback: Verificar código manual (modo desarrollo)
      if (emprendimiento.codigo_verificacion) {
        // Verificar que el código no haya expirado (15 minutos)
        const tiempoTranscurrido = new Date() - new Date(emprendimiento.codigo_enviado_at)
        const minutosTranscurridos = tiempoTranscurrido / (1000 * 60)
        
        if (minutosTranscurridos > 15) {
          return res.status(400).json({ 
            ok: false, 
            error: 'El código ha expirado. Por favor solicita uno nuevo.',
            codigo_expirado: true
          })
        }
        
        // Verificar que el código coincide
        if (emprendimiento.codigo_verificacion !== codigo) {
          logger.warn(`Código incorrecto para emprendimiento ${emprendimientoId} (manual)`)
          return res.status(400).json({ 
            ok: false, 
            error: 'Código incorrecto. Verifica e intenta nuevamente.' 
          })
        }
        
        codigoValido = true
      } else {
        return res.status(400).json({ 
          ok: false, 
          error: 'No se ha generado un código de verificación. Por favor solicita uno nuevo.' 
        })
      }
    }
    
    // Código correcto - verificar si es un borrador o un emprendimiento nuevo
    if (emprendimiento.es_borrador && emprendimiento.emprendimiento_original_id) {
      // Es un BORRADOR - copiar datos al original y eliminarlo
      logger.info(`Aplicando cambios del borrador ${emprendimientoId} al original ${emprendimiento.emprendimiento_original_id}`)
      
      const { rows: updatedRows } = await pool.query(
        `UPDATE emprendimientos 
         SET nombre = $2,
             descripcion_corta = $3,
             descripcion_larga = $4,
             comuna_id = $5,
             direccion = $6,
             telefono = $7,
             categoria_principal = $8,
             subcategorias = $9::jsonb,
             horarios = $10::jsonb,
             medios_pago = $11::jsonb,
             tipos_entrega = $12::jsonb,
             costo_delivery = $13,
             latitud = $14,
             longitud = $15,
             logo_url = $16,
             background_url = $17,
             estado = 'pendiente',
             verificado_at = NOW(),
             fecha_actualizacion = NOW()
         WHERE id = $1
         RETURNING id, nombre, descripcion_corta, descripcion_larga, comuna_id,
                   direccion, telefono, logo_url, background_url, categoria_principal,
                   subcategorias, horarios, medios_pago, tipos_entrega, costo_delivery,
                   latitud, longitud, estado, verificado_at`,
        [
          emprendimiento.emprendimiento_original_id,
          emprendimiento.nombre,
          emprendimiento.descripcion_corta,
          emprendimiento.descripcion_larga,
          emprendimiento.comuna_id,
          emprendimiento.direccion,
          emprendimiento.telefono,
          emprendimiento.categoria_principal,
          JSON.stringify(emprendimiento.subcategorias),
          JSON.stringify(emprendimiento.horarios),
          JSON.stringify(emprendimiento.medios_pago),
          JSON.stringify(emprendimiento.tipos_entrega),
          emprendimiento.costo_delivery,
          emprendimiento.latitud,
          emprendimiento.longitud,
          emprendimiento.logo_url,
          emprendimiento.background_url
        ]
      )
      
      // Eliminar el borrador
      await pool.query('DELETE FROM emprendimientos WHERE id = $1', [emprendimientoId])
      
      logger.success(`✓ Borrador ${emprendimientoId} aplicado y eliminado. Original ${emprendimiento.emprendimiento_original_id} actualizado a pendiente`)
      
      return res.json({ 
        ok: true, 
        mensaje: 'Verificación exitosa. Los cambios están en revisión y serán activados pronto.',
        emprendimiento: updatedRows[0],
        verificado: true,
        borrador_aplicado: true
      })
    } else {
      // Es un EMPRENDIMIENTO NUEVO - cambiar a estado 'pendiente'
      const { rows: updatedRows } = await pool.query(
        `UPDATE emprendimientos 
         SET estado = 'pendiente', 
             verificado_at = NOW(),
             codigo_verificacion = NULL 
         WHERE id = $1 
         RETURNING id, nombre, estado, verificado_at`,
        [emprendimientoId]
      )
      
      logger.success(`✓ Emprendimiento ${emprendimientoId} verificado exitosamente`)
      
      return res.json({ 
        ok: true, 
        mensaje: 'Verificación exitosa. Tu emprendimiento está en revisión y será activado pronto.',
        emprendimiento: updatedRows[0],
        verificado: true
      })
    }
  } catch (err) {
    logger.error('Error verificando código:', err.message)
    res.status(500).json({ ok: false, error: 'Error al verificar código' })
  }
})

module.exports = router

