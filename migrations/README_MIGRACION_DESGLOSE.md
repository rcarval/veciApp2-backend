# Migración: Desglose de Pedidos

## 📋 Descripción
Esta migración agrega columnas necesarias para el desglose detallado de pedidos, incluyendo:
- Precios de oferta en productos
- Costo de delivery
- Cupones aplicados y descuentos
- Subtotal de productos

## 🗄️ Columnas Agregadas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `costo_delivery` | INTEGER | Costo del delivery (0 si es gratis o retiro) |
| `cupon_codigo` | VARCHAR(50) | Código del cupón aplicado (NULL si no hay) |
| `descuento_cupon` | INTEGER | Monto del descuento en pesos |
| `subtotal` | INTEGER | Subtotal de productos antes de delivery y descuentos |

## 🚀 Cómo Ejecutar

### Opción 1: Desde terminal (psql)

```bash
# Asegúrate de estar en el directorio del backend
cd veciApp2-backend

# Ejecutar migración (reemplaza <database_name> con el nombre de tu BD)
psql -U postgres -d <database_name> -f migrations/add_pedido_desglose_columns.sql
```

### Opción 2: Desde cliente PostgreSQL (pgAdmin, DBeaver, etc.)

1. Abre el archivo `add_pedido_desglose_columns.sql`
2. Copia todo el contenido
3. Ejecuta el script en tu cliente SQL

### Opción 3: Desde node

```javascript
const { pool } = require('./src/db/pool');
const fs = require('fs');

const runMigration = async () => {
  const sql = fs.readFileSync('./migrations/add_pedido_desglose_columns.sql', 'utf8');
  await pool.query(sql);
  console.log('✅ Migración ejecutada');
};

runMigration();
```

## ✅ Verificar que se ejecutó correctamente

```sql
-- Ver las nuevas columnas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'transaccion_comercial'
AND column_name IN ('costo_delivery', 'cupon_codigo', 'descuento_cupon', 'subtotal');
```

Deberías ver 4 columnas listadas.

## 🔄 Retrocompatibilidad

La migración es **100% retrocompatible**:
- Todas las columnas tienen valores DEFAULT
- Pedidos antiguos seguirán funcionando
- No se pierden datos existentes
- Los nuevos pedidos usarán las nuevas columnas

## 📊 Ejemplo de Pedido Completo

```json
{
  "total": 9000,
  "subtotal": 10000,
  "costo_delivery": 1000,
  "cupon_codigo": "VERANO",
  "descuento_cupon": 2000,
  "detalle": [
    {
      "producto_id": 1,
      "nombre": "Hamburguesa",
      "cantidad": 2,
      "precio_unitario": 5000,
      "precio_oferta": 3990,
      "precio_final": 3990,
      "subtotal": 7980
    },
    {
      "producto_id": 2,
      "nombre": "Papas",
      "cantidad": 1,
      "precio_unitario": 2020,
      "precio_oferta": null,
      "precio_final": 2020,
      "subtotal": 2020
    }
  ]
}
```

## ⚠️ Importante

**DEBES ejecutar esta migración** antes de crear nuevos pedidos, de lo contrario el backend dará error al intentar insertar en columnas que no existen.

## 🐛 Solución de Problemas

### Error: "column costo_delivery does not exist"
- **Causa**: La migración no se ha ejecutado
- **Solución**: Ejecuta el archivo SQL siguiendo las opciones anteriores

### Error: "relation transaccion_comercial does not exist"
- **Causa**: La tabla base no existe
- **Solución**: Ejecuta primero las migraciones base de creación de tablas

