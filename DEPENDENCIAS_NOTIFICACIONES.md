# 📦 Dependencias para Notificaciones Push

## Backend (veciApp2-backend)

Agregar al `package.json`:

```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

**Instalar:**
```bash
cd veciApp2-backend
npm install firebase-admin
```

---

## Frontend (veciApp)

Agregar al `package.json`:

```json
{
  "dependencies": {
    "expo-notifications": "~0.28.0",
    "expo-device": "~6.0.0",
    "expo-constants": "~16.0.0"
  }
}
```

**Instalar:**
```bash
cd veciApp
npx expo install expo-notifications expo-device expo-constants
```

---

## Verificar Instalación

### Backend:
```bash
cd veciApp2-backend
npm list firebase-admin
```

Debería mostrar:
```
veciapp2-backend@1.0.0
└── firebase-admin@12.x.x
```

### Frontend:
```bash
cd veciApp
npx expo install --check
```

Debería mostrar:
```
✓ expo-notifications@0.28.x
✓ expo-device@6.0.x
✓ expo-constants@16.0.x
```

---

## ⚠️ Importante

**Después de instalar las dependencias del frontend, DEBES hacer rebuild:**

```bash
# Limpiar cache
cd veciApp
rm -rf node_modules/.cache
rm -rf .expo

# Prebuild (genera archivos nativos)
npx expo prebuild

# Run en Android
npx expo run:android

# O Run en iOS (solo Mac)
npx expo run:ios
```

**❌ NO FUNCIONA CON EXPO GO**

Expo Go no soporta módulos nativos como Firebase. Debes usar:
- `npx expo run:android` (desarrollo local)
- `eas build --profile development` (build en la nube)

---

## 🔍 Verificar que Todo Esté Listo

### Checklist Backend:
- [ ] `firebase-admin` instalado
- [ ] Archivo `firebase-adminsdk.json` en `src/config/`
- [ ] Script SQL ejecutado
- [ ] Backend reiniciado
- [ ] Logs muestran: "✓ Rutas cargadas: .../notificaciones"

### Checklist Frontend:
- [ ] `expo-notifications` instalado
- [ ] `expo-device` instalado
- [ ] `expo-constants` instalado
- [ ] Archivo `google-services.json` en raíz de `veciApp/`
- [ ] Archivo `GoogleService-Info.plist` en raíz de `veciApp/`
- [ ] `app.json` tiene plugins de notificaciones
- [ ] App rebuildeada (no Expo Go)

---

## 🧪 Primera Prueba

1. Abre la app rebuildeada en tu dispositivo Android
2. Inicia sesión
3. Acepta permisos de notificaciones
4. Desde Postman/Thunder Client:

```http
POST http://192.168.X.X:3000/api/notificaciones/test
Headers:
  Authorization: Bearer TU_TOKEN
```

5. ✅ Deberías recibir: "🔔 Notificación de Prueba"

---

**Si todo funciona, el sistema está 100% operativo! 🚀**

