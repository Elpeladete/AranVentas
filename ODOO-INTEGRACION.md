# 🔄 Integración con Odoo FSM - ARAN Tecnologías

## 📋 Resumen

La aplicación AranServices ahora se integra completamente con Odoo Field Service Management (FSM) para sincronizar automáticamente las órdenes de servicio capturadas en el campo.

---

## ✨ Características Implementadas

### 1. **Sincronización Automática**
- ✅ Las órdenes se sincronizan automáticamente con Odoo FSM después de enviarse a Google Forms
- ✅ Búsqueda o creación automática de clientes (partners) en Odoo
- ✅ Conversión automática de datos del formulario al formato Odoo
- ✅ Sincronización de repuestos/insumos como líneas de orden
- ✅ Manejo robusto de errores (si Odoo falla, no afecta Google Forms)

### 2. **Gestión de Clientes**
- ✅ Búsqueda de clientes existentes por CUIT o Razón Social
- ✅ Creación automática de nuevos clientes si no existen
- ✅ Sincronización de datos de contacto (teléfono, dirección, etc.)

### 3. **Datos Sincronizados**
- Número de orden
- Fecha del servicio
- Cliente (partner_id)
- Técnico asignado
- Descripción del servicio
- Ubicación (localidad + provincia)
- Firmas digitales (URLs de ImgBB)
- Imagen de la orden completa (URL de ImgBB)
- Repuestos e insumos utilizados

---

## 🔧 Configuración

### **Paso 1: Crear archivo .env.local**

Copia el archivo `.env.local.example` a `.env.local`:

```bash
cp .env.local.example .env.local
```

### **Paso 2: Configurar Credenciales de Odoo**

Edita `.env.local` con tus credenciales:

```env
# URL de tu instancia de Odoo (sin barra al final)
NEXT_PUBLIC_ODOO_URL=https://tuempresa.odoo.com

# Nombre de tu base de datos
NEXT_PUBLIC_ODOO_DATABASE=tuempresa_db

# Usuario con permisos para FSM
NEXT_PUBLIC_ODOO_USERNAME=admin@tuempresa.com

# Contraseña del usuario
NEXT_PUBLIC_ODOO_PASSWORD=tu_contraseña_segura

# API Key (opcional, para REST API)
NEXT_PUBLIC_ODOO_API_KEY=tu_api_key_opcional
```

### **Paso 3: Permisos en Odoo**

El usuario configurado debe tener permisos para:
- ✅ Crear y leer órdenes de venta (`sale.order`)
- ✅ Crear y leer clientes (`res.partner`)
- ✅ Crear líneas de orden (`sale.order.line`)
- ✅ Buscar productos (`product.product`)

En Odoo, asigna el grupo **"Sales / Administrator"** o **"Field Service / Manager"**.

---

## 🧪 Probar la Conexión

### **Método 1: Componente de Prueba**

Agrega el componente `OdooConnectionTest` a cualquier página:

```tsx
import { OdooConnectionTest } from '@/components/odoo-connection-test'

export default function TestPage() {
  return (
    <div className="p-8">
      <h1>Prueba de Conexión Odoo</h1>
      <OdooConnectionTest />
    </div>
  )
}
```

### **Método 2: Desde la Consola del Navegador**

```javascript
// En la consola del navegador (F12)
import { testOdooConnection } from '@/lib/odoo-service'

const result = await testOdooConnection()
console.log(result)
```

---

## 📡 Flujo de Sincronización

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuario completa orden de servicio en el campo              │
│    → Captura firmas y fotos offline                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Orden guardada localmente (IndexedDB + LocalStorage)        │
│    → Estado: "pending-offline"                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Cuando vuelve internet: Auto-sync se activa                 │
│    → Verificación real de conectividad                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Subida de imágenes a ImgBB                                  │
│    ✅ Imagen de la orden completa                               │
│    ✅ Firma del técnico                                         │
│    ✅ Firma del cliente                                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Envío a Google Forms                                        │
│    → Todas las URLs de ImgBB incluidas                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Sincronización con Odoo FSM 🆕                              │
│    → Búsqueda/creación de cliente                              │
│    → Creación de orden de servicio                             │
│    → Adición de líneas de orden (repuestos)                    │
│    → Sincronización de firmas e imágenes                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Actualización de BD local                                   │
│    → Estado: "sent"                                            │
│    → URLs de ImgBB guardadas                                   │
│    → Timestamp de sincronización                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Logging y Monitoreo

La sincronización con Odoo incluye logging detallado en la consola:

```
🔄 Sincronizando orden de servicio con Odoo FSM...
🔍 Buscando cliente por CUIT: 20-12345678-9
✅ Cliente encontrado en Odoo: ID 42
📤 Creando orden de servicio en Odoo
✅ Orden de servicio creada en Odoo: ID 123
✅ Línea agregada: Repuesto A x 2
✅ Línea agregada: Repuesto B x 1
```

---

## 🛡️ Manejo de Errores

### **Sincronización No Crítica**

Si Odoo falla, la sincronización con Google Forms **NO se ve afectada**:

- ✅ Google Forms se completa exitosamente
- ⚠️ Error de Odoo se registra en consola
- ✅ La orden se marca como "enviada"
- ℹ️ Se puede reintentar la sincronización con Odoo manualmente

### **Errores Comunes**

| Error | Causa | Solución |
|-------|-------|----------|
| "No se pudo conectar con Odoo" | Credenciales incorrectas o servidor inaccesible | Verificar `.env.local` |
| "Cliente no encontrado" | CUIT o Razón Social incorrectos | Verificar datos del formulario |
| "Sin acceso a órdenes de servicio" | Permisos insuficientes | Asignar grupo "Sales / Administrator" |
| "Producto no encontrado" | Repuesto no existe en catálogo Odoo | Crear producto en Odoo primero |

---

## 📊 Verificar en Odoo

Después de sincronizar, verifica en Odoo:

1. **Clientes (Partners)**:
   - Menú → Ventas → Clientes
   - Buscar por CUIT o Razón Social

2. **Órdenes de Servicio**:
   - Menú → Ventas → Órdenes de Venta
   - Filtrar por número de orden

3. **Field Service**:
   - Menú → Field Service → Órdenes de Trabajo
   - Ver tareas asignadas a técnicos

---

## 🔄 Sincronización Manual

Si necesitas sincronizar una orden específica manualmente:

```typescript
import { syncServiceOrderToOdoo } from '@/lib/odoo-service'

// Obtener datos del formulario
const formData = { /* ... */ }

// Sincronizar
const result = await syncServiceOrderToOdoo(formData)

if (result.success) {
  console.log(`Orden creada: ID ${result.orderId}`)
} else {
  console.error(`Error: ${result.error}`)
}
```

---

## 🎯 Modelos de Odoo Utilizados

### **res.partner** (Clientes)
```typescript
{
  name: string          // Razón Social
  phone: string         // Teléfono
  vat: string           // CUIT
  city: string          // Localidad
  state_id: number      // Provincia (ID)
  country_id: number    // País (ID)
}
```

### **sale.order** (Órdenes de Servicio)
```typescript
{
  name: string          // Número de orden
  partner_id: number    // ID del cliente
  date_order: string    // Fecha (YYYY-MM-DD)
  description: string   // Descripción del servicio
  fsm_location: string  // Ubicación
  fsm_done: boolean     // Completado
  // Campos custom ARAN
  tecnico_nombre: string
  tecnico_firma: string  // URL ImgBB
  cliente_firma: string  // URL ImgBB
  orden_imagen: string   // URL ImgBB
}
```

### **sale.order.line** (Líneas de Orden - Repuestos)
```typescript
{
  order_id: number          // ID de la orden
  product_id: number        // ID del producto
  product_uom_qty: number   // Cantidad
  price_unit: number        // Precio unitario
  name: string              // Descripción
}
```

---

## 🚀 Próximas Mejoras

- [ ] Sincronización bidireccional (Odoo → App)
- [ ] Actualización de estado desde Odoo
- [ ] Notificaciones push cuando se actualiza en Odoo
- [ ] Sincronización de horarios de técnicos
- [ ] Asignación automática de técnicos basada en ubicación
- [ ] Gestión de inventario en tiempo real

---

## 📞 Soporte

Para más información sobre Odoo FSM:
- Documentación oficial: https://www.odoo.com/documentation/
- Soporte Odoo: https://www.odoo.com/help

---

**¡La integración con Odoo FSM está lista! 🎉**
