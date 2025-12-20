# Manual de Uso y Pruebas con Vagrant

Este documento detalla cómo levantar el entorno de pruebas utilizando Vagrant y cómo utilizar el script de instalación `installer.sh` para desplegar la aplicación ClutchPay.

## 1. Entorno de Pruebas con Vagrant

El proyecto incluye una configuración de Vagrant para simular un entorno limpio de Debian 11, idéntico al de producción.

### Requisitos Previos
- [VirtualBox](https://www.virtualbox.org/) instalado.
- [Vagrant](https://www.vagrantup.com/) instalado.

### Comandos Básicos

Desde la carpeta `utils_dev/`:

1.  **Iniciar la máquina virtual:**
    ```powershell
    vagrant up
    ```
    Esto descargará la imagen de Debian 11 (si no la tienes) y creará la máquina virtual.

2.  **Acceder a la máquina virtual:**
    ```powershell
    vagrant ssh
    ```
    Esto te conectará por SSH a la máquina virtual.

3.  **Apagar la máquina virtual:**
    ```powershell
    vagrant halt
    ```

4.  **Destruir la máquina virtual (para empezar de cero):**
    ```powershell
    vagrant destroy -f
    ```
    Útil para probar la instalación desde un estado limpio.

### Acceso a los Archivos
El script de instalación se copia automáticamente a la raíz del sistema en la máquina virtual: `/installer.sh`.

---

## 2. Script de Instalación (`installer.sh`)

El script `installer.sh` automatiza todo el proceso de despliegue de ClutchPay en un servidor Debian 11.

### Menú de Opciones

El script soporta varios modos de ejecución mediante "flags" (argumentos):

| Comando | Descripción |
| :--- | :--- |
| `bash /installer.sh` | **Instalación Completa**. Instala Backend y Frontend usando la configuración por defecto (no interactivo). |
| `bash /installer.sh -i` | **Instalación Interactiva**. Pregunta por directorio, puertos e IPs, permitiendo personalizar la instalación. |
| `bash /installer.sh --backend-only` | Instala **solo el Backend** y la base de datos. Útil para separar servicios en distintos servidores. |
| `bash /installer.sh --backend-only -i` | Instalación interactiva solo del Backend. |
| `bash /installer.sh --frontend-only` | Instala **solo el Frontend** (Apache). Requiere la IP del servidor Backend. |
| `bash /installer.sh --frontend-only -i` | Instalación interactiva solo del Frontend. |
| `bash /installer.sh --update [tag]` | **Actualiza** una instalación existente a una versión específica (tag de git). Si no se indica tag, lista los disponibles. |
| `bash /installer.sh --config-backend` | Reconfigura la IP/Puerto del Frontend en una instalación de Backend existente (para CORS). |
| `bash /installer.sh --config-frontend` | Reconfigura la IP/Puerto del Backend en una instalación de Frontend existente. |

### Ejemplos de Uso en Vagrant

**1. Prueba de instalación estándar (silenciosa):**
```bash
# Dentro de vagrant ssh
sudo bash /installer.sh
```

**2. Prueba de instalación interactiva (personalizada):**
```bash
# Dentro de vagrant ssh
sudo bash /installer.sh -i
```
*Te pedirá confirmar directorios y puertos. Si un puerto está ocupado, te avisará y pedirá otro.*

**3. Simular actualización:**
```bash
# Dentro de vagrant ssh
sudo bash /installer.sh --update v1.0.0
```

**4. Limpiar entorno para nueva prueba:**
Sal de la VM (`exit`) y ejecuta en tu máquina host:
```powershell
vagrant destroy -f
vagrant up
vagrant ssh
```
