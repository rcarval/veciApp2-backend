# 📱 Sistema de Verificación de Teléfono para Clientes

## 📋 Resumen

Sistema obligatorio de verificación de teléfono para clientes que intenten realizar pedidos. Si un cliente no tiene un número de teléfono registrado y verificado, será redirigido automáticamente a la pantalla de verificación cuando intente acceder a `PedidoDetalleScreen`.

---

## 🎯 Características

### Frontend (`veciApp`)

#### 1. **Nueva Pantalla: `IngresarTelefonoScreen.js`**
- ✅ Pantalla modal que **no se puede cerrar** hasta completar la verificación
- ✅ Diseño moderno con gradientes y animaciones
- ✅ Dos pasos: Ingresar teléfono → Verificar código SMS

**Paso 1: Ingresar Teléfono**
- Input con formato automático: `9 1234 5678`
- Prefijo `+56` automático (Chile)
- Validación de formato
- Info box explicando el uso del teléfono
- Botón "Enviar Código SMS"

**Paso 2: Verificar Código**
- Muestra el teléfono ingresado con opción de cambiar
- 6 inputs separados para el código
- Auto-focus: al escribir pasa al siguiente, al borrar vuelve al anterior
- Botón "Verificar Teléfono"
- Opción de reenviar código

#### 2. **Validación Automática en `PedidoDetalleScreen.js`**
```javascript
useEffect(() => {
  // Validar teléfono SOLO si es cliente y NO está en modo preview
  if (!isPreview && usuario?.tipo_usuario === 'cliente' && !usuario?.telefono) {
    navigation.navigate('IngresarTelefono', {
      onComplete: () => {
        console.log('✅ Teléfono verificado');
      }
    });
    return;
  }
  // ... resto del código
}, [usuario, isPreview]);
```

#### 3. **Nuevos Endpoints en `config/api.js`**
- `ENVIAR_CODIGO_TELEFONO`: `/api/auth/enviar-codigo-telefono`
- `VERIFICAR_CODIGO_TELEFONO`: `/api/auth/verificar-codigo-telefono`

#### 4. **Integración con `UserContext`**
- Alias `actualizarUsuario` para actualizar el teléfono en el contexto
- Actualización automática de AsyncStorage

---

### Backend (`veciApp2-backend`)

#### 1. **POST `/api/auth/enviar-codigo-telefono`** 🔒 Requiere autenticación

**Request:**
```json
{
  "telefono": "+56912345678"
}
```

**Proceso:**
1. Valida formato E.164 (+56XXXXXXXXX)
2. Usa **Twilio Verify** para enviar código SMS
3. Fallback a código local en modo desarrollo

**Response (Éxito):**
```json
{
  "ok": true,
  "mensaje": "Código de verificación enviado exitosamente",
  "sid": "VExxxx..."
}
```

**Response (Desarrollo):**
```json
{
  "ok": true,
  "mensaje": "Código enviado (modo desarrollo)",
  "codigo_desarrollo": "123456"
}
```

#### 2. **POST `/api/auth/verificar-codigo-telefono`** 🔒 Requiere autenticación

**Request:**
```json
{
  "telefono": "+56912345678",
  "codigo": "123456"
}
```

**Proceso:**
1. Verifica el código con **Twilio Verify**
2. Si es válido, actualiza el campo `telefono` del usuario
3. Limpia códigos temporales
4. Fallback a verificación local en modo desarrollo

**Response (Éxito):**
```json
{
  "ok": true,
  "mensaje": "Teléfono verificado correctamente",
  "telefono": "+56912345678"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "Código incorrecto o expirado"
}
```

---

## 🔧 Configuración de Twilio

**Variables de entorno requeridas en `.env`:**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🎨 Diseño de la Pantalla

### Header
- Ícono de teléfono con gradiente circular
- Título dinámico según el paso
- Subtítulo explicativo

### Paso 1 - Formulario
- Input con prefijo +56
- Formato automático (9 1234 5678)
- Info box con escudo y explicación
- Botón con gradiente y loading state

### Paso 2 - Verificación
- Badge mostrando el teléfono con opción de cambiar
- 6 inputs separados para el código
- Auto-focus inteligente
- Botón de verificar con loading state
- Opción de reenviar código

### Aviso Importante
- Caja amarilla con ícono de alerta
- Explica la necesidad de verificar el teléfono

---

## 🔒 Seguridad

1. **Autenticación Requerida**: Solo usuarios autenticados pueden verificar teléfono
2. **Validación de Formato**: Formato E.164 obligatorio
3. **Twilio Verify**: Sistema robusto de verificación SMS
4. **Códigos Temporales**: Expiración de 10 minutos en modo desarrollo
5. **No Cancelable**: La pantalla no se puede cerrar hasta completar la verificación

---

## 📊 Flujo Completo

### Para Clientes Nuevos (sin teléfono)

1. **Usuario ingresa a `PedidoDetalleScreen`**
   - ✅ Se detecta que no tiene teléfono
   - ✅ Redirige automáticamente a `IngresarTelefonoScreen`

2. **Paso 1: Ingresa su teléfono**
   - ✅ Formato automático mientras escribe
   - ✅ Validación de formato chileno
   - ✅ Envío de código SMS vía Twilio

3. **Paso 2: Ingresa el código de 6 dígitos**
   - ✅ Auto-focus entre inputs
   - ✅ Verificación con Twilio Verify
   - ✅ Si es correcto, actualiza usuario

4. **Completado**
   - ✅ Usuario actualizado en AsyncStorage
   - ✅ Contexto de usuario actualizado
   - ✅ Vuelve a `PedidoDetalleScreen`
   - ✅ Ahora puede realizar pedidos normalmente

### Para Clientes con Teléfono

1. **Usuario ingresa a `PedidoDetalleScreen`**
   - ✅ Tiene teléfono → No se redirige
   - ✅ Puede realizar pedidos normalmente

---

## 🧪 Modo Desarrollo

**Fallback Automático si Twilio Falla:**
- Genera código de 6 dígitos aleatorio
- Guarda en la BD con expiración de 10 minutos
- Muestra el código en la respuesta del API
- Permite desarrollo sin SMS reales

**Ejemplo:**
```json
{
  "ok": true,
  "mensaje": "Código enviado (modo desarrollo)",
  "codigo_desarrollo": "835729"
}
```

---

## 🎯 Validaciones

### Frontend
- ✅ Formato de teléfono: `^(\+?56)?9\d{8}$`
- ✅ Solo números permitidos
- ✅ Máximo 9 dígitos (sin prefijo)
- ✅ Auto-formateo con espacios

### Backend
- ✅ Formato E.164: `+56XXXXXXXXX`
- ✅ Longitud mínima de 12 caracteres
- ✅ Debe comenzar con `+56`
- ✅ Token JWT válido (autenticación)

---

## 📝 Notas Importantes

1. **Solo para Clientes**: Emprendedores y vendedores NO requieren esta verificación en `PedidoDetalleScreen`
2. **No Cancelable**: La pantalla usa `gestureEnabled: false` para evitar que se cierre con gestos
3. **Sincronización**: El teléfono verificado se guarda en la BD, AsyncStorage y el contexto de usuario
4. **Callback**: Acepta un parámetro `onComplete` para ejecutar acciones después de la verificación

---

## 🚀 Registro de Cambios

### Frontend
- ✅ Creada `IngresarTelefonoScreen.js`
- ✅ Agregada validación en `PedidoDetalleScreen.js`
- ✅ Agregados endpoints en `config/api.js`
- ✅ Registrada pantalla en `App.js`
- ✅ Agregado alias `actualizarUsuario` en `UserContext.js`

### Backend
- ✅ Agregado soporte para Twilio en `auth.js`
- ✅ Endpoint `POST /api/auth/enviar-codigo-telefono`
- ✅ Endpoint `POST /api/auth/verificar-codigo-telefono`
- ✅ Fallback para modo desarrollo

---

## 🎨 Mejoras Visuales

- ✅ Gradientes modernos
- ✅ Animaciones suaves
- ✅ Iconos descriptivos
- ✅ Loading states
- ✅ Info boxes con bordes de color
- ✅ Botones con sombras y efectos
- ✅ Auto-focus en inputs
- ✅ Diseño responsive

---

## ✅ Estado Actual

**Implementación Completa** - Sistema funcional y listo para usar. El teléfono ahora es obligatorio para que los clientes puedan realizar pedidos.

