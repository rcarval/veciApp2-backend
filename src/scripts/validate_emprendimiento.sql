-- Script para validar emprendimientos creados
SELECT 
  e.id as "ID",
  e.nombre as "Nombre Emprendimiento",
  e.descripcion_corta as "Descripción Corta",
  e.estado as "Estado",
  e.categoria_principal as "Categoría",
  jsonb_array_length(e.subcategorias) as "Num Subcategorías",
  e.direccion as "Dirección",
  c.nombre as "Comuna",
  u.nombre as "Usuario",
  CASE 
    WHEN e.logo_url IS NOT NULL THEN 'Sí ✓'
    ELSE 'No ✗'
  END as "Logo",
  CASE 
    WHEN e.background_url IS NOT NULL THEN 'Sí ✓'
    ELSE 'No ✗'
  END as "Background",
  jsonb_object_keys(e.horarios) as "Días con Horario",
  e.fecha_creacion as "Creado"
FROM emprendimientos e
LEFT JOIN comunas c ON e.comuna_id = c.id
LEFT JOIN usuarios u ON e.usuario_id = u.id
ORDER BY e.fecha_creacion DESC;

-- Ver detalles completos de un emprendimiento específico
-- Descomenta y reemplaza el ID:
-- SELECT e.* FROM emprendimientos e WHERE e.id = 1;

