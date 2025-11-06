# 📧 Sistema de Emails HTML con Logo Real

## ✅ Implementado Completamente

Se implementaron emails HTML hermosos con el logo real de VeciApp para:
1. ✉️ Bienvenida a nuevos usuarios (clientes y emprendedores)
2. ✉️ Activación de vendedores
3. ✉️ Confirmación de activación

---

## 🎨 Características de los Emails

### Logo Real
- ✅ Usa la imagen `welcome.png` de VeciApp
- ✅ Servida desde: `http://localhost:3000/assets/logo-veciapp.png`
- ✅ Fondo blanco circular con sombra
- ✅ 140x140px perfectamente centrado

### Diseño Profesional
- 📱 **Responsive**: Se adapta a móvil y desktop
- 🎨 **Gradiente moderno**: Verde-morado (#2A9D8F → #667eea)
- 🔄 **Animaciones**: Entrada suave y bounce en logo (página de activación)
- 📦 **Secciones organizadas**: Header, contenido, features, footer
- ✨ **Emojis**: Hacen el email más amigable y visual

---

## 📬 Tipos de Emails

### 1. Email de Bienvenida (Registro)

**Cuándo se envía**: Cuando un usuario se registra en la app

**Para quién**:
- 👤 Clientes (tipo_usuario = 'cliente')
- 🏪 Emprendedores (tipo_usuario = 'emprendedor')

**Contenido**:
```
┌─────────────────────────────────────┐
│  [Gradiente Verde-Morado]           │
│  ┌─────────┐                        │
│  │  LOGO   │ VeciApp                │
│  │  REAL   │ Tu comunidad, más...   │
│  └─────────┘                        │
└─────────────────────────────────────┘
│                                     │
│  ¡Bienvenido a VeciApp, Juan! 🎉    │
│                                     │
│  ¡Gracias por unirte a nuestra      │
│  comunidad!                         │
│                                     │
│  Tu cuenta ha sido creada como      │
│  [Cliente/Emprendedor]              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔐 Tus Credenciales:        │   │
│  │ 📧 juan@ejemplo.com         │   │
│  │ 🔑 La que configuraste      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Features específicas según tipo]  │
│                                     │
│  📱 Descarga la app ahora          │
│  Disponible para iOS y Android     │
└─────────────────────────────────────┘
```

**Features para Cliente**:
- 🛒 Explora emprendimientos locales
- 🎯 Compra productos y servicios
- 🚚 Recibe a domicilio o retira en local
- ⭐ Califica y apoya emprendedores

**Features para Emprendedor**:
- 🏪 Crea tu emprendimiento
- 📦 Gestiona productos con fotos y precios
- 📊 Recibe pedidos en tiempo real
- ⭐ Actualiza a Premium (3 emprendimientos, 30 productos c/u)

### 2. Email de Activación de Vendedor

**Cuándo se envía**: Cuando un emprendedor crea un vendedor

**Contenido**:
```
┌─────────────────────────────────────┐
│  [Logo Real VeciApp]                │
│                                     │
│  ¡Hola Rodrigo! 👋                  │
│                                     │
│  Has sido invitado a ser vendedor   │
│  de "Pizzeria Michelle"             │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  🔓 Activar Mi Cuenta         │ │
│  └───────────────────────────────┘ │
│  (Botón con gradiente)              │
│                                     │
│  ⚠️ Expira en 24 horas              │
│                                     │
│  📱 Una vez activada:               │
│  ✅ Gestionar pedidos               │
│  ✅ Cambiar estados                 │
│  ✅ Comunicarte con clientes        │
│  ✅ Notificaciones en tiempo real   │
└─────────────────────────────────────┘
```

### 3. Email de Confirmación

**Cuándo se envía**: Cuando el vendedor activa su cuenta

**Contenido**:
```
┌─────────────────────────────────────┐
│  [Logo Real VeciApp]                │
│                                     │
│  ¡Hola Rodrigo! 🎉                  │
│                                     │
│  ¡Tu cuenta ha sido activada!       │
│                                     │
│  📧 Correo: rodrigo@ejemplo.com     │
│  🔑 Contraseña: La que configuraste │
│                                     │
│  📱 Próximos Pasos:                 │
│  1. Abre VeciApp en tu móvil        │
│  2. Inicia sesión                   │
│  3. Comienza a gestionar pedidos    │
└─────────────────────────────────────┘
```

---

## 🖼️ URL de la Imagen del Logo

### Desarrollo
```
http://192.168.18.100:3000/assets/logo-veciapp.png
```

### Producción (futuro)
```
https://api.veciapp.com/assets/logo-veciapp.png
```

**Ubicación del archivo:**
```
veciApp2-backend/src/assets/logo-veciapp.png
```

**Ruta estática configurada en:**
```javascript
// src/server.js
app.use('/assets', express.static(path.join(__dirname, 'assets')))
```

---

## 📊 Estructura de las Plantillas

### Archivo: `src/utils/emailTemplates.js`

```javascript
// Funciones exportadas:
- emailBienvenida({ nombre, tipoUsuario, correo })
- emailActivacionVendedor({ nombre, emprendimientoNombre, enlaceActivacion })
- emailConfirmacionActivacion({ nombre, correo })

// URL dinámica del logo:
const getLogoUrl = () => `http://${serverIp}:${port}/assets/logo-veciapp.png`
```

### Template Base
- Header con gradiente y logo
- Contenido dinámico
- Footer con branding
- CSS inline para compatibilidad con clientes de email

---

## 🔧 Configuración Aplicada

### 1. Assets Estáticos
```javascript
// src/server.js
app.use('/assets', express.static(path.join(__dirname, 'assets')))
```

### 2. Logo Copiado
```bash
src/assets/logo-veciapp.png
```

### 3. Templates Actualizadas
```javascript
// Antes (SVG)
<div class="logo-container">${logoSVG}</div>

// Ahora (Imagen real)
<img src="${logoUrl}" alt="VeciApp Logo" class="logo-img" />
```

---

## 🧪 Probar los Emails

### Probar Email de Bienvenida
```bash
# 1. Registra un nuevo usuario en la app
# 2. Revisa Mailtrap
# 3. Deberías ver el logo real de VeciApp
```

### Probar Email de Vendedor
```bash
# 1. Crea un vendedor desde la app
# 2. Revisa Mailtrap
# 3. Haz clic en el botón "Activar Mi Cuenta"
# 4. Verás página HTML de confirmación
```

---

## 🎨 Vista Previa del Email HTML

### Header
```html
<div class="header" style="background: linear-gradient(135deg, #2A9D8F 0%, #667eea 100%);">
  <div class="logo-container" style="background: white; border-radius: 70px;">
    <img src="http://192.168.18.100:3000/assets/logo-veciapp.png" 
         alt="VeciApp Logo" 
         style="width: 100%; height: 100%; object-fit: contain;" />
  </div>
  <div class="header-title">VeciApp</div>
  <div class="header-subtitle">Tu comunidad, más conectada</div>
</div>
```

### Botón de Acción
```html
<a href="[enlace]" 
   style="background: linear-gradient(135deg, #2A9D8F 0%, #667eea 100%);
          color: white;
          padding: 18px 40px;
          border-radius: 30px;
          font-size: 18px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 8px 20px rgba(42, 157, 143, 0.3);">
  🔓 Activar Mi Cuenta
</a>
```

---

## ✨ Ventajas del Logo Real vs SVG

| Aspecto | SVG | Imagen Real |
|---------|-----|-------------|
| **Fidelidad** | ❌ Aproximación | ✅ 100% idéntico |
| **Colores** | ❌ Estimados | ✅ Exactos (#2A9D8F) |
| **Detalles** | ❌ Simplificado | ✅ Todos preservados |
| **Branding** | ⚠️ Inconsistente | ✅ Consistente con app |
| **Carga** | ✅ Rápida | ✅ Rápida (PNG optimizado) |

---

## 📝 Archivos Modificados

- ✅ `src/server.js` - Ruta estática para assets
- ✅ `src/utils/emailTemplates.js` - Usa imagen real
- ✅ `src/routes/auth.js` - Envía email de bienvenida
- ✅ `src/routes/emprendimientos.js` - Emails de vendedor
- ✅ `src/assets/logo-veciapp.png` - Logo copiado

---

## 🚀 Estado Actual

- ✅ Backend configurado para servir imagen
- ✅ Plantillas HTML usando logo real
- ✅ Email de bienvenida implementado
- ✅ Emails de vendedor actualizados
- ⏳ Pendiente: Reiniciar backend para aplicar cambios
- ⏳ Pendiente: Configurar Mailtrap (MAILTRAP_USER y MAILTRAP_PASS)

---

**Sistema listo para enviar emails hermosos con el logo real de VeciApp** 🎨✨

