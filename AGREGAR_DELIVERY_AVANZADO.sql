-- =====================================================
-- MIGRACIÓN: Sistema Avanzado de Delivery
-- Fecha: 2025-01-09
-- Descripción: Agregar columnas para comunas de cobertura
--              y modalidades avanzadas de delivery
-- =====================================================

-- 1. Agregar columna de comunas de cobertura (array de strings)
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS comunas_cobertura JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna de modalidad de delivery
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS modalidad_delivery VARCHAR(50) DEFAULT NULL;

-- 3. Agregar columna de configuración de delivery (JSON)
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS config_delivery JSONB DEFAULT '{}'::jsonb;

-- Comentarios para documentación
COMMENT ON COLUMN emprendimientos.comunas_cobertura IS 'Array de nombres de comunas donde se hace delivery. Ejemplo: ["Santiago", "Providencia"]';
COMMENT ON COLUMN emprendimientos.modalidad_delivery IS 'Modalidad de cobro: gratis, gratis_desde, por_distancia, fijo';
COMMENT ON COLUMN emprendimientos.config_delivery IS 'Configuración según modalidad. Ej: {"montoMinimo": 10000} o {"rango1_km": 1, "rango1_costo": 1000, ...}';

-- Índices para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_emprendimientos_modalidad_delivery 
ON emprendimientos(modalidad_delivery);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ver las columnas agregadas:
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'emprendimientos' 
  AND column_name IN ('comunas_cobertura', 'modalidad_delivery', 'config_delivery')
ORDER BY column_name;

-- Ver un emprendimiento con los nuevos campos:
SELECT 
  id, 
  nombre, 
  comunas_cobertura, 
  modalidad_delivery, 
  config_delivery 
FROM emprendimientos 
LIMIT 1;

