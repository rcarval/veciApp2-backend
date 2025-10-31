const { pool } = require('../db/pool')
const bcrypt = require('bcrypt')

async function main() {
  const correo = 'admin@veciapp.dev'
  const contrasena = 'demo1234'
  const hash = await bcrypt.hash(contrasena, 10)
  const sql = `
    INSERT INTO usuarios (nombre, correo, contrasena, tipo_usuario, estado, email_verificado)
    VALUES ('Admin Demo', $1, $2, 'admin', 'activo', true)
    ON CONFLICT (correo)
    DO UPDATE SET contrasena = EXCLUDED.contrasena,
                  nombre = 'Admin Demo',
                  tipo_usuario = 'admin',
                  estado = 'activo',
                  email_verificado = true;
  `
  await pool.query(sql, [correo, hash])
  console.log('Usuario demo upsert:', correo)
  await pool.end()
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
