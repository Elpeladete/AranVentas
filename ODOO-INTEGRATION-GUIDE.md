# 🔗 Integración con Odoo - Búsqueda Inteligente de Contactos

## 🎯 Funcionalidad

Esta integración permite **buscar automáticamente contactos en tu sistema Odoo** cuando escribes la razón social en el formulario de órdenes de servicio. Al seleccionar un contacto, se **autocompletan automáticamente** los siguientes campos:

- ✅ **Razón Social** - Nombre del contacto/empresa
- ✅ **CUIT** - Número de identificación fiscal  
- ✅ **Teléfono** - Número de contacto principal
- ✅ **Contacto** - Persona de contacto (si es empresa)
- ✅ **Localidad** - Ciudad del contacto

## 🚀 Configuración Inicial

### 1. **Configurar Variables de Entorno**

Copia el archivo `.env.example` como `.env.local` y completa las siguientes variables:

```bash
# Configuración de Odoo
NEXT_PUBLIC_ODOO_URL=https://tu-instancia.odoo.com
NEXT_PUBLIC_ODOO_DB=tu_base_de_datos  
NEXT_PUBLIC_ODOO_USER=tu_usuario
NEXT_PUBLIC_ODOO_PASSWORD=tu_contraseña_o_api_key
```

### 2. **Permisos Necesarios en Odoo**

El usuario configurado debe tener **permisos de lectura** en el modelo `res.partner` (Contactos). Verifica en Odoo:

- **Settings** → **Users & Companies** → **Users**
- Selecciona tu usuario → pestaña **Access Rights**
- Debe tener al menos el grupo **Sales / User** o **Base / User**

### 3. **Verificar XML-RPC Habilitado**

Asegúrate de que tu instancia de Odoo permita conexiones XML-RPC (habilitado por defecto).

## 🎨 Cómo Usar

### 1. **Búsqueda Automática**
1. Haz clic en el campo **"Razón Social"** del formulario
2. Comienza a escribir el nombre del cliente/empresa
3. Después de 2 caracteres, aparecerán **sugerencias de Odoo**
4. Las sugerencias incluyen: nombre, CUIT, teléfono y ciudad

### 2. **Selección de Contacto**
1. Haz clic en **"Seleccionar →"** del contacto deseado
2. Los datos se **autocompletarán automáticamente**
3. Recibirás una notificación de confirmación

### 3. **Indicadores Visuales**
- 🔄 **"Verificando Odoo..."** - Comprobando conexión
- ✅ **"Odoo conectado"** - Listo para buscar
- ❌ **"Odoo desconectado"** - Revisar configuración
- 🔍 **Icono en el campo** - Búsqueda activa

## 🔧 Compatibilidad con Versiones de Odoo

### ✅ **Versiones Compatibles**
- **Odoo 11** - Community/Enterprise
- **Odoo 12** - Community/Enterprise  
- **Odoo 13** - Community/Enterprise
- **Odoo 14** - Community/Enterprise
- **Odoo 15** - Community/Enterprise
- **Odoo 16** - Community/Enterprise
- **Odoo 17** - Community/Enterprise

### 📋 **Campos Utilizados**
El sistema usa una **estrategia progresiva** para máxima compatibilidad:

```javascript
// Estrategia 1 (Completa)
['id', 'name', 'vat', 'email', 'phone', 'city', 'is_company']

// Estrategia 2 (Básica) - Si falla la anterior
['id', 'name', 'vat', 'email', 'phone', 'is_company']

// Estrategia 3 (Esencial) - Fallback
['id', 'name', 'vat', 'email', 'is_company']

// Estrategia 4 (Mínima) - Última opción
['id', 'name', 'is_company']
```

## 🛠️ Troubleshooting

### ❌ "Odoo no está configurado"
**Solución**: Verifica que todas las variables de entorno estén configuradas en `.env.local`

### ❌ "Credenciales de Odoo inválidas"
**Soluciones**:
1. Verifica usuario y contraseña en Odoo
2. Comprueba que la URL sea correcta (incluir `https://`)
3. Verifica el nombre exacto de la base de datos

### ❌ "No se encontraron contactos"
**Causas posibles**:
1. El contacto no existe en Odoo
2. El contacto está marcado como inactivo
3. Sin permisos de lectura en `res.partner`

### ❌ "Error de conexión"
**Soluciones**:
1. Verifica conectividad a internet
2. Comprueba que la URL de Odoo sea accesible
3. Verifica configuración de firewall/proxy

### ⚠️ "Invalid field 'X' on 'res.partner'"
**Solución**: El sistema usa estrategia progresiva automáticamente. Si persiste, verifica la versión de Odoo.

## 🔍 Funcionalidades Avanzadas

### **Búsqueda Multi-criterio**
El sistema busca en múltiples campos simultáneamente:
- **Nombre** - Razón social o nombre de persona
- **CUIT/VAT** - Número de identificación fiscal
- **Display Name** - Nombre completo formateado

### **Tipos de Contacto**
- 🏢 **Empresas** - `is_company: true`
- 👤 **Personas** - `is_company: false`

### **Límites de Búsqueda**
- **Máximo 10 resultados** por búsqueda
- **Mínimo 2 caracteres** para activar búsqueda
- **Debounce de 500ms** para evitar consultas excesivas

## 📊 Monitoreo y Logs

### **Logs en Consola del Navegador**
```javascript
// Búsqueda exitosa
✅ Autenticación Odoo exitosa, UID: 123
🔍 Buscando en Odoo: "Empresa ABC"
✅ Encontrados 3 contactos

// Autocompletado
🎯 Autocompletando datos de contacto Odoo: {name: "Empresa ABC", vat: "20-12345678-9"}
```

### **Notificaciones al Usuario**
- 📧 **"Datos autocompletados"** - Éxito al seleccionar contacto
- ⚠️ **"Sin teléfono/CUIT"** - Contacto sin datos específicos
- ❌ **"Error de conexión"** - Problemas de conectividad

## 🔒 Seguridad

### **Variables de Entorno**
- Las variables `NEXT_PUBLIC_*` son **visibles en el navegador**
- Para mayor seguridad, usa **API Keys** en lugar de contraseñas
- Considera restricciones de IP en tu servidor Odoo

### **Permisos Mínimos**
El usuario solo necesita:
- ✅ Lectura en `res.partner` (Contactos)
- ❌ NO necesita escritura
- ❌ NO necesita acceso a otros modelos

### **Datos Transmitidos**
Solo se envían:
- Término de búsqueda (texto ingresado)
- Credenciales de autenticación
- No se almacenan datos localmente

## 🚀 Rendimiento

### **Optimizaciones Implementadas**
- **Debounce** - Evita búsquedas excesivas
- **Caché de autenticación** - Reutiliza UID por sesión
- **Límite de resultados** - Máximo 10 contactos
- **Búsqueda eficiente** - Usar operadores OR indexados

### **Métricas Típicas**
- **Autenticación**: ~200-500ms
- **Búsqueda**: ~300-800ms  
- **Total por búsqueda**: ~500-1300ms

## 📈 Casos de Uso

### **Escenario 1: Cliente Existente**
1. Técnico escribe "Empresa ABC"
2. Aparece en sugerencias con CUIT y teléfono
3. Un clic autocompleta todos los datos
4. **Tiempo ahorrado**: 2-3 minutos por orden

### **Escenario 2: Cliente Nuevo**  
1. Técnico escribe "Nueva Empresa"
2. No aparece en sugerencias
3. Continúa escribiendo manualmente
4. **Funcionalidad normal** sin interrupciones

### **Escenario 3: Sin Conexión**
1. Sistema detecta falta de conectividad
2. Muestra **"Odoo desconectado"**
3. Campo funciona como input normal
4. **Degradación elegante** de funcionalidad

## 📞 Soporte

### **Información de Debug**
Si encuentras problemas, incluye:
```javascript
// Ejecutar en consola del navegador para diagnóstico
console.log('Odoo Config:', {
  url: process.env.NEXT_PUBLIC_ODOO_URL,
  db: process.env.NEXT_PUBLIC_ODOO_DB,
  user: process.env.NEXT_PUBLIC_ODOO_USER,
  hasPassword: !!process.env.NEXT_PUBLIC_ODOO_PASSWORD
})
```

### **Logs Útiles**
- ✅ Estado de autenticación  
- 🔍 Términos de búsqueda
- 📋 Contactos encontrados
- ❌ Errores de conexión/API

---

## 🎉 Beneficios de la Integración

- ⚡ **Ahorro de tiempo** - Autocompletado instantáneo
- 🎯 **Datos consistentes** - Directamente desde Odoo  
- 🔍 **Búsqueda inteligente** - Encuentra contactos fácilmente
- 📱 **Compatible con móviles** - Funciona en todos los dispositivos
- 🛡️ **Degradación elegante** - Funciona sin conexión a Odoo
- 🔧 **Fácil configuración** - Solo variables de entorno

¡Disfruta de la nueva funcionalidad integrada con tu sistema Odoo! 🚀