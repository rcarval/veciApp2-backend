# Sistema de Activación de Vendedores por Email

## 📋 Descripción General

Este sistema permite activar cuentas de vendedor mediante un enlace enviado por correo electrónico usando Mailtrap/SMTP.

## 🔄 Flujo de Activación

### 1. Creación del Vendedor (Emprendedor)
El emprendedor crea una cuenta de vendedor desde la app:
- Ingresa nombre, correo y contraseña del vendedor
- El sistema genera un token de activación único
- Se crea el vendedor con estado `pendiente_activacion`
- Se envía un correo con el enlace de activación
- Token válido por **24 horas**

### 2. Activación de Cuenta (Vendedor)
El vendedor recibe el correo y activa su cuenta:
- Hace clic en el enlace del correo
- El sistema verifica el token
- Si es válido, activa la cuenta (estado `activo`)
- Se envía correo de confirmación
- El vendedor puede iniciar sesión

### 3. Expiración del Token
Si el token expira (24 horas):
- El vendedor no podrá activar su cuenta
- Debe contactar al emprendedor
- El emprendedor puede eliminar y crear un nuevo vendedor

## 🗄️ Cambios en la Base de Datos

### Nuevas Columnas en `usuarios`
```sql
- token_activacion (VARCHAR 64): Token único para activar cuenta
- token_activacion_expira (TIMESTAMP): Fecha de expiración del token
```

### Nuevo Estado en `usuario_estado` ENUM
```sql
- 'pendiente_activacion': Vendedor creado pero no activado
```

### Índice para Performance
```sql
- idx_usuarios_token_activacion: Búsqueda rápida por token
```

## 📡 Endpoints del Backend

### POST `/api/emprendimientos/:id/vendedor`
Crear vendedor y enviar correo de activación.

**Request:**
```json
{
  "nombre": "Juan Pérez",
  "correo": "juan@ejemplo.com",
  "contrasena": "password123"
}
```

**Response:**
```json
{
  "ok": true,
  "mensaje": "Vendedor creado exitosamente. Se ha enviado un correo de activación.",
  "vendedor": {
    "id": 123,
    "nombre": "Juan Pérez",
    "correo": "juan@ejemplo.com",
    "estado": "pendiente_activacion"
  }
}
```

### GET `/api/emprendimientos/activar-vendedor/:token`
Activar cuenta de vendedor con token (sin autenticación).

**Parámetros:**
- `token`: Token de activación recibido por email

**Response Exitosa:**
```json
{
  "ok": true,
  "mensaje": "Cuenta activada exitosamente. Ya puedes iniciar sesión en la aplicación.",
  "vendedor": {
    "nombre": "Juan Pérez",
    "correo": "juan@ejemplo.com"
  }
}
```

**Response Error (Token Expirado):**
```json
{
  "ok": false,
  "error": "El enlace de activación ha expirado. Por favor contacta al administrador."
}
```

### GET `/api/emprendimientos/:id/vendedor`
Obtener vendedor de un emprendimiento (incluye estado de activación).

**Response:**
```json
{
  "ok": true,
  "vendedor": {
    "id": 123,
    "nombre": "Juan Pérez",
    "correo": "juan@ejemplo.com",
    "estado": "pendiente_activacion",
    "email_verificado": false
  }
}
```

## 📧 Plantillas de Email

### Email de Activación
```
Asunto: 🎉 Activa tu cuenta de Vendedor en VeciApp

Hola [Nombre],

¡Bienvenido a VeciApp! 🎊

Has sido invitado a ser vendedor del emprendimiento "[Nombre Emprendimiento]".

Para activar tu cuenta y comenzar a gestionar pedidos, haz clic en el siguiente enlace:

[Enlace de Activación]

⚠️ Este enlace expirará en 24 horas.

Una vez activada tu cuenta, podrás:
✅ Ver y gestionar todos los pedidos del emprendimiento
✅ Cambiar estados de pedidos
✅ Comunicarte con los clientes

---
VeciApp - Tu comunidad, más conectada
```

### Email de Confirmación
```
Asunto: ✅ Cuenta Activada - VeciApp

Hola [Nombre],

¡Tu cuenta de vendedor ha sido activada exitosamente! 🎉

Ya puedes iniciar sesión en VeciApp usando:
📧 Correo: [correo]
🔑 Contraseña: La que configuraste al registrarte

Ahora puedes gestionar los pedidos del emprendimiento asignado.

---
VeciApp - Tu comunidad, más conectada
```

## 🎨 Frontend

### Vista de Vendedor Existente
- Muestra badge de estado (Activo / Pendiente)
- Icono diferente según estado (checkmark / reloj)
- Color distintivo (verde / naranja)
- Mensaje informativo sobre activación pendiente

### Mensaje al Crear Vendedor
```
✅ Vendedor Creado

El vendedor ha sido creado exitosamente.

📧 Se ha enviado un correo de activación a:
[correo]

⚠️ El vendedor debe activar su cuenta haciendo clic 
en el enlace del correo antes de poder iniciar sesión.
```

## 🔒 Seguridad

1. **Token Único**: Cada vendedor tiene un token único generado con `crypto.randomBytes(32)`
2. **Expiración**: Los tokens expiran en 24 horas
3. **Un Solo Uso**: El token se elimina después de la activación
4. **Estado Verificado**: Solo vendedores con `estado = 'pendiente_activacion'` pueden ser activados
5. **Correo Único**: No se permite más de un usuario con el mismo correo electrónico
   - Validación a nivel de aplicación (antes de INSERT)
   - Restricción UNIQUE a nivel de base de datos (índice único)
   - Aplica para todos los tipos de usuario (cliente, emprendedor, vendedor, admin)

## 🛠️ Configuración Requerida

### Variables de Entorno (.env)
```env
# Configuración de Mailtrap
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USER=tu_usuario_mailtrap
MAILTRAP_PASS=tu_password_mailtrap
MAILTRAP_NAME=VeciApp
MAILTRAP_FROM=noreply@veciapp.test

# URL del Frontend para generar enlaces
FRONTEND_URL=http://localhost:19006
```

## 📝 Ejecutar Migraciones

### Paso 1: Actualizar Schema de Vendedores
Para agregar los campos necesarios a la base de datos:

```bash
cd veciApp2-backend
psql -U tu_usuario -d tu_base_de_datos -f ACTUALIZAR_VENDEDORES.sql
```

Este script:
- ✅ Agrega columnas `token_activacion` y `token_activacion_expira`
- ✅ Crea índice para búsqueda rápida por token
- ✅ Crea índice UNIQUE para correos (previene duplicados)
- ✅ Agrega estado `pendiente_activacion` al ENUM

### Paso 2: Verificar Unicidad de Correos (Opcional)
Si quieres verificar que no hay correos duplicados en tu base de datos actual:

```bash
psql -U tu_usuario -d tu_base_de_datos -f AGREGAR_UNIQUE_EMAIL.sql
```

Este script te mostrará si hay correos duplicados antes de crear el índice UNIQUE.

### Ejecución Manual (Alternativa)
Si prefieres ejecutar manualmente:

```sql
-- 1. Agregar columnas
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS token_activacion VARCHAR(64),
ADD COLUMN IF NOT EXISTS token_activacion_expira TIMESTAMP;

-- 2. Crear índice de token
CREATE INDEX IF NOT EXISTS idx_usuarios_token_activacion 
ON usuarios(token_activacion) 
WHERE token_activacion IS NOT NULL;

-- 3. Crear índice UNIQUE de correo
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_correo_unique 
ON usuarios (LOWER(correo));

-- 4. Agregar estado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pendiente_activacion' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'usuario_estado')
    ) THEN
        ALTER TYPE usuario_estado ADD VALUE 'pendiente_activacion';
    END IF;
END$$;
```

## ✅ Verificación

### Probar el Sistema
1. Crear un vendedor desde la app
2. Verificar que se recibe el correo en Mailtrap
3. Copiar el enlace de activación del correo
4. Visitar el enlace en el navegador
5. Verificar que la cuenta se activa
6. Intentar iniciar sesión con las credenciales

### Ver Logs
```bash
# En el backend verás:
✓ Vendedor creado: ID 123
📧 Correo de activación enviado a juan@ejemplo.com
✅ Vendedor activado: Juan Pérez (juan@ejemplo.com)
```

## 🐛 Solución de Problemas

### "El correo ya está registrado"
Este error aparece cuando intentas crear un vendedor con un correo que ya está en uso.

**Causa:**
- El correo ya está asociado a otro usuario (cliente, emprendedor, vendedor o admin)
- La base de datos tiene un índice UNIQUE que previene correos duplicados

**Solución:**
- Usar un correo diferente
- Si es el mismo vendedor, eliminarlo y crearlo nuevamente
- No se puede tener el mismo correo para múltiples tipos de usuario

**Verificación de correos duplicados:**
```sql
-- Ver si hay correos duplicados
SELECT LOWER(correo), COUNT(*) as cantidad
FROM usuarios
GROUP BY LOWER(correo)
HAVING COUNT(*) > 1;
```

### El correo no llega
- Verificar variables de entorno de Mailtrap
- Revisar logs del backend para errores
- Verificar que Mailtrap esté configurado correctamente
- Revisar la bandeja de spam/correo no deseado

### El enlace no funciona
- Verificar que el token no haya expirado (24 horas)
- Verificar que el vendedor esté en estado `pendiente_activacion`
- Verificar que FRONTEND_URL esté correctamente configurado
- Copiar y pegar el enlace completo (no debe truncarse)

### Error al activar
- El token puede haber sido usado
- El vendedor puede haber sido eliminado
- El token puede haber expirado
- El estado del vendedor no es `pendiente_activacion`

## 📚 Recursos

- Mailtrap: https://mailtrap.io/
- Nodemailer: https://nodemailer.com/
- Crypto (Node.js): https://nodejs.org/api/crypto.html

