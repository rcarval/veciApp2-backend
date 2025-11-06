-- =====================================================
-- Script para garantizar que no haya correos duplicados
-- Agrega restricción UNIQUE a nivel de base de datos
-- =====================================================

-- 1. Verificar si hay correos duplicados actualmente
SELECT 
  LOWER(correo) as correo_lower,
  COUNT(*) as cantidad,
  STRING_AGG(id::TEXT, ', ') as ids_afectados,
  STRING_AGG(tipo_usuario, ', ') as tipos
FROM usuarios
GROUP BY LOWER(correo)
HAVING COUNT(*) > 1;

-- NOTA: Si el query anterior muestra resultados, hay correos duplicados que deben resolverse manualmente

-- 2. Crear índice UNIQUE para correos (case-insensitive)
-- Esto garantiza que no se puedan crear usuarios con el mismo correo
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo_unique 
ON usuarios (LOWER(correo));

-- 3. Verificar que el índice se creó correctamente
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'usuarios' 
AND indexname = 'idx_usuarios_correo_unique';

-- 4. Información del resultado
SELECT 'Restricción UNIQUE agregada correctamente. Ahora es imposible tener correos duplicados en la base de datos.' as resultado;

-- =====================================================
-- IMPORTANTE:
-- =====================================================
-- Si al ejecutar este script obtienes un error como:
-- "could not create unique index"
-- 
-- Significa que YA EXISTEN correos duplicados en tu base de datos.
-- 
-- Para resolverlo:
-- 1. Ejecuta el primer SELECT para ver los duplicados
-- 2. Decide qué registros mantener
-- 3. Elimina o actualiza los duplicados manualmente
-- 4. Vuelve a ejecutar el CREATE UNIQUE INDEX
-- =====================================================

