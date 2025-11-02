#######################################################################
####### PowerShell Script for Setting Up Development Environment ######
#######################################################################

#### Use the following command to run this script if execution policies prevent it:
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\setup.ps1


# Verificar e instalar pnpm si no está instalado
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "pnpm no encontrado, instalando globalmente..."
    npm install -g pnpm
} else {
    Write-Host "pnpm ya está instalado."
}

# Instalar dependencias con pnpm
Write-Host "Instalando dependencias con pnpm..."
pnpm install

# Entrar a la carpeta docker y levantar contenedores
Write-Host "Entrando a carpeta docker y levantando contenedores..."
Push-Location docker
docker-compose --env-file ../.env up -d
Pop-Location

# Volver a raíz y ejecutar migración Prisma
Write-Host "Ejecutando migración Prisma..."
npx prisma migrate dev --name init

# Generar cliente Prisma
Write-Host "Generando cliente Prisma..."
npx prisma generate

# Ejecutar servidor en modo desarrollo con pnpm
Write-Host "Iniciando servidor de desarrollo..."
pnpm run dev

Write-Host "Aplicación corriendo en http://localhost:3000"
#######################################################################