# Sistema de Vigencias y Productos

## 📋 Resumen

El sistema de planes de VeciApp tiene dos niveles:
- **Plan Básico**: Gratuito, no permite agregar productos
- **Plan Premium**: $4.990/mes, permite hasta **30 productos por emprendimiento**

## 🔄 Funcionamiento de Vigencias

### Cuando Expira un Plan Premium

Cuando un usuario con Plan Premium alcanza la fecha de `vigencia_hasta`, el sistema:

1. **Cambia automáticamente al Plan Básico**
   - `plan_id` = `NULL`
   - `estado_suscripcion` = `NULL`
   - `vigencia_hasta` = `NULL`

2. **Desactiva TODOS sus productos** (no los elimina)
   - Los productos quedan con `activo = false`
   - Los productos permanecen en la base de datos
   - Pueden reactivarse si el usuario vuelve a Premium

### Verificación Automática

La verificación de vigencias se ejecuta:

1. **En cada login/consulta de estado**: Endpoint `GET /api/auth/suscripcion/estado`
2. **Manualmente por admin**: Endpoint `POST /api/admin/verificar-vigencias`
3. **Mediante script**: `node src/scripts/verificar_vigencias.js`

## 🛠️ Configuración de Cron Job (Opcional)

Para ejecutar la verificación automáticamente cada día a las 00:00:

```bash
# Abrir crontab
crontab -e

# Agregar esta línea (ajustar la ruta según tu instalación)
0 0 * * * cd /ruta/a/veciApp2-backend && node src/scripts/verificar_vigencias.js >> logs/vigencias.log 2>&1
```

## 📦 Límites de Productos

| Plan | Emprendimientos | Productos por Emprendimiento |
|------|----------------|------------------------------|
| Básico | 1 | 0 (no permite productos) |
| Premium | 3 | 30 por emprendimiento |

### Validación en Creación de Productos

El endpoint `POST /api/emprendimientos/:id/productos` verifica:

1. **Plan del usuario**:
   - Debe tener `plan_id = 2` (Premium)
   - Debe tener `vigencia_hasta` vigente (fecha futura)

2. **Límite de productos**:
   - Cuenta productos existentes del emprendimiento
   - Rechaza si ya tiene 30 productos (Premium)
   - Rechaza si no tiene plan Premium

## 🔍 Endpoints de Administración

### Verificar Vigencias Manualmente
```
POST /api/admin/verificar-vigencias
Authorization: Bearer <token_admin>
```

**Respuesta**:
```json
{
  "ok": true,
  "mensaje": "Verificación de vigencias completada exitosamente"
}
```

### Obtener Estadísticas de Planes
```
GET /api/admin/estadisticas-planes
Authorization: Bearer <token_admin>
```

**Respuesta**:
```json
{
  "ok": true,
  "estadisticas": {
    "planes": [
      { "plan_id": 2, "total": 15, "activas": 12, "expiradas": 3 }
    ],
    "productos": {
      "total": 234,
      "activos": 180,
      "inactivos": 54
    },
    "proximos_a_vencer": [
      {
        "id": 123,
        "email": "usuario@example.com",
        "vigencia_hasta": "2025-11-10T12:00:00.000Z"
      }
    ]
  }
}
```

## 🔧 Ejecución Manual del Script

```bash
# Desde la raíz del backend
cd veciApp2-backend

# Ejecutar verificación
node src/scripts/verificar_vigencias.js
```

**Salida esperada**:
```
🔄 Iniciando verificación de vigencias de suscripciones...
⚠️  Encontrados 2 usuarios con suscripción expirada
✓ Usuario user@example.com (ID: 45): Plan cambiado a Básico, 12 productos desactivados
✓ Usuario otro@example.com (ID: 67): Plan cambiado a Básico, 8 productos desactivados

📊 Resumen de verificación:
   - Usuarios actualizados: 2
   - Productos desactivados: 20
   - Fecha: 04/11/2025, 10:30:15
```

## 💡 Recomendaciones

1. **Configurar cron job** para ejecutar la verificación diariamente
2. **Monitorear logs** para detectar problemas
3. **Notificar usuarios** antes de que expire su plan (implementación futura)
4. **Backup regular** de la base de datos antes de ejecutar scripts masivos

## 🚨 Consideraciones Importantes

- Los productos desactivados **NO se eliminan**, solo cambian `activo = false`
- Los usuarios pueden ver sus productos inactivos en su panel
- Al renovar Premium, los productos NO se reactivan automáticamente (deben hacerlo manualmente)
- Las imágenes de productos inactivos se mantienen en el servidor




