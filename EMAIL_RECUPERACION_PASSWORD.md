# 📧 Email HTML de Recuperación de Contraseña

## ✅ Implementación Completada

Se creó un email HTML hermoso para el código de recuperación de contraseña que se envía cuando un usuario olvida su contraseña.

---

## 🎨 Diseño del Email

### Características Visuales
- ✅ **Logo real de VeciApp** (servido desde backend)
- ✅ **Código de 6 dígitos destacado** con fuente monospace
- ✅ **Gradiente de fondo** en la sección del código
- ✅ **Warning de expiración** (5 minutos)
- ✅ **Consejos de seguridad**
- ✅ **Instrucciones paso a paso**
- ✅ **Responsive** (móvil y desktop)

---

## 📧 Vista Previa del Email

```
┌─────────────────────────────────────────────────┐
│  [Gradiente Verde-Morado]                       │
│  ┌─────────┐                                    │
│  │  LOGO   │ VeciApp                            │
│  │  REAL   │ Tu comunidad, más conectada        │
│  └─────────┘                                    │
└─────────────────────────────────────────────────┘

  Hola Juan! 🔐

  Has solicitado restablecer tu contraseña en VeciApp.

  Usa el siguiente código de verificación de 6 dígitos 
  en la aplicación:

  ┌───────────────────────────────────┐
  │  TU CÓDIGO DE VERIFICACIÓN        │
  │                                   │
  │  ┌─────────────────────────────┐ │
  │  │                             │ │
  │  │        123456               │ │ ← Grande, en color verde
  │  │                             │ │
  │  └─────────────────────────────┘ │
  └───────────────────────────────────┘

  ⚠️ Este código expirará en 5 minutos

  ┌───────────────────────────────────┐
  │ 🛡️ Seguridad:                     │
  │ • No compartas este código        │
  │ • Si no lo solicitaste, ignóralo  │
  │ • Tu contraseña sigue siendo      │
  │   válida hasta que la cambies     │
  └───────────────────────────────────┘

  Pasos a seguir:
  1️⃣ Ingresa el código de 6 dígitos en la app
  2️⃣ Crea una nueva contraseña segura
  3️⃣ Inicia sesión con tu nueva contraseña

  Si no solicitaste restablecer tu contraseña, 
  puedes ignorar este correo de forma segura.

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         VeciApp
    Tu comunidad, más conectada
      © 2025 VeciApp
```

---

## 🔧 Implementación Técnica

### Archivo: `src/utils/emailTemplates.js`

**Nueva función:**
```javascript
emailRecuperacionPassword({ nombre, codigo })
```

**Características del código:**
```css
font-size: 48px;
font-weight: 900;
color: #2A9D8F;
letter-spacing: 12px;
font-family: 'Courier New', monospace;
text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
```

### Archivo: `src/routes/auth.js`

**Endpoint modificado:**
```javascript
POST /api/auth/recuperar-password
```

**Antes:**
```javascript
await sendMail({
  to: usuario.correo,
  subject: 'Código de recuperación de contraseña',
  text: `Tu código es: ${codigo}. Expira en 5 minutos.`
})
```

**Ahora:**
```javascript
const htmlContent = emailRecuperacionPassword({
  nombre: usuario.nombre,
  codigo
})

await sendMail({
  to: usuario.correo,
  subject: '🔐 Código de recuperación de contraseña - VeciApp',
  text: `[versión texto plano]`,
  html: htmlContent
})
```

---

## 📱 Flujo Completo

### 1. Usuario Olvida Contraseña
```
App → RecuperarPasswordScreen
Usuario ingresa: juan@ejemplo.com
Presiona: "Enviar Código"
```

### 2. Backend Genera Código
```
Código aleatorio: 6 dígitos (100000-999999)
Expira en: 5 minutos
Se guarda en: usuarios.codigo_verificacion
```

### 3. Usuario Recibe Email
```
Asunto: 🔐 Código de recuperación de contraseña - VeciApp
Código: 123456 (destacado en grande)
Logo: Real de VeciApp
```

### 4. Usuario Ingresa Código
```
App → VerificarCodigoScreen
Usuario ingresa: 123456
Backend valida: código + expiración
```

### 5. Usuario Cambia Contraseña
```
App → CambiarPasswordScreen
Nueva contraseña: ********
Confirmar: ********
✅ Contraseña actualizada
```

---

## ⏰ Tiempo de Expiración

**Backend:** 5 minutos
```javascript
const expira = new Date(Date.now() + 5*60*1000)
```

**Frontend (RecuperarPasswordScreen):**
```jsx
<Text>El código expira en 5 minutos</Text>
```

**Email:**
```
⏰ Este código expirará en 5 minutos
```

**Todo sincronizado en 5 minutos** ✅

---

## 🛡️ Seguridad Implementada

### 1. Código Aleatorio
```javascript
Math.floor(100000 + Math.random()*900000).toString()
// Genera: 100000 - 999999 (6 dígitos)
```

### 2. Expiración Automática
- Se guarda en `fecha_expiracion_codigo`
- Backend valida antes de aceptar
- Código inválido después de 5 minutos

### 3. Respuesta Genérica
```javascript
// Siempre retorna el mismo mensaje (seguridad)
let okMsg = { 
  mensaje: 'Si el correo existe, recibirás un código...' 
}
```

### 4. Un Solo Uso
- Se elimina después de cambiar contraseña
- No se puede reutilizar

### 5. Consejos en Email
```
• No compartas este código con nadie
• Si no lo solicitaste, ignóralo
• Tu contraseña actual sigue siendo válida
```

---

## 📝 Cambios Adicionales

### RegisterScreen.js
✅ **Eliminado input de teléfono**
- Ya no es obligatorio
- Formulario más simple
- Menos fricción en registro

**Antes:**
```jsx
<TextInput
  placeholder="+56912345678"
  value={telefono}
  onChangeText={setTelefono}
  keyboardType="phone-pad"
/>
```

**Ahora:**
```
(Eliminado completamente)
```

**Backend:**
```javascript
// Ya era opcional, ahora solo no se envía desde frontend
const { telefono } = req.body || {}
// Si no viene, se guarda como NULL
```

---

## 🧪 Probar el Sistema

### Paso 1: Solicitar Código
```
1. Abre la app VeciApp
2. Ve a "¿Olvidaste tu contraseña?"
3. Ingresa tu correo: test@ejemplo.com
4. Presiona "Enviar Código"
5. Verás: "Si el correo existe, recibirás un código..."
```

### Paso 2: Revisar Email
```
1. Ve a Mailtrap (https://mailtrap.io)
2. Abre el inbox
3. Verás email: "🔐 Código de recuperación de contraseña"
4. Código destacado en grande: 123456
5. Logo real de VeciApp
```

### Paso 3: Verificar Código
```
1. La app te lleva a VerificarCodigoScreen
2. Ingresa el código: 123456
3. Presiona "Verificar"
4. Si es correcto: Te lleva a cambiar contraseña
5. Si expiró o es incorrecto: Error
```

### Paso 4: Cambiar Contraseña
```
1. Ingresa nueva contraseña: NewPass123
2. Confirma: NewPass123
3. Presiona "Cambiar Contraseña"
4. ✅ Contraseña actualizada
5. Inicia sesión con la nueva contraseña
```

---

## 📊 Comparación: Antes vs Ahora

| Aspecto | ❌ Antes | ✅ Ahora |
|---------|---------|---------|
| **Diseño Email** | Texto plano | HTML hermoso con logo |
| **Código** | Pequeño | Grande, destacado, monospace |
| **Logo** | No | Sí, logo real de VeciApp |
| **Seguridad** | Tips básicos | Sección completa de seguridad |
| **Instrucciones** | No | Paso a paso numerado |
| **Responsive** | No aplica | Funciona en móvil y desktop |
| **Teléfono** | Obligatorio en registro | Opcional (eliminado) |

---

## 🎨 Código CSS del Email

### Caja del Código
```css
background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
border-radius: 16px;
padding: 30px;
margin: 30px 0;
text-align: center;
```

### Código de 6 Dígitos
```css
background: white;
border-radius: 12px;
padding: 25px;
box-shadow: 0 4px 15px rgba(0,0,0,0.1);
font-size: 48px;
font-weight: 900;
color: #2A9D8F;
letter-spacing: 12px;
font-family: 'Courier New', monospace;
```

---

## 📁 Archivos Modificados

### Backend
- ✅ `src/utils/emailTemplates.js` - Nueva plantilla
- ✅ `src/routes/auth.js` - Usa plantilla HTML

### Frontend  
- ✅ `screens/RecuperarPasswordScreen.js` - Actualizado a 5 minutos
- ✅ `screens/RegisterScreen.js` - Eliminado input de teléfono

---

## ✨ Próximas Mejoras Opcionales

1. **Contador de intentos:** Bloquear después de 3 intentos fallidos
2. **Reenviar código:** Botón para solicitar nuevo código
3. **Historial:** Log de intentos de recuperación
4. **Notificación:** Email cuando se cambia la contraseña
5. **2FA:** Opción de autenticación de dos factores

---

**Sistema de recuperación de contraseña con emails HTML hermosos completamente operativo** 🎉✅

