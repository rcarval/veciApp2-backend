-- Script para agregar soporte de vendedores
-- Agregar columna emprendimiento_asignado_id a usuarios si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS emprendimiento_asignado_id INTEGER REFERENCES emprendimientos(id) ON DELETE CASCADE;

-- Crear índice para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_usuarios_emprendimiento_asignado 
ON usuarios(emprendimiento_asignado_id) WHERE emprendimiento_asignado_id IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN usuarios.emprendimiento_asignado_id IS 'ID del emprendimiento asignado para usuarios vendedores';
