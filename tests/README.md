# Tests Backend

Este directorio contiene tests completos para el backend de la aplicación (APIs, validación, base de datos).

## 🚀 Ejecución de tests

```bash
# Ejecutar todos los tests
pnpm test

# Ejecutar con interfaz UI
pnpm test:ui

# Ejecutar en modo watch
pnpm test:watch

# Generar reporte de coverage
pnpm test:coverage

# Generar reporte de coverage en Markdown
pnpm coverage:md

# Generar reporte de coverage en PDF
pnpm coverage:pdf

# Generar coverage + Markdown + PDF (todo en uno)
pnpm coverage:all
```

## 📁 Estructura

```
tests/
├── setup.ts                          # Configuración global (limpieza DB)
├── helpers/
│   └── request.ts                    # Helpers para crear Request objects
├── api/
│   └── auth/
│       ├── register.test.ts          # Tests de registro (10 tests)
│       └── credentials.test.ts       # Tests de autenticación (7 tests)
└── libs/
    ├── db.test.ts                    # Tests de base de datos (9 tests)
    └── validations/
        ├── user.test.ts              # Tests de schemas Zod (25 tests)
        └── helpers.test.ts           # Tests de helpers (6 tests)
```

## ✅ Tests implementados

### API de Autenticación (17 tests)

#### `register.test.ts`
- ✅ Crear usuario con datos válidos
- ✅ Hash de contraseñas en DB
- ✅ Campos opcionales como null
- ✅ Validación de email inválido
- ✅ Validación de contraseña débil
- ✅ Validación de campos requeridos
- ✅ Validación de teléfono inválido
- ✅ Validación de código de país inválido
- ✅ Email duplicado (400 error)
- ✅ JSON malformado (500 error)

#### `credentials.test.ts`
- ✅ Login exitoso con credenciales válidas
- ✅ Password no retornado en resultado
- ✅ Error cuando usuario no existe
- ✅ Error cuando password es incorrecta
- ✅ Error cuando email está vacío
- ✅ Error cuando password está vacío
- ✅ Error cuando ambos están vacíos

### Validaciones (31 tests)

#### `user.test.ts` (25 tests)
- ✅ Validación de `userCreateSchema` completo
- ✅ Normalización de email (lowercase)
- ✅ Normalización de country (uppercase)
- ✅ Validación de password (8+ chars, mayúscula, minúscula, número, especial)
- ✅ Validación de teléfono (E.164 format)
- ✅ Validación de country (ISO 3166-1 alpha-2)
- ✅ Validación de name (2-100 chars, trim)
- ✅ `userUpdateSchema` con campos opcionales

#### `helpers.test.ts` (6 tests)
- ✅ Conversión de ZodError a array format
- ✅ Field por defecto "body" para path vacío
- ✅ Nested paths con dot notation
- ✅ `validateAsync` con datos válidos
- ✅ `validateAsync` con datos inválidos
- ✅ Transformaciones async

### Base de datos (9 tests)

#### `db.test.ts`
- ✅ Conexión a base de datos
- ✅ Modelos disponibles (User, Invoice, Payment, Notification)
- ✅ CRUD operations completo (create, find, update, delete)
- ✅ Unique constraint en email

## 🔧 Configuración

### Base de datos de test

Los tests usan la misma base de datos PostgreSQL pero **limpian** todas las tablas antes/después de cada test para mantener aislamiento.

```env
# .env
TEST_DATABASE_URL=postgresql://clutchpay_user:clutchpay_pass@localhost:5432/clutchpay_test_db?schema=public
```

### Vitest config

Configuración en `vitest.config.mts`:

- **Environment:** Node.js
- **Globals:** Habilitado  
- **Coverage provider:** V8
- **Coverage reporters:** text, json, json-summary, html, lcov
- **Alias:** `@/` → `./src`

### Setup automático

El archivo `tests/setup.ts` se ejecuta antes de cada suite:
- Limpia todas las tablas (Notification → Payment → Invoice → User)
- Garantiza aislamiento entre tests
- Desconecta Prisma al finalizar

## 📊 Coverage

### Reportes disponibles

El sistema de coverage genera 3 tipos de reportes:

1. **HTML interactivo** (`coverage/index.html`)
   - Exploración visual archivo por archivo
   - Destacado de líneas cubiertas/no cubiertas
   - Navegación por directorios

2. **Markdown detallado** (`coverage/coverage-report.md`)
   - Resumen de métricas globales
   - Tabla de cobertura por archivo
   - Archivos por debajo del umbral
   - Distribución de coverage
   - Top 5 mejores/peores archivos
   - Recomendaciones automáticas

3. **PDF profesional** (`coverage/coverage-report.pdf`)
   - Versión imprimible del reporte Markdown
   - Diseño profesional con estilos
   - Ideal para compartir con el equipo

### Generar reportes

```bash
# Solo coverage (HTML + JSON)
pnpm test:coverage

# Coverage + Markdown
pnpm test:coverage --run && pnpm coverage:md

# Coverage + Markdown + PDF (recomendado)
pnpm coverage:all
```

### Configuración

El reporte excluye automáticamente:
- `node_modules/`
- `tests/`
- Archivos de configuración (`*.config.*`)
- Type definitions (`.d.ts`)
- Directorio `coverage/`
- Scripts (`scripts/`)
- Frontend vanilla (`front/`)

Para cambiar el umbral de cobertura (por defecto 80%):

```bash
# En Windows PowerShell
$env:COVERAGE_THRESHOLD="85"; pnpm coverage:all

# En Linux/Mac
COVERAGE_THRESHOLD=85 pnpm coverage:all
```

## 🐛 Troubleshooting

### Error: Can't reach database server

Asegúrate de que PostgreSQL esté corriendo:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Error: Module not found

Regenera el cliente de Prisma:

```bash
npx prisma generate
```

### Tests fallando por datos anteriores

Los tests limpian la DB automáticamente, pero si persiste:

```bash
# Reiniciar DB de test manualmente
npx prisma migrate reset --skip-seed
```

## 📝 Notas

- **Total tests:** 56 tests
- **Tasa de éxito:** 100% ✅
- **Framework:** Vitest v4.0.11
- **Coverage tool:** V8
- **Coverage reportes:** HTML, JSON, Markdown, PDF
- **Test database:** PostgreSQL (shared with dev, pero limpiado automáticamente)

## 📄 Estructura de reportes de coverage

```
coverage/
├── index.html              # Reporte HTML interactivo
├── coverage-summary.json   # JSON con métricas resumidas
├── coverage-final.json     # JSON detallado completo
├── lcov.info              # Formato LCOV para CI/CD
├── coverage-report.md     # 📊 Reporte Markdown detallado
└── coverage-report.pdf    # 📄 Reporte PDF profesional
```
