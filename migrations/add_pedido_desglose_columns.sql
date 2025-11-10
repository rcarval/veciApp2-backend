-- Agregar columnas para desglose detallado de pedidos
-- Fecha: 2025-11-10
-- Descripción: Agregar campos para costo_delivery, cupon_codigo, descuento_cupon y subtotal

-- Verificar si las columnas ya existen antes de agregarlas
DO $$ 
BEGIN
    -- Agregar costo_delivery si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transaccion_comercial' 
                   AND column_name = 'costo_delivery') THEN
        ALTER TABLE transaccion_comercial 
        ADD COLUMN costo_delivery INTEGER DEFAULT 0;
        RAISE NOTICE 'Columna costo_delivery agregada';
    END IF;

    -- Agregar cupon_codigo si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transaccion_comercial' 
                   AND column_name = 'cupon_codigo') THEN
        ALTER TABLE transaccion_comercial 
        ADD COLUMN cupon_codigo VARCHAR(50) DEFAULT NULL;
        RAISE NOTICE 'Columna cupon_codigo agregada';
    END IF;

    -- Agregar descuento_cupon si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transaccion_comercial' 
                   AND column_name = 'descuento_cupon') THEN
        ALTER TABLE transaccion_comercial 
        ADD COLUMN descuento_cupon INTEGER DEFAULT 0;
        RAISE NOTICE 'Columna descuento_cupon agregada';
    END IF;

    -- Agregar subtotal si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transaccion_comercial' 
                   AND column_name = 'subtotal') THEN
        ALTER TABLE transaccion_comercial 
        ADD COLUMN subtotal INTEGER DEFAULT 0;
        RAISE NOTICE 'Columna subtotal agregada';
    END IF;

    RAISE NOTICE 'Todas las columnas de desglose han sido verificadas/agregadas';
END $$;

-- Crear índice para buscar pedidos por cupón (útil para estadísticas)
CREATE INDEX IF NOT EXISTS idx_transaccion_comercial_cupon_codigo 
ON transaccion_comercial(cupon_codigo) 
WHERE cupon_codigo IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN transaccion_comercial.costo_delivery IS 'Costo del delivery en pesos chilenos (0 si es gratis o retiro)';
COMMENT ON COLUMN transaccion_comercial.cupon_codigo IS 'Código del cupón aplicado (null si no se aplicó cupón)';
COMMENT ON COLUMN transaccion_comercial.descuento_cupon IS 'Monto del descuento aplicado por el cupón en pesos chilenos';
COMMENT ON COLUMN transaccion_comercial.subtotal IS 'Subtotal de productos antes de delivery y descuentos';

