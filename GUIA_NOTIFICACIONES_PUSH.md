# 🔔 Guía de Implementación: Notificaciones Push con FCM

## 📋 Índice
1. [Configuración de Firebase](#1-configuración-de-firebase)
2. [Instalación de Dependencias](#2-instalación-de-dependencias)
3. [Configuración del Backend](#3-configuración-del-backend)
4. [Configuración del Frontend](#4-configuración-del-frontend)
5. [Casos de Uso](#5-casos-de-uso)
6. [Testing](#6-testing)

---

## 1. Configuración de Firebase

### Paso 1.1: Crear Proyecto en Firebase Console

1. Ve a https://console.firebase.google.com/
2. Click en "Agregar proyecto"
3. Nombre: **VeciApp**
4. Deshabilita Google Analytics (opcional)
5. Click en "Crear proyecto"

### Paso 1.2: Configurar Android

1. En Firebase Console → Click en el ícono de Android
2. Ingresa el **Package Name**: `com.veciapp` (debe coincidir con `app.json`)
3. Download `google-services.json`
4. Coloca el archivo en: `veciApp/google-services.json`

### Paso 1.3: Configurar iOS

1. En Firebase Console → Click en el ícono de iOS
2. Ingresa el **Bundle ID**: `com.veciapp` (debe coincidir con `app.json`)
3. Download `GoogleService-Info.plist`
4. Coloca el archivo en: `veciApp/GoogleService-Info.plist`

### Paso 1.4: Obtener Credenciales del Backend (Service Account)

**⚠️ IMPORTANTE:** El "Server Key" está deprecado. Usamos Service Account JSON.

1. En Firebase Console → Configuración del proyecto (⚙️)
2. Click en pestaña **"Cuentas de servicio"** (Service accounts)
3. Scroll down hasta "Firebase Admin SDK"
4. Click en **"Generar nueva clave privada"**
5. Se descargará un archivo JSON (ejemplo: `veciapp-firebase-adminsdk-xxxxx.json`)
6. **Renombra este archivo a:** `firebase-adminsdk.json`
7. **Colócalo en:** `veciApp2-backend/src/config/firebase-adminsdk.json`

**✅ Este archivo ya contiene todo lo necesario para el backend (no necesitas Server Key)**

---

## 2. Instalación de Dependencias

### Frontend (React Native Expo)

```bash
cd veciApp
npx expo install expo-notifications expo-device expo-constants
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### Backend (Node.js)

```bash
cd veciApp2-backend
npm install firebase-admin
```

---

## 3. Configuración del Backend

### Paso 3.1: Verificar archivo de credenciales

**✅ Ya deberías tener el archivo de credenciales del Paso 1.4**

Verifica que existe:
```bash
ls veciApp2-backend/src/config/firebase-adminsdk.json
```

Si NO existe, regresa al **Paso 1.4** y descárgalo.

**⚠️ IMPORTANTE:** Este archivo YA está en `.gitignore` (no se subirá a Git)

### Paso 3.2: Ejecutar Script SQL

Ejecuta el script SQL para agregar el campo `fcm_token` a la tabla `usuarios`:

```bash
cd veciApp2-backend
psql -h localhost -p 5432 -U rodrigoalonsocarvallogonzalez -d veciapp_dev -f AGREGAR_FCM_TOKEN.sql
```

### Paso 3.3: Instalar Dependencias del Backend

```bash
cd veciApp2-backend
npm install firebase-admin
```

---

## 4. Configuración del Frontend

### Paso 4.1: Verificar archivos de configuración

**✅ Ya deberías tener estos archivos del Paso 1.2 y 1.3:**

Verifica que existen:
```bash
ls veciApp/google-services.json        # Android
ls veciApp/GoogleService-Info.plist   # iOS
```

**✅ El archivo `app.json` ya está configurado** con los plugins de notificaciones.

### Paso 4.2: Instalar Dependencias del Frontend

```bash
cd veciApp
npx expo install expo-notifications expo-device expo-constants
```

### Paso 4.3: Permisos

El sistema pedirá permisos automáticamente al usuario en el primer uso.

---

## 5. Casos de Uso Implementados

### Notificaciones que se enviarán:

#### **Para Emprendedores:**
1. ✅ **Nuevo Pedido Recibido**
   - Trigger: Cliente confirma pedido
   - Título: "🛍️ Nuevo Pedido"
   - Mensaje: "Tienes un nuevo pedido de [Cliente]"

2. ✅ **Pedido Cancelado**
   - Trigger: Cliente cancela pedido
   - Título: "❌ Pedido Cancelado"
   - Mensaje: "[Cliente] ha cancelado su pedido"

3. ✅ **Nueva Calificación**
   - Trigger: Cliente califica emprendimiento
   - Título: "⭐ Nueva Calificación"
   - Mensaje: "Recibiste [X] estrellas de [Cliente]"

#### **Para Clientes:**
1. ✅ **Pedido Confirmado**
   - Trigger: Emprendedor confirma pedido
   - Título: "✅ Pedido Confirmado"
   - Mensaje: "[Emprendimiento] confirmó tu pedido"

2. ✅ **Pedido En Camino**
   - Trigger: Emprendedor marca como "en camino"
   - Título: "🚚 Pedido en Camino"
   - Mensaje: "Tu pedido está en camino"

3. ✅ **Pedido Entregado**
   - Trigger: Emprendedor marca como "entregado"
   - Título: "🎉 Pedido Entregado"
   - Mensaje: "Tu pedido ha sido entregado"

4. ✅ **Pedido Rechazado**
   - Trigger: Emprendedor rechaza pedido
   - Título: "⚠️ Pedido Rechazado"
   - Mensaje: "[Emprendimiento] no pudo aceptar tu pedido"

#### **Para Ambos:**
1. ✅ **Nuevo Mensaje/Chat** (futuro)
2. ✅ **Ofertas Especiales** (marketing)

---

## 6. Testing

### Probar en Desarrollo:

1. **Expo Go NO SOPORTA FCM** → Debes usar un build de desarrollo:

```bash
cd veciApp
npx expo prebuild
npx expo run:android  # Para Android
npx expo run:ios      # Para iOS
```

2. **Usar Expo EAS Build** (recomendado):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

### Probar Notificaciones:

Usa la herramienta de Firebase Console → Cloud Messaging → "Enviar mensaje de prueba"

---

## 🚀 Próximos Pasos

1. ✅ Crear proyecto en Firebase Console
2. ✅ Descargar archivos de configuración
3. ✅ Ejecutar scripts SQL
4. ✅ Instalar dependencias
5. ✅ Configurar backend
6. ✅ Configurar frontend
7. ✅ Rebuild app (no funciona con Expo Go)
8. ✅ Probar notificaciones

---

## ⚠️ Notas Importantes

- **Expo Go NO soporta FCM** → Necesitas hacer un build nativo
- **iOS requiere APNs** → Necesitas cuenta de Apple Developer ($99/año)
- **Para desarrollo:** Usa builds de desarrollo de EAS
- **Para producción:** Usa builds de producción de EAS

---

## 📞 Contacto

Si necesitas ayuda adicional, consulta:
- Firebase Docs: https://firebase.google.com/docs/cloud-messaging
- Expo Docs: https://docs.expo.dev/push-notifications/overview/

