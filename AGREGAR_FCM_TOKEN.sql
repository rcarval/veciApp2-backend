-- =====================================================
-- Script para agregar soporte de notificaciones push
-- =====================================================

-- 1. Agregar columna para almacenar el FCM token
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS fcm_token_actualizado_at TIMESTAMP;

-- 2. Crear índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_usuarios_fcm_token ON usuarios(fcm_token);

-- 3. Crear tabla para historial de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(50), -- 'pedido_nuevo', 'pedido_confirmado', 'pedido_rechazado', etc.
  data JSONB, -- Datos adicionales (pedido_id, emprendimiento_id, etc.)
  enviada BOOLEAN DEFAULT FALSE,
  leida BOOLEAN DEFAULT FALSE,
  fecha_envio TIMESTAMP,
  fecha_lectura TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear índices para la tabla de notificaciones
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON notificaciones(created_at DESC);

-- 5. Comentarios
COMMENT ON COLUMN usuarios.fcm_token IS 'Token de Firebase Cloud Messaging para notificaciones push';
COMMENT ON COLUMN usuarios.fcm_token_actualizado_at IS 'Última actualización del FCM token';
COMMENT ON TABLE notificaciones IS 'Historial de notificaciones enviadas a los usuarios';

-- 6. Verificar cambios
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND column_name LIKE '%fcm%';

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'notificaciones';

SELECT 
  COUNT(*) as total_usuarios,
  COUNT(fcm_token) as usuarios_con_token,
  COUNT(fcm_token)::FLOAT / NULLIF(COUNT(*), 0) * 100 as porcentaje_con_token
FROM usuarios;

