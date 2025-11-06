# 🚨 Sistema de Reportes de Emprendimientos

## 📋 Descripción General

Sistema completo para que los usuarios puedan reportar emprendimientos que violen las políticas de veciApp, con seguimiento y gestión administrativa.

## 🗄️ Modelo de Datos

### Tabla: `reportes_emprendimientos`

```sql
CREATE TABLE reportes_emprendimientos (
  id SERIAL PRIMARY KEY,
  emprendimiento_id INTEGER REFERENCES emprendimientos(id),
  usuario_id BIGINT REFERENCES usuarios(id),
  categoria reporte_categoria,
  titulo VARCHAR(255),
  descripcion TEXT,
  descripcion_detallada TEXT,
  estado reporte_estado DEFAULT 'pendiente',
  respuesta_admin TEXT,
  admin_revisor_id BIGINT REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  revisado_at TIMESTAMP
);
```

### Enums

**reporte_categoria:**
- `contenido_inapropiado`
- `informacion_falsa`
- `productos_prohibidos`
- `suplantacion_identidad`
- `practicas_fraudulentas`
- `spam`
- `problemas_vendedor`
- `otro`

**reporte_estado:**
- `pendiente` - Recién creado, esperando revisión
- `revisado` - Admin lo ha visto
- `aceptado` - Reporte válido, se tomaron medidas
- `rechazado` - Reporte inválido o sin fundamento

## 🔐 Restricciones

1. **Constraint único**: Un usuario no puede reportar el mismo emprendimiento con la misma categoría múltiples veces en 24 horas
2. **Soft delete en cascada**: Si se elimina el emprendimiento, los reportes quedan huérfanos
3. **Referencia al admin revisor**: Se registra qué administrador procesó el reporte

## 🌐 Endpoints del Backend

### POST `/api/reportes`
**Auth:** Requerido (cualquier usuario)

**Body:**
```json
{
  "emprendimiento_id": 123,
  "categoria": "contenido_inapropiado",
  "titulo": "Contenido inapropiado",
  "descripcion": "Imágenes ofensivas...",
  "descripcion_detallada": "Opcional: detalles adicionales"
}
```

**Validaciones:**
- ✅ Emprendimiento debe existir
- ✅ No puede reportar dos veces en 24 horas (misma categoría)
- ✅ Campos requeridos

**Response:**
```json
{
  "ok": true,
  "mensaje": "Reporte enviado exitosamente...",
  "reporte": {...}
}
```

### GET `/api/reportes/mis-reportes`
**Auth:** Requerido

Obtiene todos los reportes que el usuario ha hecho.

**Response:**
```json
{
  "ok": true,
  "reportes": [
    {
      "id": 1,
      "emprendimiento_nombre": "Pizza Mario",
      "categoria": "spam",
      "estado": "revisado",
      ...
    }
  ]
}
```

### GET `/api/reportes/emprendimiento/:id`
**Auth:** Solo Admin

Obtiene todos los reportes de un emprendimiento específico.

### PATCH `/api/reportes/:id`
**Auth:** Solo Admin

Actualiza el estado de un reporte.

**Body:**
```json
{
  "estado": "aceptado",
  "respuesta_admin": "Se tomaron medidas correctivas..."
}
```

### GET `/api/reportes/estadisticas/:emprendimientoId`
**Auth:** Dueño del emprendimiento o Admin

Estadísticas de reportes por emprendimiento.

## 📱 Frontend - PedidoDetalleScreen.js

### Estados Agregados
```javascript
const [reportModalVisible, setReportModalVisible] = useState(false);
const [selectedReportReason, setSelectedReportReason] = useState(null);
const [reporteDetalle, setReporteDetalle] = useState('');
const [enviandoReporte, setEnviandoReporte] = useState(false);
```

### Categorías de Reporte (UI)

Cada categoría tiene:
- **ID**: Identificador único
- **Categoría**: Valor para el backend
- **Título**: Texto mostrado al usuario
- **Descripción**: Explicación detallada
- **Ícono**: Ionicon específico
- **Color**: Color representativo

### Flujo de Usuario

1. **Usuario toca botón "Reportar"** (🚩 en navbar)
2. **Se abre modal** con 8 categorías de reporte
3. **Selecciona una categoría** (con iconos y colores)
4. **Si selecciona "Otro"**: Aparece campo de texto obligatorio
5. **Toca "Enviar Reporte"**:
   - Valida que haya selección
   - Valida campo de texto si es "Otro"
   - Envía al backend
   - Muestra loading
   - Muestra confirmación
6. **Cierra automáticamente** y limpia el formulario

### Diseño del Modal

**Header con Gradiente:**
- Gradiente rojo (#e74c3c → #c0392b)
- Ícono de escudo
- Título y subtítulo en blanco
- Botón de cerrar

**Opciones de Reporte:**
- Tarjetas con ícono circular
- Borde que cambia de color al seleccionar
- Checkmark cuando está seleccionado
- Sombras sutiles

**Campo de Texto "Otro":**
- Aparece solo si se selecciona "Otro motivo"
- Placeholder descriptivo
- Mínimo 100px de alto
- Validación obligatoria

**Botones:**
- **Cancelar**: Gris con borde, ícono close-circle
- **Enviar Reporte**: Gradiente rojo, ícono send, loading state

## 🔒 Seguridad y Validaciones

### Backend:
1. ✅ Autenticación JWT requerida
2. ✅ Verificación de existencia de emprendimiento
3. ✅ Prevención de spam (límite 24 horas)
4. ✅ Validación de campos requeridos
5. ✅ Solo admins pueden actualizar/ver todos los reportes

### Frontend:
1. ✅ Validación de token antes de enviar
2. ✅ Validación de selección de categoría
3. ✅ Validación de descripción para "Otro"
4. ✅ Loading state durante envío
5. ✅ Manejo de errores con alerts

## 📊 Casos de Uso

### Usuario Normal:
- Reportar emprendimientos problemáticos
- Ver historial de sus reportes
- Ver estado de sus reportes (pendiente/revisado/etc)

### Emprendedor:
- Ver estadísticas de reportes de su emprendimiento
- Identificar problemas recurrentes
- Mejorar según feedback

### Administrador:
- Ver todos los reportes pendientes
- Revisar y clasificar reportes
- Tomar acciones (suspender, eliminar, advertir)
- Responder a reportes
- Ver historial completo

## 🎯 Mejoras Futuras Potenciales

1. **Notificaciones Push** cuando se resuelve un reporte
2. **Panel de Admin** para gestión masiva de reportes
3. **Sistema de strikes** (3 reportes aceptados = suspensión temporal)
4. **Filtros y búsqueda** en lista de reportes
5. **Exportación de reportes** a PDF/Excel para análisis
6. **Dashboard de moderación** con métricas en tiempo real
7. **Sistema de apelaciones** para emprendedores

## 📝 Notas Importantes

- Los reportes NO son anónimos, se registra qué usuario reportó
- Un usuario puede hacer múltiples reportes del mismo emprendimiento (diferentes categorías)
- Los reportes no afectan automáticamente al emprendimiento (requieren revisión admin)
- Se guarda timestamp de creación, actualización y revisión
- Los admins pueden dejar respuestas en los reportes

