-- Script para crear tabla de reportes de emprendimientos

-- 1. Crear tipo ENUM para estados de reporte
DO $$ BEGIN
  CREATE TYPE reporte_estado AS ENUM ('pendiente', 'revisado', 'aceptado', 'rechazado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Crear tipo ENUM para categorías de reporte
DO $$ BEGIN
  CREATE TYPE reporte_categoria AS ENUM (
    'contenido_inapropiado',
    'informacion_falsa',
    'productos_prohibidos',
    'suplantacion_identidad',
    'practicas_fraudulentas',
    'spam',
    'problemas_vendedor',
    'otro'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Crear tabla de reportes
CREATE TABLE IF NOT EXISTS reportes_emprendimientos (
  id SERIAL PRIMARY KEY,
  emprendimiento_id INTEGER NOT NULL REFERENCES emprendimientos(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria reporte_categoria NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  descripcion_detallada TEXT, -- Opcional: para cuando selecciona "Otro"
  estado reporte_estado DEFAULT 'pendiente',
  respuesta_admin TEXT, -- Respuesta del administrador
  admin_revisor_id BIGINT REFERENCES usuarios(id), -- Admin que revisó
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  revisado_at TIMESTAMP,
  
  -- Índices para mejorar performance
  CONSTRAINT reporte_unico UNIQUE (emprendimiento_id, usuario_id, categoria, created_at)
);

-- 4. Crear índices
CREATE INDEX IF NOT EXISTS idx_reportes_emprendimiento ON reportes_emprendimientos(emprendimiento_id);
CREATE INDEX IF NOT EXISTS idx_reportes_usuario ON reportes_emprendimientos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes_emprendimientos(estado);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes_emprendimientos(created_at DESC);

-- 5. Comentarios para documentación
COMMENT ON TABLE reportes_emprendimientos IS 'Almacena los reportes realizados por usuarios sobre emprendimientos';
COMMENT ON COLUMN reportes_emprendimientos.categoria IS 'Categoría del reporte según motivos predefinidos';
COMMENT ON COLUMN reportes_emprendimientos.estado IS 'Estado del reporte: pendiente, revisado, aceptado, rechazado';
COMMENT ON COLUMN reportes_emprendimientos.descripcion_detallada IS 'Descripción adicional cuando la categoría es "otro"';

