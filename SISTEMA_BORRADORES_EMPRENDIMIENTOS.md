# 📝 Sistema de Borradores y Verificación de Emprendimientos

## 🎯 Objetivo

Implementar un sistema que permita verificar nuevos emprendimientos y cambios a emprendimientos existentes sin interrumpir las ventas activas.

---

## 🔄 Flujos de Trabajo

### **Flujo 1: Crear Nuevo Emprendimiento**

```
Usuario crea emprendimiento
         ↓
Estado: VERIFICACIÓN (visible en listado del emprendedor)
         ↓
Botón "Completar Verificación" → Modal SMS
         ↓
Código verificado exitosamente
         ↓
Estado: PENDIENTE (esperando aprobación admin)
         ↓
Admin aprueba
         ↓
Estado: INACTIVO (emprendedor puede activar/desactivar)
         ↓
Emprendedor activa
         ↓
Estado: ACTIVO (visible públicamente)
```

### **Flujo 2: Editar Emprendimiento Existente**

```
Usuario edita emprendimiento ACTIVO
         ↓
Se crea BORRADOR (copia con cambios)
         ↓
Original: ACTIVO (sigue visible y vendiendo)
Borrador: VERIFICACIÓN (solo visible para emprendedor)
         ↓
Botón "Verificar Cambios" → Modal SMS
         ↓
Código verificado exitosamente
         ↓
Borrador → Datos copiados al original
Estado original: PENDIENTE
Borrador: ELIMINADO
         ↓
Admin aprueba
         ↓
Estado original: INACTIVO (con nuevos datos)
         ↓
Emprendedor activa
         ↓
Estado: ACTIVO (cambios visibles públicamente)
```

---

## 🗄️ Estructura de Base de Datos

### Columnas Agregadas a `emprendimientos`

```sql
-- Sistema de borradores
es_borrador BOOLEAN DEFAULT FALSE
emprendimiento_original_id INTEGER REFERENCES emprendimientos(id) ON DELETE CASCADE

-- Sistema de verificación
codigo_verificacion VARCHAR(6)
codigo_enviado_at TIMESTAMP
verificado_at TIMESTAMP

-- Sistema de aprobación
fecha_aprobacion TIMESTAMP
fecha_rechazo TIMESTAMP
motivo_rechazo TEXT
```

### Índices Creados

```sql
CREATE INDEX idx_emprendimientos_original_id ON emprendimientos(emprendimiento_original_id);
CREATE INDEX idx_emprendimientos_borrador ON emprendimientos(es_borrador);
CREATE INDEX idx_emprendimientos_estado ON emprendimientos(estado);
```

---

## 📊 Estados del Emprendimiento

| Estado | Descripción | Visible Públicamente | Puede Editar | Puede Vender |
|--------|-------------|---------------------|--------------|--------------|
| **verificacion** | Esperando código SMS | ❌ No | ❌ No | ❌ No |
| **pendiente** | Verificado, esperando aprobación admin | ❌ No | ❌ No | ❌ No |
| **inactivo** | Aprobado pero desactivado por emprendedor | ❌ No | ✅ Sí | ❌ No |
| **activo** | Aprobado y activado por emprendedor | ✅ Sí | ✅ Sí | ✅ Sí |
| **rechazado** | Rechazado por admin | ❌ No | ❌ No | ❌ No |

---

## 🌐 API Endpoints

### **POST** `/api/emprendimientos` - Crear Nuevo Emprendimiento

Crea un emprendimiento en estado `verificacion`.

**Response:**
```json
{
  "ok": true,
  "mensaje": "Emprendimiento creado. Se requiere verificación por SMS.",
  "emprendimiento": { "id": 1, "estado": "verificacion", ... },
  "requiere_verificacion": true
}
```

---

### **PUT** `/api/emprendimientos/:id` - Actualizar Emprendimiento

**Comportamiento:**
- Si el emprendimiento está en estado `verificacion` → **Actualiza directamente**
- Si el emprendimiento está en cualquier otro estado → **Crea un BORRADOR**

**Response (Borrador Creado):**
```json
{
  "ok": true,
  "mensaje": "Borrador creado. Se requiere verificación por SMS.",
  "emprendimiento": {
    "id": 5,
    "estado": "verificacion",
    "es_borrador": true,
    "emprendimiento_original_id": 1,
    ...
  },
  "requiere_verificacion": true,
  "es_borrador": true
}
```

---

### **POST** `/api/emprendimientos/:id/enviar-codigo` - Enviar Código SMS

Genera código de 6 dígitos y lo envía por SMS (simulado en desarrollo).

**Response:**
```json
{
  "ok": true,
  "mensaje": "Código de verificación enviado al número +56912345678",
  "codigo_dev": "123456"  // Solo en desarrollo
}
```

---

### **POST** `/api/emprendimientos/:id/verificar-codigo` - Verificar Código

**Comportamiento:**
- Si es un **emprendimiento nuevo** → Cambia a estado `pendiente`
- Si es un **borrador** → Copia datos al original, cambia original a `pendiente`, elimina borrador

**Body:**
```json
{
  "codigo": "123456"
}
```

**Response (Emprendimiento Nuevo):**
```json
{
  "ok": true,
  "mensaje": "Verificación exitosa. Tu emprendimiento está en revisión y será activado pronto.",
  "emprendimiento": { "id": 1, "estado": "pendiente", ... },
  "verificado": true
}
```

**Response (Borrador Aplicado):**
```json
{
  "ok": true,
  "mensaje": "Verificación exitosa. Los cambios están en revisión y serán activados pronto.",
  "emprendimiento": { "id": 1, "estado": "pendiente", ... },
  "verificado": true,
  "borrador_aplicado": true
}
```

---

### **GET** `/api/admin/emprendimientos/pendientes` - Listar Pendientes (Admin)

Lista todos los emprendimientos en estado `pendiente` para aprobación.

**Headers:**
```json
{
  "Authorization": "Bearer {token_admin}"
}
```

**Response:**
```json
{
  "ok": true,
  "emprendimientos": [
    {
      "id": 1,
      "nombre": "Mi Negocio",
      "estado": "pendiente",
      "nombre_usuario": "Juan Pérez",
      "email_usuario": "juan@example.com",
      "verificado_at": "2025-11-04T10:30:00.000Z",
      ...
    }
  ]
}
```

---

### **POST** `/api/admin/emprendimientos/:id/aprobar` - Aprobar Emprendimiento (Admin)

Cambia el estado de `pendiente` a `inactivo` (listo para que el emprendedor lo active).

**Response:**
```json
{
  "ok": true,
  "mensaje": "Emprendimiento aprobado exitosamente. El emprendedor ya puede activarlo.",
  "emprendimiento": {
    "id": 1,
    "nombre": "Mi Negocio",
    "estado": "inactivo",
    "fecha_aprobacion": "2025-11-04T11:00:00.000Z"
  }
}
```

---

### **POST** `/api/admin/emprendimientos/:id/rechazar` - Rechazar Emprendimiento (Admin)

Cambia el estado de `pendiente` a `rechazado`.

**Body:**
```json
{
  "motivo": "Información incompleta o incorrecta"
}
```

**Response:**
```json
{
  "ok": true,
  "mensaje": "Emprendimiento rechazado.",
  "emprendimiento": {
    "id": 1,
    "nombre": "Mi Negocio",
    "estado": "rechazado",
    "motivo_rechazo": "Información incompleta o incorrecta",
    "fecha_rechazo": "2025-11-04T11:00:00.000Z"
  }
}
```

---

## 💻 Frontend - Cambios Implementados

### **1. Estados Nuevos**

```javascript
const [modalVerificacionVisible, setModalVerificacionVisible] = useState(false);
const [emprendimientoParaVerificar, setEmprendimientoParaVerificar] = useState(null);
const [codigoVerificacion, setCodigoVerificacion] = useState(['', '', '', '', '', '']);
```

### **2. Auto-Focus en Inputs de Código**

- ✅ Escribir dígito → Auto-focus al siguiente
- ✅ Backspace en campo vacío → Vuelve al anterior y borra
- ✅ Pegar código completo → Llena todos los campos
- ✅ Primer campo con auto-focus al abrir modal

### **3. Badge de Borrador**

Si `esBorrador === true`, se muestra un badge "CAMBIOS PENDIENTES" en la tarjeta.

### **4. Botón "Verificar"**

Cuando `status === "verificacion"`:
- Botón principal: **"Completar Verificación"** (emprendimiento nuevo)
- Botón principal: **"Verificar Cambios"** (borrador)
- Color: Azul (`#3498db`)
- Icono: `shield-checkmark`

### **5. Visualización en Listado**

- ✅ Emprendimientos en `verificacion` **SÍ se muestran**
- ✅ Borradores **SÍ se muestran** con badge especial
- ✅ Emprendimientos originales activos **continúan visibles** mientras hay borrador pendiente

### **6. Restricciones de Edición**

- ❌ NO se puede editar un emprendimiento en estado `verificacion`
- ❌ NO se puede editar un emprendimiento en estado `pendiente`
- ❌ NO se puede editar un emprendimiento en estado `rechazado`
- ❌ NO se puede editar un borrador
- ✅ SÍ se puede editar un emprendimiento `activo` o `inactivo` (crea borrador)

---

## 🎨 Experiencia de Usuario

### Escenario 1: Crear Primer Emprendimiento

1. Usuario completa formulario
2. Presiona "Enviar a Evaluación"
3. Emprendimiento aparece en listado con badge azul "VERIFICANDO"
4. Modal de verificación se abre automáticamente
5. Código SMS se envía (en dev: se muestra en alert)
6. Usuario ingresa 6 dígitos
7. Emprendimiento cambia a badge amarillo "PENDIENTE"
8. Admin aprueba → Cambia a gris "INACTIVO"
9. Emprendedor activa con switch → Verde "ACTIVO"

### Escenario 2: Editar Emprendimiento Activo

1. Usuario tiene emprendimiento ACTIVO vendiendo
2. Usuario presiona "Editar"
3. Modifica datos y presiona "Actualizar"
4. **Dos tarjetas aparecen:**
   - **Original**: Verde "ACTIVO" (sigue vendiendo)
   - **Borrador**: Azul "VERIFICANDO" + badge "CAMBIOS PENDIENTES"
5. Usuario presiona "Verificar Cambios" en borrador
6. Ingresa código SMS
7. Borrador desaparece
8. Original cambia a amarillo "PENDIENTE" con datos actualizados
9. Admin aprueba → Gris "INACTIVO"
10. Emprendedor activa → Verde "ACTIVO" (con cambios)

### Escenario 3: Cancelar Borrador

1. Usuario tiene borrador pendiente
2. Usuario presiona "Cancelar Borrador"
3. Borrador se elimina
4. Original permanece sin cambios

---

## 🔒 Seguridad y Validaciones

### Validaciones Backend

1. ✅ Solo el dueño puede crear/editar emprendimientos
2. ✅ Solo se puede tener 1 borrador por emprendimiento (se elimina el anterior)
3. ✅ Código SMS expira en 15 minutos
4. ✅ Solo emprendimientos en `pendiente` pueden ser aprobados/rechazados
5. ✅ Solo admin puede aprobar/rechazar emprendimientos

### Validaciones Frontend

1. ✅ No se puede editar emprendimientos en verificación/pendiente/rechazado
2. ✅ No se puede editar un borrador directamente
3. ✅ Confirmación al cerrar modal de verificación
4. ✅ Código debe tener exactamente 6 dígitos

---

## 📱 Integración SMS (Pendiente)

### Configuración Twilio (Recomendado)

```javascript
// En emprendimientos.js línea 788
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

await client.messages.create({
  body: `VeciApp: Tu código de verificación es ${codigoVerificacion}`,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: emprendimiento.telefono
});
```

### Variables de Entorno

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
NODE_ENV=production
```

---

## 🧪 Testing

### Caso 1: Crear Nuevo Emprendimiento

```bash
# 1. Crear emprendimiento
POST /api/emprendimientos
Body: { nombre: "Test", direccion: "Test 123", ... }

# Response:
{ "ok": true, "requiere_verificacion": true, ... }

# 2. Verificar en consola el código:
# 📱 Código de verificación: 123456

# 3. Verificar código
POST /api/emprendimientos/1/verificar-codigo
Body: { "codigo": "123456" }

# Response:
{ "ok": true, "verificado": true, ... }

# 4. Aprobar como admin
POST /api/admin/emprendimientos/1/aprobar
Headers: { "Authorization": "Bearer {token_admin}" }

# Response:
{ "ok": true, "mensaje": "Emprendimiento aprobado...", ... }
```

### Caso 2: Editar Emprendimiento Activo

```bash
# 1. Emprendimiento original ID: 1, estado: activo

# 2. Editar emprendimiento
PUT /api/emprendimientos/1
Body: { nombre: "Nuevo Nombre", ... }

# Response:
{ 
  "ok": true, 
  "es_borrador": true,
  "emprendimiento": {
    "id": 5,  // Nuevo ID del borrador
    "emprendimiento_original_id": 1,
    "es_borrador": true,
    "estado": "verificacion"
  }
}

# 3. Listar emprendimientos del usuario
GET /api/emprendimientos/mis-emprendimientos

# Response: 2 registros
[
  { "id": 5, "es_borrador": true, "estado": "verificacion" },  // Borrador primero
  { "id": 1, "es_borrador": false, "estado": "activo" }  // Original sigue activo
]

# 4. Verificar código del borrador
POST /api/emprendimientos/5/verificar-codigo
Body: { "codigo": "123456" }

# Response:
{ 
  "ok": true, 
  "borrador_aplicado": true,
  "emprendimiento": { "id": 1, "estado": "pendiente" }  // Original actualizado
}

# 5. Listar emprendimientos del usuario
GET /api/emprendimientos/mis-emprendimientos

# Response: 1 registro (borrador eliminado)
[
  { "id": 1, "es_borrador": false, "estado": "pendiente" }  // Con nuevos datos
]

# 6. Aprobar como admin
POST /api/admin/emprendimientos/1/aprobar

# Response:
{ "ok": true, "emprendimiento": { "id": 1, "estado": "inactivo" } }
```

---

## 🎨 UI/UX - Características

### Badge de Estado

```javascript
case "verificacion":
  return { color: "#3498db", label: "VERIFICANDO", icon: "shield-checkmark" };
case "pendiente":
  return { color: "#FFC107", label: "PENDIENTE", icon: "time" };
case "inactivo":
  return { color: "#9E9E9E", label: "INACTIVO", icon: "pause-circle" };
case "activo":
  return { color: "#4CAF50", label: "ACTIVO", icon: "checkmark-circle" };
case "rechazado":
  return { color: "#F44336", label: "RECHAZADO", icon: "close-circle" };
```

### Badge de Borrador

Cuando `esBorrador === true`:
```jsx
<View style={styles.borradorBadge}>
  <Ionicons name="document-text" size={10} color="white" />
  <Text>CAMBIOS PENDIENTES</Text>
</View>
```

### Botones Condicionales

```javascript
// Si está en verificación
if (item.status === "verificacion") {
  // Botón: "Completar Verificación" o "Verificar Cambios"
}

// Si está activo/inactivo y NO es borrador
if ((item.status === "activo" || item.status === "inactivo") && !item.esBorrador) {
  // Botón: "Editar" (creará borrador)
}

// Siempre
// Botón: "Eliminar" o "Cancelar Borrador"
```

---

## 🔍 Casos Especiales

### ¿Qué pasa si cierro el modal de verificación?

- El emprendimiento/borrador permanece en estado `verificacion`
- Aparece en el listado con botón "Completar Verificación"
- Puedes verificarlo en cualquier momento

### ¿Qué pasa si edito un emprendimiento que ya tiene borrador pendiente?

- El borrador anterior se **elimina automáticamente**
- Se crea un **nuevo borrador** con los últimos cambios
- El original permanece sin cambios

### ¿Qué pasa si elimino un emprendimiento con borrador?

- Si eliminas el **original**: El borrador también se elimina (CASCADE)
- Si eliminas el **borrador**: El original permanece intacto

### ¿Qué pasa si el código SMS expira?

- Alert indica que expiró
- Ofrece botón "Enviar Nuevo Código"
- Se genera nuevo código con nueva expiración de 15 min

---

## 📋 Próximas Mejoras

### Corto Plazo
- [ ] Notificación push al emprendedor cuando admin aprueba
- [ ] Email de confirmación al aprobar/rechazar
- [ ] Panel admin en frontend para gestionar aprobaciones
- [ ] Integración SMS real (Twilio/AWS SNS)

### Largo Plazo
- [ ] Historial de cambios (versiones)
- [ ] Comparador de cambios (diff entre original y borrador)
- [ ] Sistema de comentarios admin → emprendedor
- [ ] Aprobación automática para emprendedores confiables

---

## 🚀 Comandos de Migración

Para aplicar en producción:

```sql
-- Agregar columnas de borradores
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS emprendimiento_original_id INTEGER REFERENCES emprendimientos(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS es_borrador BOOLEAN DEFAULT FALSE;

-- Agregar columnas de verificación
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(6),
ADD COLUMN IF NOT EXISTS codigo_enviado_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verificado_at TIMESTAMP;

-- Agregar columnas de aprobación
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS fecha_rechazo TIMESTAMP,
ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

-- Agregar valor 'verificacion' al ENUM
ALTER TYPE emprendimiento_estado ADD VALUE 'verificacion' BEFORE 'pendiente';

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_emprendimientos_original_id ON emprendimientos(emprendimiento_original_id);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_borrador ON emprendimientos(es_borrador);
CREATE INDEX IF NOT EXISTS idx_emprendimientos_estado ON emprendimientos(estado);
```

---

## 📊 Queries Útiles

### Ver todos los borradores activos

```sql
SELECT id, nombre, estado, emprendimiento_original_id
FROM emprendimientos
WHERE es_borrador = true;
```

### Ver emprendimientos con borrador pendiente

```sql
SELECT 
  orig.id as original_id,
  orig.nombre as original_nombre,
  orig.estado as original_estado,
  borr.id as borrador_id,
  borr.estado as borrador_estado
FROM emprendimientos orig
JOIN emprendimientos borr ON borr.emprendimiento_original_id = orig.id
WHERE borr.es_borrador = true;
```

### Limpiar borradores huérfanos (sin original)

```sql
DELETE FROM emprendimientos
WHERE es_borrador = true
  AND emprendimiento_original_id NOT IN (
    SELECT id FROM emprendimientos WHERE es_borrador = false
  );
```

---

**Última actualización**: 4 de Noviembre, 2025  
**Estado**: ✅ Completamente Implementado (SMS simulado)




