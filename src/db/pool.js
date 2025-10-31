const { Pool, types } = require('pg')
const { databaseUrl } = require('../config/env')
const logger = require('../utils/logger')

// Configurar tipos de PostgreSQL para que devuelva JSON/JSONB como objetos JavaScript
types.setTypeParser(types.builtins.JSON, val => val)
types.setTypeParser(types.builtins.JSONB, val => val)

// OID 114 = json, OID 3802 = jsonb (verificar que se parsean correctamente)
try {
  types.setTypeParser(114, val => val ? JSON.parse(val) : null)
  types.setTypeParser(3802, val => val ? JSON.parse(val) : null)
} catch (e) {
  // Si ya están configurados, ignorar
}

try {
  const u = new URL(databaseUrl)
  const safeInfo = {
    protocol: u.protocol.replace(':',''),
    host: u.hostname,
    port: u.port || '5432',
    database: (u.pathname || '').replace(/^\//, ''),
    user: u.username ? '[set]' : '[none]'
  }
  logger.db(`Conectando a ${safeInfo.protocol}://${safeInfo.host}:${safeInfo.port}/${safeInfo.database}`)
} catch (e) {
  logger.error('[pg] URL de base de datos inválida o no seteada')
}

const pool = new Pool({ connectionString: databaseUrl })

pool.on('connect', () => {
  logger.success('✓ Pool de conexión PostgreSQL conectado')
})

pool.on('error', (err) => {
  logger.error('[pg] Error en pool:', err.message)
})

module.exports = { pool }
