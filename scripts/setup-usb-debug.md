# Configuración de Depuración USB para Tablet Android

## 1. Instalar ADB (Android Debug Bridge)

### Opción A: Usando Chocolatey (Recomendado)
```powershell
# Instalar Chocolatey si no lo tienes
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar ADB
choco install adb -y
```

### Opción B: Manual
1. Descargar Platform Tools: https://developer.android.com/studio/releases/platform-tools
2. Extraer en `C:\platform-tools`
3. Agregar `C:\platform-tools` al PATH del sistema

## 2. Habilitar Depuración USB en la Tablet

1. Ve a **Configuración** → **Acerca del tablet/teléfono**
2. Toca 7 veces en **Número de compilación** para habilitar opciones de desarrollador
3. Ve a **Configuración** → **Opciones de desarrollador**
4. Activa **Depuración USB**
5. Activa **Instalar vía USB** (si está disponible)

## 3. Conectar la Tablet

1. Conecta la tablet por USB a la computadora
2. En la tablet, acepta el diálogo de "¿Permitir depuración USB?"
3. Marca "Confiar siempre en este equipo" si deseas

## 4. Verificar Conexión

```powershell
# Ver dispositivos conectados
adb devices

# Debería mostrar algo como:
# List of devices attached
# ABCD1234    device
```

## 5. Configurar Port Forwarding

```powershell
# Reenviar puerto 3000 de la PC al puerto 3000 de la tablet
adb reverse tcp:3000 tcp:3000

# Ahora en la tablet puedes acceder a: http://localhost:3000
```

## 6. Comandos Útiles

```powershell
# Ver logs en tiempo real
adb logcat

# Ver logs del navegador Chrome
adb logcat | Select-String "chromium"

# Abrir Chrome DevTools remoto
# Ve a chrome://inspect en tu navegador de escritorio
```

## 7. Solución de Problemas

### "unauthorized" o "no permissions"
```powershell
# Revoca autorizaciones USB
adb kill-server
adb start-server

# En la tablet: desconecta y vuelve a conectar, acepta el diálogo nuevamente
```

### No aparece el diálogo de autorización
```powershell
# Revoca todas las autorizaciones previas
adb kill-server
rm $env:USERPROFILE\.android\adbkey*
adb start-server
```

### Drivers USB faltantes (Windows)
1. Descargar drivers USB del fabricante de la tablet
2. O usar drivers universales: https://adb.clockworkmod.com/

## 8. Acceso Web después de configurar

Una vez configurado el port forwarding, en la tablet abre Chrome y ve a:
```
http://localhost:3000
```

La aplicación se cargará como si estuviera en la red local, pero usando USB (más estable y rápido).
