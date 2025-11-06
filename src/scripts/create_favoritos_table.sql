-- Script para crear la tabla de favoritos
-- Este script permite a los usuarios marcar emprendimientos como favoritos

-- Crear tabla de favoritos si no existe
CREATE TABLE IF NOT EXISTS favoritos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emprendimiento_id INTEGER NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Asegurar que un usuario no pueda marcar el mismo emprendimiento como favorito más de una vez
  UNIQUE(usuario_id, emprendimiento_id)
);

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON favoritos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_emprendimiento ON favoritos(emprendimiento_id);

-- Comentarios para documentación
COMMENT ON TABLE favoritos IS 'Tabla que almacena los emprendimientos favoritos de cada usuario';
COMMENT ON COLUMN favoritos.usuario_id IS 'ID del usuario que marca el favorito';
COMMENT ON COLUMN favoritos.emprendimiento_id IS 'ID del emprendimiento marcado como favorito';







