require('dotenv').config()

const requiredVars = ['DATABASE_URL', 'PORT']
for (const v of requiredVars) {
  if (!process.env[v]) {
    console.warn(`[env] Falta variable: ${v}`)
  }
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  serverIp: process.env.SERVER_IP || 'localhost',
}
