# 🎫 Sistema de Cupones y Descuentos - VeciApp

## 📋 Descripción General

El sistema de cupones permite a los usuarios de VeciApp (tanto emprendedores como clientes) canjear códigos para obtener beneficios como descuentos, envío gratis, días de plan Premium gratuito, entre otros.

---

## 🏗️ Arquitectura del Sistema

### 1. Base de Datos

#### Tablas Principales:

**`cupones`** - Almacena todos los cupones disponibles
- `codigo`: Código único del cupón (ej: "PREMIUM30", "VECI20")
- `descripcion`: Descripción amigable del beneficio
- `tipo_beneficio`: Tipo de beneficio (ENUM)
- `tipo_usuario`: Quién puede usarlo (ENUM: emprendedor, cliente, ambos)
- `valor_beneficio`: Valor numérico del beneficio
- `emprendimiento_id`: (Opcional) Emprendimiento específico
- `producto_id`: (Opcional) Producto específico
- `usos_maximos`: Límite total de usos (NULL = ilimitado)
- `usos_actuales`: Contador de usos
- `usos_por_usuario`: Cuántas veces cada usuario puede usarlo
- `fecha_inicio` y `fecha_expiracion`: Período de validez

**`cupones_usuarios`** - Historial de cupones canjeados
- Relación cupón-usuario
- `fecha_canje`: Cuándo se canjeó
- `fecha_expiracion_beneficio`: Cuándo expira el beneficio
- `transaccion_id`: Si se usó en una compra
- `estado`: activo, usado, expirado, cancelado

**`beneficios_activos`** - Beneficios actualmente disponibles para el usuario
- Beneficios que el usuario puede usar en este momento
- Se crea automáticamente al canjear un cupón
- Se marca como `activo = false` al ser usado

#### Tipos de Beneficio (ENUM):

1. **`premium_gratis`**: N días de plan Premium (solo emprendedores)
2. **`descuento_porcentaje`**: X% de descuento
3. **`descuento_monto`**: $X de descuento fijo
4. **`descuento_producto`**: Descuento en producto específico
5. **`envio_gratis`**: Delivery sin costo
6. **`producto_gratis`**: Producto de regalo

---

## 🔌 Endpoints del Backend

### Rutas Públicas (requieren autenticación)

#### **POST /api/cupones/validar**
Valida si un cupón es válido para el usuario actual.

**Request:**
```json
{
  "codigo": "PREMIUM30"
}
```

**Response (válido):**
```json
{
  "ok": true,
  "valido": true,
  "mensaje": "Cupón válido",
  "cupon": {
    "id": 1,
    "codigo": "PREMIUM30",
    "descripcion": "30 días de Plan Premium GRATIS",
    "tipo_beneficio": "premium_gratis",
    "tipo_usuario": "emprendedor",
    "valor_beneficio": 30,
    "emprendimiento_id": null,
    "producto_id": null,
    "fecha_expiracion": "2025-02-05T00:00:00.000Z",
    "usos_disponibles": 95,
    "usos_usuario_restantes": 1
  }
}
```

**Response (no válido):**
```json
{
  "ok": false,
  "valido": false,
  "error": "Este cupón ha expirado",
  "validaciones": [
    "Este cupón ha expirado"
  ]
}
```

#### **POST /api/cupones/canjear**
Canjea un cupón válido y activa el beneficio para el usuario.

**Request:**
```json
{
  "codigo": "VECI20"
}
```

**Response:**
```json
{
  "ok": true,
  "mensaje": "¡Cupón canjeado exitosamente!",
  "canje": {
    "id": 15,
    "cupon_codigo": "VECI20",
    "descripcion": "20% de descuento en tu próxima compra",
    "tipo_beneficio": "descuento_porcentaje",
    "valor_beneficio": 20,
    "fecha_canje": "2025-11-05T20:30:00.000Z",
    "fecha_expiracion": "2025-12-05T00:00:00.000Z"
  }
}
```

#### **GET /api/cupones/mis-cupones**
Obtiene el historial de cupones canjeados por el usuario.

**Response:**
```json
{
  "ok": true,
  "cupones": [
    {
      "id": 15,
      "fecha_canje": "2025-11-05T20:30:00.000Z",
      "estado": "activo",
      "codigo": "VECI20",
      "descripcion": "20% de descuento en tu próxima compra",
      "tipo_beneficio": "descuento_porcentaje",
      "valor_beneficio": 20,
      "emprendimiento_nombre": null,
      "producto_nombre": null
    }
  ]
}
```

#### **GET /api/cupones/beneficios-activos**
Obtiene los beneficios activos y disponibles para usar.

**Response:**
```json
{
  "ok": true,
  "beneficios": [
    {
      "id": 8,
      "usuario_id": 4,
      "tipo_beneficio": "descuento_porcentaje",
      "descripcion": "20% de descuento en tu próxima compra",
      "valor": 20,
      "fecha_inicio": "2025-11-05T20:30:00.000Z",
      "fecha_expiracion": "2025-12-05T00:00:00.000Z",
      "activo": true,
      "codigo": "VECI20",
      "emprendimiento_id": null,
      "producto_id": null
    }
  ]
}
```

#### **POST /api/cupones/usar-beneficio**
Marca un beneficio como usado (se llama al confirmar un pedido).

**Request:**
```json
{
  "beneficio_id": 8,
  "transaccion_id": 32
}
```

---

## 🎨 Frontend - Pantallas

### **CuponesScreen.js**

Pantalla principal para gestionar cupones, con dos modos:

#### Modo Normal (desde Perfil):
- Formulario para ingresar y validar códigos
- Lista de beneficios activos
- Historial de cupones canjeados
- Botón para canjear cupones válidos

#### Modo Selección (desde Carrito):
- Solo muestra beneficios aplicables al emprendimiento actual
- Al seleccionar un cupón, lo aplica automáticamente
- Filtra cupones de Premium (no aplican para compras)

### **Integración en PedidoDetalleScreen.js**

En el modal de confirmación de entrega (segundo paso del carrito):
- Sección "🎫 Cupón de Descuento" antes del resumen
- Botón "Aplicar Cupón" que abre CuponesScreen en modo selección
- Muestra cupón aplicado con opción para removerlo
- Calcula automáticamente el descuento
- Muestra el descuento en el resumen del pedido

### **Integración en PerfilScreen.js**

Nueva opción "Mis Cupones" en accesos rápidos con icono de ticket.

---

## 💡 Lógica de Negocio

### Validaciones al Usar un Cupón:

1. ✅ El cupón debe existir
2. ✅ Debe estar activo (`activo = true`)
3. ✅ No debe haber expirado (`fecha_expiracion > NOW()`)
4. ✅ Debe haber alcanzado la fecha de inicio (`fecha_inicio <= NOW()`)
5. ✅ No debe haber excedido usos máximos totales
6. ✅ El tipo de usuario debe coincidir (emprendedor/cliente/ambos)
7. ✅ El usuario no debe haber excedido `usos_por_usuario`

### Cálculo de Descuentos:

#### **Descuento Porcentaje:**
```javascript
descuento = Math.round((subtotal * cupon.valor) / 100)
```

#### **Descuento Monto Fijo:**
```javascript
descuento = Math.min(cupon.valor, subtotal) // No mayor al subtotal
```

#### **Envío Gratis:**
```javascript
descuento = costoDelivery
```

#### **Total Final:**
```javascript
totalFinal = (subtotal + costoDelivery) - descuento
totalFinal = Math.max(0, totalFinal) // Nunca negativo
```

### Aplicabilidad de Cupones:

1. **Cupón General** (`emprendimiento_id = NULL`): Aplica a todos los emprendimientos
2. **Cupón de Emprendimiento** (`emprendimiento_id` específico): Solo ese emprendimiento
3. **Cupón de Producto** (`emprendimiento_id` + `producto_id`): Solo ese producto

### Ciclo de Vida del Cupón:

```
1. Usuario ingresa código
   ↓
2. Sistema VALIDA (sin canjear)
   ↓
3. Usuario confirma CANJEAR
   ↓
4. Se crea registro en cupones_usuarios (estado: activo)
   ↓
5. Se crea beneficio_activo
   ↓
6. Usuario aplica cupón en compra
   ↓
7. Se descuenta del total
   ↓
8. Al confirmar pedido, se marca beneficio como usado
   ↓
9. Se actualiza cupones_usuarios (estado: usado, transaccion_id)
```

---

## 🧪 Cupones de Prueba (Incluidos en el Script SQL)

| Código | Tipo | Beneficio | Tipo Usuario | Usos |
|--------|------|-----------|--------------|------|
| `PREMIUM30` | premium_gratis | 30 días Premium | emprendedor | 100 |
| `VECI20` | descuento_porcentaje | 20% descuento | ambos | 500 (1 por usuario) |
| `BIENVENIDA5000` | descuento_monto | $5.000 descuento | cliente | 200 (1 por usuario) |
| `ENVIOGRATIS` | envio_gratis | Delivery gratis | ambos | 300 |
| `TEST10` | descuento_porcentaje | 10% descuento | ambos | Ilimitado |

---

## 📱 Flujo de Usuario

### Escenario 1: Emprendedor Canjea Premium Gratis

1. Va a **Perfil → Mis Cupones**
2. Ingresa código: `PREMIUM30`
3. Sistema valida → Muestra: "30 días de Plan Premium GRATIS 🚀"
4. Presiona "Canjear Cupón"
5. **Beneficio activo por 30 días**
6. *(Nota: Implementación del beneficio Premium requiere lógica adicional en auth/suscripcion)*

### Escenario 2: Cliente Aplica Descuento en Compra

1. Agrega productos al carrito en un emprendimiento
2. Presiona FAB del carrito → Modal del carrito
3. Presiona "Siguiente" → Modal de confirmación de entrega
4. En sección "🎫 Cupón de Descuento", presiona "Aplicar Cupón"
5. Se abre **CuponesScreen en modo selección**
6. Selecciona beneficio disponible (ej: "20% descuento")
7. Vuelve al modal → Ve el descuento aplicado
8. Confirma pedido → Descuento se aplica al total
9. **Backend marca el beneficio como usado**

### Escenario 3: Cliente Canjea y Luego Usa

1. Va a **Perfil → Mis Cupones**
2. Ingresa código: `VECI20` (20% descuento)
3. Canjea → Beneficio queda activo
4. Hace una compra → Aplica el cupón
5. **Cupón se marca como usado** (no puede volver a usarlo)

---

## 🔒 Seguridad y Validaciones

### Prevención de Abuso:

1. **UNIQUE constraint** en `cupones_usuarios(cupon_id, usuario_id)` → Evita canjear dos veces
2. **Transacciones SQL** con `FOR UPDATE` → Evita race conditions
3. **Validación de tipo de usuario** → Cupones de Premium solo para emprendedores
4. **Límite de usos por usuario** → `usos_por_usuario`
5. **Límite de usos total** → `usos_maximos`
6. **Fechas de validez** → `fecha_inicio` y `fecha_expiracion`

### Restricciones de Aplicabilidad:

```javascript
// En CuponesScreen (modo selección):
const beneficiosAplicables = beneficiosActivos.filter(b => {
  // Premium no aplica para compras
  if (b.tipo_beneficio === 'premium_gratis') return false;
  
  // Si es específico de emprendimiento, debe coincidir
  if (b.emprendimiento_id && b.emprendimiento_id !== emprendimientoId) return false;
  
  return true;
});
```

---

## 📊 Administración (Rutas Admin)

### **GET /api/cupones/admin/todos**
Lista todos los cupones (solo admin).

### **POST /api/cupones/admin/crear**
Crea un nuevo cupón (solo admin).

**Request:**
```json
{
  "codigo": "VERANO2026",
  "descripcion": "Promoción de Verano - 25% OFF",
  "tipo_beneficio": "descuento_porcentaje",
  "tipo_usuario": "ambos",
  "valor_beneficio": 25,
  "emprendimiento_id": null,
  "producto_id": null,
  "usos_maximos": 1000,
  "usos_por_usuario": 1,
  "fecha_inicio": "2026-01-01",
  "fecha_expiracion": "2026-03-31"
}
```

### **PATCH /api/cupones/admin/:id**
Actualiza un cupón (solo admin).

### **DELETE /api/cupones/admin/:id**
Elimina un cupón (solo admin).

---

## 🎯 Casos de Uso Especiales

### Cupón de Emprendimiento Específico:

```sql
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio,
  emprendimiento_id, -- ✅ ID específico
  usos_maximos, fecha_expiracion
) VALUES (
  'PIZZA15',
  '15% descuento en Pizzería Michelle',
  'descuento_porcentaje',
  'ambos',
  15,
  3, -- Solo en emprendimiento ID 3
  200,
  NOW() + INTERVAL '60 days'
);
```

### Cupón de Producto Específico:

```sql
INSERT INTO cupones (
  codigo, descripcion, tipo_beneficio, tipo_usuario, valor_beneficio,
  emprendimiento_id,
  producto_id, -- ✅ Producto específico
  usos_maximos
) VALUES (
  'PIZZA2X1',
  'Pizza Napolitana 2x1',
  'descuento_porcentaje',
  'ambos',
  50, -- 50% = 2x1
  3,
  10, -- Solo producto ID 10
  50
);
```

---

## 🚀 Próximos Pasos (Mejoras Futuras)

### Implementación Completa de Premium Gratis:

Actualmente, el cupón se canjea y crea un beneficio activo, pero **falta integrar** con el sistema de suscripciones:

1. Modificar `/auth/suscripcion/estado` para verificar `beneficios_activos` con `tipo_beneficio = 'premium_gratis'`
2. Si hay beneficio activo de Premium, otorgar acceso Premium temporal
3. Al expirar el beneficio, volver al plan original

### Cupones Automáticos:

- Cupón de bienvenida automático al registrarse
- Cupón de cumpleaños
- Cupones basados en comportamiento (X compras = cupón de regalo)

### Analytics:

- Dashboard admin con estadísticas de uso de cupones
- Cupones más populares
- ROI de campañas promocionales

---

## 📝 Notas de Implementación

### ¿Por qué 3 tablas?

1. **`cupones`**: Catálogo maestro de todos los cupones (creados por admin)
2. **`cupones_usuarios`**: Relación many-to-many con historial completo
3. **`beneficios_activos`**: Cache de beneficios actualmente disponibles para queries rápidas

### Diferencia entre "Canjear" y "Usar":

- **Canjear**: El usuario ingresa el código y lo agrega a su cuenta (puede usarlo después)
- **Usar**: El usuario aplica un beneficio activo en una compra real

### Transacciones SQL:

Usamos `FOR UPDATE` al canjear para prevenir que dos usuarios canjeen simultáneamente el último uso disponible:

```javascript
await client.query('SELECT * FROM cupones WHERE codigo = $1 FOR UPDATE', [codigo])
```

---

## 🧪 Testing

### 1. Ejecutar Script SQL:
```bash
psql -h localhost -p 5432 -U rodrigoalonsocarvallogonzalez -d veciapp_dev -f CREAR_TABLA_CUPONES.sql
```

### 2. Probar desde la App:

**Como Emprendedor:**
1. Login → Perfil → Mis Cupones
2. Ingresar: `PREMIUM30`
3. Validar → Canjear
4. Verificar que aparece en "Beneficios Activos"

**Como Cliente:**
1. Login → Perfil → Mis Cupones
2. Ingresar: `VECI20` (20% descuento)
3. Canjear
4. Ir a un emprendimiento → Agregar productos
5. Carrito → Siguiente → Aplicar Cupón
6. Seleccionar cupón VECI20
7. Verificar que el descuento se aplica correctamente
8. Confirmar pedido
9. Verificar que el cupón se marca como "Usado"

---

## ⚠️ Limitaciones Actuales

1. **Premium Gratis**: Se canjea pero no se activa automáticamente (requiere integración adicional)
2. **Cupones de Producto Específico**: Se validan, pero la lógica de descuento en productos específicos dentro del carrito requiere desarrollo adicional
3. **Notificaciones**: No se envían notificaciones cuando un cupón está por expirar

---

## 📞 Soporte

Para crear cupones personalizados, contactar al administrador del sistema o usar las rutas `/api/cupones/admin/*` con permisos de administrador.

---

**Desarrollado por:** Sistema VeciApp  
**Fecha:** Noviembre 2025  
**Versión:** 1.0

