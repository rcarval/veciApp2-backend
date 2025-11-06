-- Script para crear tablas de categorías y subcategorías
-- Permite gestionar categorías de emprendimientos de forma dinámica

-- Crear tabla de categorías principales
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL, -- Código único: 'comida', 'servicios', etc.
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(50), -- Nombre del icono de Ionicons
  color VARCHAR(7), -- Color hexadecimal
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de subcategorías
CREATE TABLE IF NOT EXISTS subcategorias (
  id SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL, -- Código único dentro de la categoría
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  icono VARCHAR(50),
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Asegurar que el código sea único dentro de cada categoría
  UNIQUE(categoria_id, codigo)
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_categorias_activo ON categorias(activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_categorias_orden ON categorias(orden);
CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_activo ON subcategorias(activo) WHERE activo = true;

-- Comentarios para documentación
COMMENT ON TABLE categorias IS 'Categorías principales de emprendimientos';
COMMENT ON TABLE subcategorias IS 'Subcategorías asociadas a cada categoría principal';
COMMENT ON COLUMN categorias.codigo IS 'Código único para identificar la categoría (usado en queries)';
COMMENT ON COLUMN categorias.orden IS 'Orden de visualización (menor número = primero)';
COMMENT ON COLUMN subcategorias.codigo IS 'Código único dentro de la categoría';

-- Insertar categorías iniciales
INSERT INTO categorias (codigo, nombre, descripcion, icono, color, orden) VALUES
('comida', 'Comida Preparada', 'Restaurantes, comida rápida y preparaciones', 'restaurant', '#FF6B6B', 1),
('servicios', 'Servicios Locales', 'Servicios profesionales y técnicos', 'construct', '#4ECDC4', 2),
('negocios', 'Tiendas & Negocios', 'Comercio local y retail', 'storefront', '#95E1D3', 3),
('belleza', 'Belleza & Bienestar', 'Salones, spa y estética', 'cut', '#F38181', 4)
ON CONFLICT (codigo) DO NOTHING;

-- Insertar subcategorías para Comida Preparada
INSERT INTO subcategorias (categoria_id, codigo, nombre, orden) VALUES
((SELECT id FROM categorias WHERE codigo = 'comida'), 'sushi', 'Sushi', 1),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'pizza', 'Pizza', 2),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'hamburguesas', 'Hamburguesas', 3),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'sandwiches', 'Sandwiches', 4),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'comida_casera', 'Comida Casera', 5),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'comida_peruana', 'Comida Peruana', 6),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'comida_china', 'Comida China', 7),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'comida_oriental', 'Comida Oriental', 8),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'pasteleria', 'Pastelería', 9),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'vegetariano', 'Vegetariano/Vegano', 10),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'comida_rapida', 'Comida Rápida', 11),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'mariscos', 'Mariscos', 12),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'carnes', 'Carnes', 13),
((SELECT id FROM categorias WHERE codigo = 'comida'), 'otro', 'Otro', 99)
ON CONFLICT (categoria_id, codigo) DO NOTHING;

-- Insertar subcategorías para Servicios Locales
INSERT INTO subcategorias (categoria_id, codigo, nombre, orden) VALUES
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'construccion', 'Construcción', 1),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'pintura', 'Pintura', 2),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'gasfiteria', 'Gasfitería', 3),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'electricidad', 'Electricidad', 4),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'computadores', 'Computadores', 5),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'jardineria', 'Jardinería', 6),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'mudanzas', 'Mudanzas', 7),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'limpieza', 'Limpieza', 8),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'reparaciones', 'Reparaciones', 9),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'diseño', 'Diseño', 10),
((SELECT id FROM categorias WHERE codigo = 'servicios'), 'otro', 'Otro', 99)
ON CONFLICT (categoria_id, codigo) DO NOTHING;

-- Insertar subcategorías para Tiendas & Negocios
INSERT INTO subcategorias (categoria_id, codigo, nombre, orden) VALUES
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'almacen', 'Almacén', 1),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'panaderia', 'Panadería', 2),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'verduleria', 'Verdulería', 3),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'carniceria', 'Carnicería', 4),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'pescaderia', 'Pescadería', 5),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'minimarket', 'Minimarket', 6),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'licoreria', 'Licorería', 7),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'ferreteria', 'Ferretería', 8),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'floreria', 'Florería', 9),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'libreria', 'Librería', 10),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'mascotas', 'Mascotas', 11),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'bazar', 'Bazar', 12),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'ropa_bebe', 'Ropa de Bebe', 13),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'vestimenta', 'Vestimenta', 14),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'zapateria', 'Zapatería', 15),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'orfebreria', 'Orfebrería', 16),
((SELECT id FROM categorias WHERE codigo = 'negocios'), 'otro', 'Otro', 99)
ON CONFLICT (categoria_id, codigo) DO NOTHING;

-- Insertar subcategorías para Belleza & Bienestar
INSERT INTO subcategorias (categoria_id, codigo, nombre, orden) VALUES
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'spa', 'Spa', 1),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'manicure', 'Manicure', 2),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'peluqueria', 'Peluquería', 3),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'barberia', 'Barbería', 4),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'estetica', 'Estética', 5),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'maquillaje', 'Maquillaje', 6),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'depilacion', 'Depilación', 7),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'tatuajes', 'Tatuajes', 8),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'masajes', 'Masajes', 9),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'peluqueria_canina', 'Peluquería Canina', 10),
((SELECT id FROM categorias WHERE codigo = 'belleza'), 'otro', 'Otro', 99)
ON CONFLICT (categoria_id, codigo) DO NOTHING;

-- Ver resultado
SELECT 
  c.nombre as categoria,
  COUNT(s.id) as num_subcategorias
FROM categorias c
LEFT JOIN subcategorias s ON c.id = s.categoria_id
GROUP BY c.id, c.nombre
ORDER BY c.orden;






