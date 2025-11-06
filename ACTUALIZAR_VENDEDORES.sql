-- =====================================================
-- Script para agregar sistema de activación por email
-- para cuentas de vendedor
-- =====================================================

-- 1. Agregar columnas para token de activación
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS token_activacion VARCHAR(64),
ADD COLUMN IF NOT EXISTS token_activacion_expira TIMESTAMP;

-- 2. Crear índice para búsqueda rápida por token
CREATE INDEX IF NOT EXISTS idx_usuarios_token_activacion 
ON usuarios(token_activacion) 
WHERE token_activacion IS NOT NULL;

-- 3. Crear índice UNIQUE para correos (garantiza que no haya duplicados)
-- IMPORTANTE: Si esto falla, significa que ya hay correos duplicados
-- Ejecuta primero: SELECT LOWER(correo), COUNT(*) FROM usuarios GROUP BY LOWER(correo) HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo_unique 
ON usuarios (LOWER(correo));

-- 4. Agregar nuevo estado 'pendiente_activacion' al enum (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pendiente_activacion' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'usuario_estado')
    ) THEN
        ALTER TYPE usuario_estado ADD VALUE 'pendiente_activacion';
    END IF;
END$$;

-- 5. Información del script
SELECT 'Script ejecutado correctamente. Campos y restricciones agregadas a tabla usuarios.' as resultado;

-- 6. Verificar que las columnas se crearon
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
AND column_name IN ('token_activacion', 'token_activacion_expira');

-- 7. Verificar que el índice UNIQUE se creó
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'usuarios' 
AND indexname = 'idx_usuarios_correo_unique';

