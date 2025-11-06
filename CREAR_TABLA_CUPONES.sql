-- =====================================================
-- SISTEMA DE CUPONES Y DESCUENTOS - VeciApp
-- =====================================================
-- Este script crea toda la estructura necesaria para el sistema de cupones

-- 1. Crear ENUM para tipo de beneficio del cupón
CREATE TYPE tipo_beneficio_cupon AS ENUM (
  'premium_gratis',          -- N días de plan Premium gratis
  'descuento_porcentaje',    -- X% de descuento en un emprendimiento
  'descuento_monto',         -- $X de descuento en un emprendimiento
  'descuento_producto',      -- Descuento en producto específico
  'envio_gratis',            -- Delivery gratis
  'producto_gratis'          -- Producto gratis al comprar
);

-- 2. Crear ENUM para tipo de usuario que puede usar el cupón
CREATE TYPE tipo_usuario_cupon AS ENUM (
  'emprendedor',
  'cliente',
  'ambos'
);

-- 3. Crear tabla de cupones
CREATE TABLE cupones (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_beneficio tipo_beneficio_cupon NOT NULL,
  tipo_usuario tipo_usuario_cupon NOT NULL DEFAULT 'ambos',
  
  -- Valor del beneficio (depende del tipo_beneficio)
  -- Para premium_gratis: días de premium
  -- Para descuento_porcentaje: porcentaje (ej: 20)
  -- Para descuento_monto: monto en pesos
  valor_beneficio INTEGER NOT NULL,
  
  -- Opcional: Emprendimiento específico (NULL = válido en todos)
  emprendimiento_id INTEGER REFERENCES emprendimientos(id) ON DELETE CASCADE,
  
  -- Opcional: Producto específico (NULL = válido en todos los productos)
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  
  -- Control de usos
  usos_maximos INTEGER DEFAULT NULL, -- NULL = ilimitado
  usos_actuales INTEGER DEFAULT 0,
  
  -- Un cupón puede tener límite de usos por usuario
  usos_por_usuario INTEGER DEFAULT 1, -- Máximo de veces que un usuario puede usar este cupón
  
  -- Fechas de validez
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_expiracion TIMESTAMP,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  
  -- Auditoría
  creado_por INTEGER REFERENCES usuarios(id), -- Admin que creó el cupón
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear tabla de cupones canjeados (historial)
CREATE TABLE cupones_usuarios (
  id SERIAL PRIMARY KEY,
  cupon_id INTEGER NOT NULL REFERENCES cupones(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Información del canje
  fecha_canje TIMESTAMP DEFAULT NOW(),
  fecha_expiracion_beneficio TIMESTAMP, -- Cuándo expira el beneficio recibido
  
  -- Para descuentos en compras, guardar la transacción donde se usó
  transaccion_id INTEGER REFERENCES transaccion_comercial(id) ON DELETE SET NULL,
  
  -- Estado del beneficio
  estado VARCHAR(20) DEFAULT 'activo', -- activo, usado, expirado, cancelado
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Un usuario no puede canjear el mismo cupón más veces del límite
  UNIQUE(cupon_id, usuario_id)
);

-- 5. Crear tabla de beneficios activos (para cupones de premium, etc.)
CREATE TABLE beneficios_activos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cupon_usuario_id INTEGER REFERENCES cupones_usuarios(id) ON DELETE CASCADE,
  
  tipo_beneficio tipo_beneficio_cupon NOT NULL,
  descripcion TEXT,
  
  -- Valor del beneficio
  valor INTEGER,
  
  -- Fechas
  fecha_inicio TIMESTAMP DEFAULT NOW(),
  fecha_expiracion TIMESTAMP,
  
  -- Estado
  activo BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Crear índices para optimizar consultas
CREATE INDEX idx_cupones_codigo ON cupones(codigo);
CREATE INDEX idx_cupones_activo ON cupones(activo);
CREATE INDEX idx_cupones_fecha_expiracion ON cupones(fecha_expiracion);
CREATE INDEX idx_cupones_usuarios_usuario ON cupones_usuarios(usuario_id);
CREATE INDEX idx_cupones_usuarios_cupon ON cupones_usuarios(cupon_id);
CREATE INDEX idx_cupones_usuarios_estado ON cupones_usuarios(estado);
CREATE INDEX idx_beneficios_activos_usuario ON beneficios_activos(usuario_id);
CREATE INDEX idx_beneficios_activos_activo ON beneficios_activos(activo);

-- 7. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at_cupones()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Crear triggers para actualizar updated_at
CREATE TRIGGER trigger_cupones_updated_at
  BEFORE UPDATE ON cupones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at_cupones();

CREATE TRIGGER trigger_cupones_usuarios_updated_at
  BEFORE UPDATE ON cupones_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at_cupones();

CREATE TRIGGER trigger_beneficios_activos_updated_at
  BEFORE UPDATE ON beneficios_activos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at_cupones();

-- =====================================================
-- CUPONES DE EJEMPLO PARA TESTING
-- =====================================================

-- Cupón: 1 mes de Premium gratis (solo emprendedores)
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, 
  usos_maximos, fecha_expiracion, activo
) VALUES (
  'PREMIUM30',
  '30 días de Plan Premium GRATIS 🚀',
  'premium_gratis',
  'emprendedor',
  30, -- 30 días
  100, -- 100 usos máximos
  NOW() + INTERVAL '90 days', -- Expira en 90 días
  true
);

-- Cupón: 20% descuento en todos los emprendimientos (ambos)
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, 
  usos_maximos, usos_por_usuario, fecha_expiracion, activo
) VALUES (
  'VECI20',
  '20% de descuento en tu próxima compra 🎉',
  'descuento_porcentaje',
  'ambos',
  20, -- 20%
  500,
  1, -- Solo 1 uso por usuario
  NOW() + INTERVAL '30 days',
  true
);

-- Cupón: $5000 de descuento (solo clientes)
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, 
  usos_maximos, usos_por_usuario, fecha_expiracion, activo
) VALUES (
  'BIENVENIDA5000',
  '$5.000 de descuento en tu primera compra 🎁',
  'descuento_monto',
  'cliente',
  5000, -- $5000
  200,
  1,
  NOW() + INTERVAL '60 days',
  true
);

-- Cupón: Envío gratis (ambos)
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, 
  usos_maximos, fecha_expiracion, activo
) VALUES (
  'ENVIOGRATIS',
  'Delivery GRATIS en tu próximo pedido 🚚',
  'envio_gratis',
  'ambos',
  1, -- 1 = gratis
  300,
  NOW() + INTERVAL '45 days',
  true
);

-- Cupón ilimitado de prueba (ambos, sin expiración)
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, 
  usos_maximos, usos_por_usuario, activo
) VALUES (
  'TEST10',
  '10% de descuento - Cupón de prueba',
  'descuento_porcentaje',
  'ambos',
  10,
  NULL, -- Usos ilimitados
  999, -- Cada usuario puede usarlo muchas veces
  true
);

-- =====================================================
-- CONSULTAS ÚTILES PARA ADMINISTRACIÓN
-- =====================================================

-- Ver todos los cupones activos
-- SELECT codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio, usos_actuales, usos_maximos, fecha_expiracion 
-- FROM cupones WHERE activo = true ORDER BY created_at DESC;

-- Ver historial de uso de un cupón específico
-- SELECT c.codigo, u.nombre, u.correo, cu.fecha_canje, cu.estado
-- FROM cupones_usuarios cu
-- JOIN cupones c ON cu.cupon_id = c.id
-- JOIN usuarios u ON cu.usuario_id = u.id
-- WHERE c.codigo = 'PREMIUM30'
-- ORDER BY cu.fecha_canje DESC;

-- Ver cupones activos de un usuario
-- SELECT c.codigo, c.descripcion, c.tipo_beneficio, cu.fecha_canje, cu.fecha_expiracion_beneficio, cu.estado
-- FROM cupones_usuarios cu
-- JOIN cupones c ON cu.cupon_id = c.id
-- WHERE cu.usuario_id = 4 AND cu.estado = 'activo'
-- ORDER BY cu.fecha_canje DESC;

-- Ver beneficios activos de un usuario
-- SELECT tipo_beneficio, descripcion, valor, fecha_inicio, fecha_expiracion
-- FROM beneficios_activos
-- WHERE usuario_id = 4 AND activo = true AND fecha_expiracion > NOW()
-- ORDER BY fecha_expiracion;

