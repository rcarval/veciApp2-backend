# 📱 Sistema de Verificación por SMS para Emprendimientos

## 📋 Descripción General

Sistema de verificación en dos pasos para emprendimientos que utiliza códigos de 6 dígitos enviados por SMS para garantizar la autenticidad de la información del negocio.

---

## 🔄 Flujo de Verificación

### **1. Creación/Actualización de Emprendimiento**

Cuando un usuario crea o actualiza un emprendimiento:

1. ✅ El emprendimiento se guarda en estado `verificacion`
2. ✅ Se generan las columnas necesarias en la BD:
   - `codigo_verificacion` (VARCHAR 6)
   - `codigo_enviado_at` (TIMESTAMP)
   - `verificado_at` (TIMESTAMP)
3. ✅ El backend responde con `requiere_verificacion: true`
4. ✅ El frontend cierra el modal de creación/edición
5. ✅ El frontend abre automáticamente el modal de verificación

### **2. Envío de Código SMS**

Al abrir el modal de verificación:

1. ✅ Se envía automáticamente un código de 6 dígitos
2. ✅ El código se guarda en la BD con timestamp
3. ✅ **NOTA**: Por ahora, el SMS no se envía realmente (pendiente integración con Twilio/AWS SNS)
4. ✅ En modo desarrollo, el código se muestra en:
   - Console del backend
   - Alert en el frontend (solo en desarrollo)

### **3. Validación del Código**

El usuario ingresa el código de 6 dígitos:

1. ✅ Validaciones realizadas:
   - Código tiene exactamente 6 dígitos
   - Código coincide con el generado
   - Código no ha expirado (15 minutos)
   - Emprendimiento está en estado `verificacion`

2. ✅ Si el código es válido:
   - Estado cambia a `pendiente`
   - Se registra `verificado_at`
   - Se limpia `codigo_verificacion`
   - El emprendimiento aparece en el listado con estado "PENDIENTE"

3. ❌ Si el código es inválido:
   - Se muestra mensaje de error
   - Usuario puede reintentar

4. ⏱️ Si el código expiró:
   - Se ofrece opción de reenviar nuevo código

---

## 🗄️ Estructura de Base de Datos

### Columnas Agregadas a `emprendimientos`

```sql
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(6),
ADD COLUMN IF NOT EXISTS codigo_enviado_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verificado_at TIMESTAMP;
```

### Estados Posibles

| Estado | Descripción | Visible en Listado |
|--------|-------------|-------------------|
| `verificacion` | Esperando verificación por SMS | ❌ No |
| `pendiente` | Verificado, esperando aprobación admin | ✅ Sí (badge amarillo) |
| `activo` | Aprobado y visible públicamente | ✅ Sí (badge verde) |
| `rechazado` | Rechazado por administrador | ✅ Sí (badge rojo) |
| `inactivo` | Desactivado por el usuario | ✅ Sí (badge gris) |

---

## 🌐 API Endpoints

### **POST** `/api/emprendimientos/:id/enviar-codigo`

Genera y envía (simulado) un código de verificación.

**Headers:**
```json
{
  "Authorization": "Bearer {token}"
}
```

**Response:**
```json
{
  "ok": true,
  "mensaje": "Código de verificación enviado al número +56912345678",
  "codigo_dev": "123456"  // Solo en desarrollo
}
```

**Validaciones:**
- Emprendimiento existe y pertenece al usuario
- Emprendimiento está en estado `verificacion`

---

### **POST** `/api/emprendimientos/:id/verificar-codigo`

Verifica el código ingresado por el usuario.

**Headers:**
```json
{
  "Authorization": "Bearer {token}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "codigo": "123456"
}
```

**Response Exitosa:**
```json
{
  "ok": true,
  "mensaje": "Verificación exitosa. Tu emprendimiento está en revisión y será activado pronto.",
  "emprendimiento": {
    "id": 1,
    "nombre": "Mi Negocio",
    "estado": "pendiente",
    "verificado_at": "2025-11-04T10:30:00.000Z"
  },
  "verificado": true
}
```

**Response con Error:**
```json
{
  "ok": false,
  "error": "Código incorrecto. Verifica e intenta nuevamente."
}
```

**Response con Código Expirado:**
```json
{
  "ok": false,
  "error": "El código ha expirado. Por favor solicita uno nuevo.",
  "codigo_expirado": true
}
```

**Validaciones:**
- Código tiene 6 dígitos
- Código coincide con el generado
- Código no ha expirado (15 minutos desde `codigo_enviado_at`)
- Emprendimiento está en estado `verificacion`

---

## 💻 Implementación Frontend

### Estados Agregados

```javascript
const [modalVerificacionVisible, setModalVerificacionVisible] = useState(false);
const [emprendimientoParaVerificar, setEmprendimientoParaVerificar] = useState(null);
const [codigoVerificacion, setCodigoVerificacion] = useState(['', '', '', '', '', '']);
const [enviandoCodigo, setEnviandoCodigo] = useState(false);
const [verificandoCodigo, setVerificandoCodigo] = useState(false);
const [codigoEnviado, setCodigoEnviado] = useState(false);
```

### Funciones Principales

#### `enviarCodigoVerificacion(emprendimientoId)`
- Llama al endpoint de envío
- Muestra el código en desarrollo
- Actualiza estado `codigoEnviado`

#### `verificarCodigoIngresado()`
- Valida los 6 dígitos
- Llama al endpoint de verificación
- Maneja casos de éxito, error y expiración
- Recarga el listado de emprendimientos

### Componente Modal

- **Header**: Con título y botón cerrar
- **Icono**: Mail/Shield para representar verificación
- **Input de Código**: 6 inputs individuales para cada dígito
- **Botón Reenviar**: Para solicitar nuevo código
- **Botón Verificar**: Deshabilitado hasta completar 6 dígitos
- **Aviso**: "El código es válido por 15 minutos"

---

## 🎨 Experiencia de Usuario

### Flujo Completo

1. **Usuario crea/edita emprendimiento**
   - Completa formulario
   - Presiona "Guardar" o "Actualizar"

2. **Backend guarda en estado 'verificacion'**
   - Modal de creación se cierra
   - Modal de verificación se abre automáticamente

3. **Código SMS se envía automáticamente**
   - Alert confirma envío
   - En desarrollo: Alert muestra el código

4. **Usuario ingresa código**
   - 6 inputs individuales
   - Puede reenviar si no llegó

5. **Verificación exitosa**
   - Estado cambia a `pendiente`
   - Modal se cierra
   - Alert de éxito
   - Emprendimiento aparece en listado con badge "PENDIENTE"

### Casos Especiales

- **Código expirado**: Alert ofrece reenviar nuevo código
- **Código incorrecto**: Puede reintentar sin límite
- **Cerrar modal**: Puede volver después (emprendimiento queda en `verificacion`)

---

## 🔮 Próximos Pasos (Pendientes)

### 1. Integración SMS Real

Opciones recomendadas:

#### **Twilio** (Recomendado)
```javascript
const twilio = require('twilio');
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

await client.messages.create({
  body: `Tu código de verificación VeciApp es: ${codigoVerificacion}`,
  from: TWILIO_PHONE_NUMBER,
  to: emprendimiento.telefono
});
```

#### **AWS SNS**
```javascript
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: 'us-east-1' });

await sns.publish({
  Message: `Tu código de verificación VeciApp es: ${codigoVerificacion}`,
  PhoneNumber: emprendimiento.telefono
}).promise();
```

### 2. Mejoras de UI

- [x] Auto-focus entre inputs de código
- [x] Soporte para pegar código completo (6 dígitos)
- [x] Confirmación al cerrar modal de verificación
- [ ] Animaciones al ingresar dígitos
- [ ] Timer visible de expiración con cuenta regresiva

### 3. Seguridad

- [ ] Límite de intentos fallidos (3-5 intentos)
- [ ] Bloqueo temporal después de intentos fallidos
- [ ] Rate limiting para reenvío de códigos

### 4. Proceso de Aprobación

- [ ] Panel de administrador para aprobar emprendimientos
- [ ] Notificaciones push cuando cambia a `activo`
- [ ] Email de confirmación

---

## 🧪 Testing en Desarrollo

### Obtener el Código

El código se muestra en:

1. **Console del backend**:
```
📱 Código de verificación para Mi Negocio: 123456
⚠️  DESARROLLO: SMS no implementado. Código: 123456
```

2. **Alert en frontend** (solo si `NODE_ENV === 'development'`):
```
DESARROLLO
Código: 123456
```

### Probar el Flujo

1. Crear un emprendimiento
2. Ver el código en console/alert
3. Ingresar los 6 dígitos en el modal
4. Verificar que cambia a estado "PENDIENTE"

---

## 📊 Logs y Monitoreo

Todos los eventos importantes se registran:

- ✅ Creación de emprendimiento en estado verificación
- ✅ Envío de código (con el código generado)
- ✅ Intentos de verificación
- ✅ Verificaciones exitosas
- ⚠️ Códigos incorrectos
- ⚠️ Códigos expirados

---

## 🔒 Seguridad

### Medidas Implementadas

1. **Autenticación**: Todos los endpoints requieren token JWT
2. **Autorización**: Solo el dueño del emprendimiento puede verificarlo
3. **Expiración**: Códigos válidos por 15 minutos
4. **Limpieza**: Código se elimina después de verificación exitosa

### Medidas Pendientes (Recomendadas)

1. Rate limiting para prevenir spam
2. Límite de intentos fallidos
3. Registro de intentos sospechosos
4. Notificación al admin de actividad sospechosa

---

## 📝 Notas Técnicas

- Los emprendimientos en estado `verificacion` NO aparecen en el listado principal
- Los emprendimientos en estado `pendiente` SÍ aparecen pero no son editables hasta ser aprobados
- El código es numérico de 6 dígitos (100000-999999)
- La validación de tiempo usa diferencia en milisegundos
- El frontend usa un array de strings para manejar cada dígito individualmente

---

## 🚀 Comandos de Migración

Si necesitas aplicar cambios en producción:

```sql
-- Agregar columnas de verificación
ALTER TABLE emprendimientos 
ADD COLUMN IF NOT EXISTS codigo_verificacion VARCHAR(6),
ADD COLUMN IF NOT EXISTS codigo_enviado_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verificado_at TIMESTAMP;

-- Agregar índice para búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_emprendimientos_estado 
ON emprendimientos(estado);
```

---

**Última actualización**: 4 de Noviembre, 2025
**Estado**: ✅ Implementado (SMS simulado - pendiente integración real)

