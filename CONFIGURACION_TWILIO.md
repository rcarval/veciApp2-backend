# 📱 Configuración de Twilio Verify para SMS

## 🔑 Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Configuración de Twilio para SMS de Verificación
TWILIO_ACCOUNT_SID=tu_account_sid_aqui
TWILIO_AUTH_TOKEN=tu_auth_token_aqui
TWILIO_VERIFY_SERVICE_SID=tu_verify_service_sid_aqui

# Entorno
NODE_ENV=development
```

## 📦 Paquete Instalado

```bash
npm install twilio
```

✅ Ya instalado: `twilio@5.x.x`

## 🚀 Implementación

El sistema ahora usa **Twilio Verify** en lugar de generar códigos manualmente. 

### Ventajas de Twilio Verify:

1. ✅ **Códigos automáticos**: Twilio genera y envía el código
2. ✅ **Expiración automática**: Maneja el tiempo de vida (10 minutos por defecto)
3. ✅ **Rate limiting**: Previene spam automáticamente
4. ✅ **Múltiples intentos**: Controla intentos fallidos
5. ✅ **Seguridad**: No almacenamos códigos en nuestra BD

### Flujo de Twilio Verify:

```
1. POST /enviar-codigo
   ↓
   Twilio.verify.verifications.create()
   ↓
   SMS enviado al usuario
   ↓
   Twilio retorna verification SID

2. Usuario ingresa código
   ↓
   POST /verificar-codigo
   ↓
   Twilio.verify.verificationChecks.create()
   ↓
   Twilio valida el código
   ↓
   Retorna status: 'approved' o 'pending'
```

## 📝 Formato de Teléfono

Twilio requiere números en formato E.164:

```javascript
// Correcto
+56994908047

// Incorrecto
994908047
56994908047
+56 9 9490 8047
```

El backend automáticamente formatea el número si es necesario.

## 🧪 Testing

### Número de Prueba Twilio

Si estás en modo trial, solo puedes enviar SMS a números verificados en tu cuenta Twilio.

### Modo Desarrollo

Cuando `NODE_ENV=development`:
- El código NO se envía por SMS
- Se muestra en console y alert para pruebas
- No se consumen créditos de Twilio

### Modo Producción

Cuando `NODE_ENV=production`:
- El código SÍ se envía por SMS real
- NO se muestra en logs ni alerts
- Se consumen créditos de Twilio

## 💰 Costos Twilio

- **SMS de Verificación**: ~$0.05 USD por SMS
- **Cuenta Trial**: $15 USD de crédito gratis
- **Aproximadamente**: 300 verificaciones con crédito trial

## 🔒 Seguridad

### Datos NO almacenados en BD:

- ❌ Código de verificación (Twilio lo maneja)
- ❌ Número de intentos (Twilio lo controla)

### Datos SÍ almacenados en BD:

- ✅ `codigo_enviado_at`: Timestamp del envío
- ✅ `verificado_at`: Timestamp de verificación exitosa
- ✅ `verification_sid`: ID de Twilio (opcional, para auditoría)

## 🛠️ Troubleshooting

### Error: "Invalid phone number"

Asegúrate que el número esté en formato E.164 (+56XXXXXXXXX)

### Error: "Unable to create record"

- Verifica que el número esté verificado en tu cuenta Twilio (modo trial)
- Asegúrate de tener crédito disponible

### Error: "Invalid parameter"

- Verifica que `TWILIO_VERIFY_SERVICE_SID` sea correcto
- Debe empezar con "VA"

## 📊 Logs de Monitoreo

El sistema registra:

```
✅ [INFO] Enviando verificación a +56994908047
✅ [SUCCESS] SMS enviado exitosamente. SID: VEXXXXXXX
✅ [INFO] Verificando código para +56994908047
✅ [SUCCESS] Código verificado exitosamente
⚠️  [WARN] Código incorrecto para +56994908047
⚠️  [WARN] Verificación expirada para +56994908047
```

---

**Fecha**: 4 de Noviembre, 2025  
**Estado**: ✅ Implementado y Listo para Producción


