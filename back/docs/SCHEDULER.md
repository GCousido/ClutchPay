# Scheduled Tasks (Cron Jobs)

## Overview

El sistema de tareas programadas ejecuta automáticamente notificaciones y limpieza de datos en segundo plano.

## Tareas Programadas

### 1. **Notificaciones de Pago Próximo a Vencer** 
- **Horario**: Diario a las 9:00 AM
- **Función**: `checkAndNotifyPaymentDue()`
- **Qué hace**: Busca facturas que vencen en los próximos 3 días y envía notificación in-app + email
- **Prevención duplicados**: Solo notifica si no existe una notificación `PAYMENT_DUE` previa

### 2. **Notificaciones de Pago Vencido**
- **Horario**: Diario a las 9:00 AM  
- **Función**: `checkAndNotifyPaymentOverdue()`
- **Qué hace**: Busca facturas vencidas (status PENDING/OVERDUE con dueDate pasado) y envía notificación
- **Prevención duplicados**: Solo notifica si no existe una notificación `PAYMENT_OVERDUE` previa

### 3. **Limpieza de Notificaciones Antiguas**
- **Horario**: Domingos a las 2:00 AM
- **Función**: `cleanupOldReadNotifications(60)`
- **Qué hace**: Elimina notificaciones leídas con más de 60 días desde su última actualización

## Implementación

### Archivos Principales

- **`src/libs/scheduler.ts`**: Configuración de todas las tareas cron
- **`src/libs/notifications.ts`**: Funciones de check y notificación
- **`instrumentation.ts`**: Inicialización automática con Next.js
- **`src/app/api/cron/check-payments/route.ts`**: Endpoint manual para testing

### Cron Expressions

```
'0 9 * * *'    → Daily at 9:00 AM
'0 2 * * 0'    → Sundays at 2:00 AM
```

## Testing Manual

### Query Parameters

El endpoint acepta un parámetro `task` para ejecutar tareas específicas:

#### `task=due` - Notificaciones de Pago Próximo a Vencer

```bash
GET /api/cron/check-payments?task=due
```

- **Qué busca**: Facturas PENDING/OVERDUE que vencen en los próximos 3 días
- **Qué hace**:
  - Crea notificación in-app para el deudor
  - Envía email si `debtorUser.emailNotifications` es true
  - Template de email: `PaymentDueEmail`
- **Prevención de duplicados**: Solo notifica si no existe notificación `PAYMENT_DUE` previa
- **Respuesta**: `{ paymentDue: 5 }` (5 notificaciones enviadas)

#### `task=overdue` - Notificaciones de Pago Vencido

```bash
GET /api/cron/check-payments?task=overdue
```

- **Qué busca**: Facturas PENDING/OVERDUE con dueDate en el pasado
- **Qué hace**:
  - Crea notificación in-app para el deudor
  - Envía email si `debtorUser.emailNotifications` es true
  - Template de email: `PaymentOverdueEmail`
- **Prevención de duplicados**: Solo notifica si no existe notificación `PAYMENT_OVERDUE` previa
- **Respuesta**: `{ paymentOverdue: 3 }` (3 notificaciones enviadas)

#### `task=cleanup` - Limpiar Notificaciones Antiguas

```bash
GET /api/cron/check-payments?task=cleanup
```

- **Qué busca**: Notificaciones leídas actualizado hace más de 60 días
- **Qué hace**: Elimina notificaciones antiguas leídas de la base de datos
- **Límites**:
  - Solo elimina si `read: true`
  - Solo elimina si `updatedAt < (ahora - 60 días)`
  - NO elimina notificaciones sin leer
- **Respuesta**: `{ cleanupOldNotifications: 12 }` (12 notificaciones eliminadas)

#### Sin parámetro - Ejecutar Todas las Tareas

```bash
GET /api/cron/check-payments
```

- Ejecuta `task=due`, `task=overdue` y `task=cleanup` en paralelo
- **Respuesta**:

```json
{
  "success": true,
  "message": "Scheduled tasks executed",
  "results": {
    "paymentDue": 5,
    "paymentOverdue": 3,
    "cleanupOldNotifications": 12
  },
  "timestamp": "2025-12-18T17:50:00.000Z"
}
```

### En Desarrollo/Test

El endpoint está abierto (sin autenticación):

```bash
# Ejecutar todas las tareas
GET http://localhost:3000/api/cron/check-payments

# Solo notificaciones due
GET http://localhost:3000/api/cron/check-payments?task=due

# Solo notificaciones overdue
GET http://localhost:3000/api/cron/check-payments?task=overdue

# Solo cleanup
GET http://localhost:3000/api/cron/check-payments?task=cleanup
```

### En Producción

Requiere header `x-cron-secret` con el valor de `CRON_SECRET` del `.env`:

```bash
# Generar un secret (solo una vez)
openssl rand -base64 32

# Agregar a .env
CRON_SECRET=tu-secret-generado-aqui

# Llamar al endpoint
curl -H "x-cron-secret: tu-secret-generado-aqui" \
  https://tu-dominio.com/api/cron/check-payments
```

**Servicios externos de cron:**

- **Vercel Cron**: Configurar el header en `vercel.json`
- **GitHub Actions**: Usar secrets del repositorio
- **AWS EventBridge**: Pasar el secret en los headers del request

## Logs

El scheduler imprime logs en consola:

```log
[Scheduler] Starting scheduled tasks...
[Scheduler] All scheduled tasks started successfully
  - Payment due check: Daily at 9:00 AM
  - Payment overdue check: Daily at 9:00 AM
  - Notification cleanup: Sundays at 2:00 AM (60 days old)
```

Cuando ejecuta tareas:

```log
[Scheduler] Running payment due check...
[Scheduler] Checked payment due: 3 notifications sent
```

## Configuración

Las tareas se inician automáticamente cuando el servidor arranca gracias a `instrumentation.ts`.

Para deshabilitar en desarrollo, comenta la línea en `instrumentation.ts`:

```typescript
// startScheduler(); // Disabled for dev
```

## Producción

- Las tareas corren en el mismo servidor que Next.js
- Si usas múltiples instancias (load balancer), necesitas:
  - Redis locks para evitar duplicados
  - O un worker dedicado que ejecute las tareas
  
Para un solo servidor, la implementación actual es suficiente.
