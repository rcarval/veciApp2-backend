# 📊 Sistema de Estadísticas Avanzadas

## 🎯 Objetivo

Proporcionar al emprendedor **datos accionables** y **recomendaciones automáticas** para mejorar su negocio basándose en el análisis de:
- Rendimiento de pedidos
- Tiempos de entrega
- Motivos de rechazo
- Productos más vendidos
- Horarios pico
- Comportamiento de clientes
- Conversión de visitas

---

## 📡 Endpoint

```
GET /api/estadisticas-avanzadas/:emprendimientoId?periodo=mes
```

### Parámetros:
- **emprendimientoId** (path): ID del emprendimiento
- **periodo** (query): `año`, `mes`, `semana`, `dia` (default: `mes`)

### Respuesta:
```json
{
  "ok": true,
  "estadisticas": {
    "periodo": "Último mes",
    "rendimiento": {...},
    "rechazos": {...},
    "productos": {...},
    "categorias_vendidas": [...],
    "horarios_pico": [...],
    "dias_semana": [...],
    "clientes": {...},
    "visualizaciones": {...}
  },
  "insights": [...],
  "recomendaciones": [...]
}
```

---

## 📊 Métricas Disponibles

### 1. Rendimiento General

```javascript
rendimiento: {
  total_pedidos: 150,
  pedidos_entregados: 130,
  pedidos_rechazados: 15,
  pedidos_cancelados: 5,
  tasa_exito: 86.7,              // % entregados
  tasa_rechazo: 10.0,            // % rechazados
  ingresos_totales: 4500000,     // Total ganado
  ticket_promedio: 34615,        // Promedio por pedido
  tiempo_entrega_promedio: 45,   // Minutos
  cumplimiento_tiempo: 85.5      // % entregados a tiempo
}
```

**Utilidad:**
- **Tasa de éxito > 85%** = Buen desempeño
- **Tasa de rechazo > 15%** = Hay problemas
- **Ticket promedio** = Ayuda a fijar precios
- **Cumplimiento de tiempo** = Mide confiabilidad

---

### 2. Análisis de Rechazos

```javascript
rechazos: {
  top_motivos: [
    {
      motivo: "Producto agotado",
      cantidad: 8,
      porcentaje: 53.3
    },
    {
      motivo: "No puedo cumplir con el horario",
      cantidad: 5,
      porcentaje: 33.3
    },
    {
      motivo: "Fuera de zona de entrega",
      cantidad: 2,
      porcentaje: 13.3
    }
  ]
}
```

**Utilidad:**
- Identificar problemas recurrentes
- Priorizar mejoras
- Reducir tasa de rechazo

---

### 3. Productos Más Vendidos

```javascript
productos: {
  total_productos: 25,
  productos_activos: 22,
  productos_inactivos: 3,
  por_categoria: {
    principal: 10,
    secundario: 12,
    oferta: 3
  },
  top_vendidos: [
    {
      nombre: "Pizza Napolitana",
      cantidad_vendida: 45,
      ingresos: 450000,
      num_pedidos: 38
    },
    {
      nombre: "Empanadas de Queso",
      cantidad_vendida: 120,
      ingresos: 180000,
      num_pedidos: 25
    }
  ]
}
```

**Utilidad:**
- Identificar productos estrella
- Optimizar inventario
- Crear promociones enfocadas

---

### 4. Categorías Más Vendidas

```javascript
categorias_vendidas: [
  {
    categoria: "principal",
    pedidos: 85,
    unidades: 165,
    ingresos: 3200000
  },
  {
    categoria: "oferta",
    pedidos: 45,
    unidades: 95,
    ingresos: 950000
  },
  {
    categoria: "secundario",
    pedidos: 20,
    unidades: 35,
    ingresos: 350000
  }
]
```

**Utilidad:**
- Entender qué tipo de productos prefieren
- Ajustar estrategia de categorización
- Balancear oferta

---

### 5. Horarios Pico

```javascript
horarios_pico: [
  {
    hora: 19,
    pedidos: 25,
    ingresos: 750000
  },
  {
    hora: 20,
    pedidos: 22,
    ingresos: 680000
  },
  {
    hora: 13,
    pedidos: 18,
    ingresos: 540000
  }
]
```

**Utilidad:**
- Planificar promociones en horarios pico
- Asignar vendedores en horas críticas
- Optimizar tiempos de preparación

---

### 6. Días de la Semana

```javascript
dias_semana: [
  {
    dia: "Saturday",
    dia_numero: 6,
    pedidos: 45,
    ingresos: 1350000
  },
  {
    dia: "Sunday",
    dia_numero: 0,
    pedidos: 42,
    ingresos: 1260000
  }
]
```

**Utilidad:**
- Identificar días con más demanda
- Planificar inventario
- Ajustar horarios de atención

---

### 7. Análisis de Clientes

```javascript
clientes: {
  clientes_unicos: 85,
  clientes_recurrentes: 32,
  tasa_recurrencia: 37.6      // % que vuelven
}
```

**Utilidad:**
- **Tasa > 40%** = Buena fidelización
- **Tasa < 30%** = Mejorar experiencia
- Identificar oportunidades de loyalty

---

### 8. Conversión de Visitas

```javascript
visualizaciones: {
  total_periodo: 850,
  tasa_conversion: 17.6        // % visitas → pedidos
}
```

**Utilidad:**
- **Tasa > 10%** = Buena conversión
- **Tasa < 5%** = Mejorar presentación
- Medir efectividad de marketing

---

## 🧠 Insights Automáticos

El sistema genera insights automáticamente según los datos:

### Tipos de Insights:

#### 1. Alertas (Rojo) 🚨
```javascript
{
  tipo: 'alerta',
  titulo: 'Baja tasa de éxito',
  descripcion: 'Tu tasa de entrega es 65%. Deberías apuntar a más del 85%.',
  icono: 'warning'
}
```

**Se genera cuando:**
- Tasa de éxito < 70%
- Tasa de rechazo > 15%

#### 2. Advertencias (Naranja) ⚠️
```javascript
{
  tipo: 'advertencia',
  titulo: 'Retrasos en entregas',
  descripcion: 'Solo cumples el 70% de los tiempos prometidos.',
  icono: 'time'
}
```

**Se genera cuando:**
- Cumplimiento de tiempo < 80%
- Baja conversión (< 5%) con muchas visitas

#### 3. Información (Azul) ℹ️
```javascript
{
  tipo: 'info',
  titulo: 'Pocos productos',
  descripcion: 'Solo tienes 3 productos. Más variedad = más ventas.',
  icono: 'cube'
}
```

**Se genera cuando:**
- Total productos < 5
- Sin productos activos

#### 4. Éxitos (Verde) ✅
```javascript
{
  tipo: 'exito',
  titulo: '¡Excelente desempeño!',
  descripcion: 'Tienes una tasa de éxito de 95%. ¡Sigue así!',
  icono: 'trophy'
}
```

**Se genera cuando:**
- Tasa de éxito >= 90%
- Buena conversión (> 10%)
- Horario pico identificado

---

## 💡 Recomendaciones Automáticas

Basadas en el análisis de datos:

### Ejemplos:

1. **Por baja tasa de éxito:**
   - "Revisa los motivos de rechazo más comunes y trabaja en mejorarlos"

2. **Por retrasos:**
   - "Considera aumentar el tiempo de entrega comprometido para ser más realista"

3. **Por rechazo principal:**
   - "Tu motivo principal de rechazo es 'Producto agotado'. Trabaja en mejorarlo."

4. **Por pocos productos:**
   - "Agrega más productos para aumentar tus oportunidades de venta"

5. **Por horario pico:**
   - "Considera promocionar productos durante las 19:00 hrs"

6. **Por baja conversión:**
   - "Mejora las fotos y descripciones de tus productos para aumentar conversión"

---

## 🎨 Visualización Recomendada

### 1. Dashboard Principal
```
┌────────────────────────────────────┐
│  📊 Estadísticas - Último mes      │
└────────────────────────────────────┘

┌─────────┐ ┌─────────┐ ┌─────────┐
│ 130     │ │ $4.5M   │ │ 86.7%   │
│ Pedidos │ │ Ingresos│ │ Éxito   │
└─────────┘ └─────────┘ └─────────┘

🏆 Insights (3)
├─ ✅ Excelente desempeño (95% éxito)
├─ ⚠️ Retrasos en entregas (70%)
└─ 📊 Horario pico: 19:00 hrs

💡 Recomendaciones (2)
├─ Aumenta tiempo de entrega comprometido
└─ Promociona durante horario pico
```

### 2. Análisis de Rechazos
```
📋 Motivos de Rechazo

53.3% Producto agotado          [████████░░]
33.3% No puedo cumplir horario  [█████░░░░░]
13.3% Fuera de zona            [██░░░░░░░░]
```

### 3. Productos Top
```
🏆 Top 5 Productos

1. Pizza Napolitana
   45 vendidas | $450.000 | 38 pedidos

2. Empanadas de Queso  
   120 vendidas | $180.000 | 25 pedidos
```

### 4. Horarios Pico
```
🕐 Mejores Horarios

19:00 ████████████ 25 pedidos
20:00 ██████████░░ 22 pedidos
13:00 ████████░░░░ 18 pedidos
```

---

## 🔧 Implementación Frontend

### Uso del Endpoint:

```javascript
import { API_ENDPOINTS } from '../config/api';

// Obtener estadísticas del último mes
const response = await fetch(
  API_ENDPOINTS.ESTADISTICAS_AVANZADAS(emprendimientoId, 'mes'),
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);

const { estadisticas, insights, recomendaciones } = await response.json();
```

### Componentes Sugeridos:

1. **Card de Métrica:** Para mostrar KPIs principales
2. **Card de Insight:** Para mostrar análisis automáticos
3. **Lista de Recomendaciones:** Accionables
4. **Gráfico de Barras:** Top productos, horarios
5. **Gráfico de Torta:** Categorías vendidas
6. **Timeline:** Evolución temporal

---

## 📈 Datos Calculados

### Fórmulas:

**Tasa de Éxito:**
```
(pedidos_entregados / total_pedidos) * 100
```

**Tasa de Rechazo:**
```
(pedidos_rechazados / total_pedidos) * 100
```

**Cumplimiento de Tiempo:**
```
(entregas_a_tiempo / total_entregas) * 100
```

**Tasa de Conversión:**
```
(total_pedidos / total_visualizaciones) * 100
```

**Tasa de Recurrencia:**
```
(clientes_recurrentes / clientes_unicos) * 100
```

---

## 🎯 Benchmarks

### Tasa de Éxito:
- 🔴 < 70%: Crítico
- 🟡 70-85%: Regular
- 🟢 85-95%: Bueno
- 🏆 > 95%: Excelente

### Cumplimiento de Tiempo:
- 🔴 < 70%: Crítico
- 🟡 70-85%: Regular
- 🟢 85-95%: Bueno
- 🏆 > 95%: Excelente

### Tasa de Conversión:
- 🔴 < 3%: Baja
- 🟡 3-8%: Regular
- 🟢 8-15%: Buena
- 🏆 > 15%: Excelente

### Tasa de Recurrencia:
- 🔴 < 20%: Baja fidelización
- 🟡 20-35%: Regular
- 🟢 35-50%: Buena
- 🏆 > 50%: Excelente

---

## 💾 Tablas Utilizadas

### transaccion_comercial
- `estado`: entregado, rechazado, cancelado
- `total`: Monto del pedido
- `tiempo_entrega_minutos`: Tiempo real de entrega
- `motivo_rechazo`: Razón del rechazo
- `detalle`: JSONB con productos
- `created_at`: Fecha/hora del pedido

### productos
- `categoria`: principal, secundario, oferta
- `activo`: true/false
- `precio`: Precio del producto

### emprendimientos
- `tiempo_preparacion`: Tiempo comprometido

### visualizaciones_diarias
- `contador`: Número de visualizaciones
- `fecha`: Fecha

---

## 🧠 Lógica de Insights

### Algoritmo:

```javascript
if (tasa_exito < 70%) {
  → Alerta: "Baja tasa de éxito"
  → Recomendación: "Revisa motivos de rechazo"
}

if (tasa_exito >= 90%) {
  → Éxito: "¡Excelente desempeño!"
}

if (cumplimiento_tiempo < 80%) {
  → Advertencia: "Retrasos en entregas"
  → Recomendación: "Aumenta tiempo comprometido"
}

if (tasa_rechazo > 15%) {
  → Advertencia: "Alta tasa de rechazo"
  → Recomendación según motivo principal
}

if (total_productos < 5) {
  → Info: "Pocos productos"
  → Recomendación: "Agrega más productos"
}

if (tasa_conversion < 5% AND visitas > 20) {
  → Advertencia: "Baja conversión"
  → Recomendación: "Mejora fotos y descripciones"
}

if (tasa_conversion > 10%) {
  → Éxito: "Buena conversión"
}
```

---

## 📱 Pantalla Propuesta

### Diseño Visual:

```
┌────────────────────────────────────────┐
│  [Gradiente Verde]                     │
│  📊 Estadísticas                       │
│     Analiza tu rendimiento             │
└────────────────────────────────────────┘

[Selector: Año | Mes | Semana | Día]

┌──── KPIs Principales ────────────────┐
│  130        $4.5M       86.7%        │
│  Pedidos    Ingresos    Éxito        │
└──────────────────────────────────────┘

┌──── 🧠 Insights (3) ─────────────────┐
│                                      │
│  ✅ ¡Excelente desempeño!           │
│     Tasa de éxito de 95%            │
│                                      │
│  ⚠️ Retrasos en entregas            │
│     Solo cumples 70% de tiempos     │
│                                      │
│  🏆 Horario pico identificado       │
│     19:00 hrs - 25 pedidos          │
└──────────────────────────────────────┘

┌──── 💡 Recomendaciones (2) ──────────┐
│  • Aumenta tiempo de entrega        │
│    comprometido                      │
│  • Promociona durante 19:00 hrs     │
└──────────────────────────────────────┘

┌──── 🏆 Top Productos ────────────────┐
│  1. Pizza Napolitana                │
│     45 vendidas | $450.000          │
│                                      │
│  2. Empanadas de Queso              │
│     120 vendidas | $180.000         │
└──────────────────────────────────────┘

┌──── 📋 Motivos de Rechazo ───────────┐
│  53% Producto agotado    ████████   │
│  33% No puedo cumplir    █████      │
│  13% Fuera de zona       ██         │
└──────────────────────────────────────┘

┌──── 🕐 Horarios Pico ────────────────┐
│  19:00  ████████████  25 pedidos    │
│  20:00  ██████████    22 pedidos    │
│  13:00  ████████      18 pedidos    │
└──────────────────────────────────────┘

┌──── 👥 Clientes ─────────────────────┐
│  85 únicos | 32 recurrentes         │
│  Tasa de fidelización: 37.6%        │
└──────────────────────────────────────┘

┌──── 📈 Conversión ───────────────────┐
│  850 visitas → 130 pedidos          │
│  Tasa de conversión: 15.3%          │
└──────────────────────────────────────┘
```

---

## 🚀 Beneficios

### Para el Emprendedor:
1. **Decisiones basadas en datos** (no intuición)
2. **Identificar problemas** antes de que escalen
3. **Optimizar operación** (horarios, inventario)
4. **Aumentar ventas** (enfoque en lo que funciona)
5. **Mejorar experiencia** (reducir rechazos)

### Para VeciApp:
1. **Valor agregado** claro del Plan Premium
2. **Diferenciación** vs competencia
3. **Retención** de usuarios (ven valor)
4. **Crecimiento** de GMV (emprendedores venden más)

---

## 📊 Estructura de Datos

### Modelo ER Simplificado:

```
transaccion_comercial
├─ id
├─ estado (entregado, rechazado, cancelado)
├─ total
├─ tiempo_entrega_minutos
├─ motivo_rechazo
├─ detalle (JSONB)
│  └─ [{nombre, cantidad, subtotal, producto_id, precio_unitario}]
└─ created_at

productos
├─ id
├─ nombre
├─ categoria (principal, secundario, oferta)
├─ activo
└─ emprendimiento_id

visualizaciones_diarias
├─ emprendimiento_id
├─ fecha
└─ contador
```

---

## ✅ Ventajas del Sistema

| Aspecto | Estadísticas Básicas | Estadísticas Avanzadas |
|---------|---------------------|------------------------|
| **Pedidos** | Total, promedio | Por estado, tasa de éxito |
| **Rechazos** | No | Top motivos con % |
| **Productos** | No | Top vendidos + categorías |
| **Tiempos** | No | Cumplimiento real |
| **Horarios** | No | Horarios pico + días |
| **Clientes** | No | Únicos + recurrentes |
| **Conversión** | No | Visitas → Pedidos |
| **Insights** | No | Automáticos |
| **Recomendaciones** | No | Accionables |

---

**Sistema completo de estadísticas listo para implementar en el frontend** 📊✨

