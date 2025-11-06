const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'mi_jwt_supersecreto'

module.exports = function auth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token no provisto' })
  }
  const token = parts[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.auth = payload
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}







