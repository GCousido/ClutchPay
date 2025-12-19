# Documentación Técnica: Sistema de Pagos - ClutchPay

## Tabla de Contenidos

1. [Visión General del Sistema](#visión-general-del-sistema)
2. [Arquitectura de Pagos](#arquitectura-de-pagos)
3. [Flujos de Peticiones Detallados](#flujos-de-peticiones-detallados)
4. [Diagramas de Flujo](#diagramas-de-flujo)
5. [Validaciones y Seguridad](#validaciones-y-seguridad)
6. [Manejo de Errores](#manejo-de-errores)
7. [Referencias de API](#referencias-de-api)

---

## Visión General del Sistema

ClutchPay es una pasarela de pagos que integra **Stripe** como procesador de pagos (usando PayPal como método de pago) y **PayPal Payouts** para transferir fondos a los receptores. El flujo completo es:

```
Pagador (Deudor) → Stripe Checkout (PayPal) → ClutchPay → PayPal Payout → Receptor (Emisor)
```

### Componentes Principales

- **API Routes**: Endpoints REST para gestión de pagos
- **Stripe Integration**: Procesamiento de pagos mediante Stripe Checkout
- **PayPal Integration**: Transferencias a receptores mediante PayPal Payouts
- **Database (Prisma)**: Persistencia de facturas y pagos
- **Validaciones (Zod)**: Validación de datos de entrada
- **PDF Generation**: Generación de recibos
- **Cloudinary**: Almacenamiento de PDFs

---

## Arquitectura de Pagos

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Cliente)                       │
│  (HTML/JS - Peticiones HTTP a API)                         │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS Request
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Backend)                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  /api/payments/*                                      │ │
│  │  - route.ts (GET: Listar pagos)                      │ │
│  │  - [id]/route.ts (GET: Detalle de pago)             │ │
│  │  - stripe/checkout/route.ts (POST: Crear sesión)    │ │
│  │  - stripe/session/[sessionId]/route.ts (GET)        │ │
│  │  - stripe/webhook/route.ts (POST: Eventos Stripe)   │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌──────────┐ ┌─────────┐ ┌──────────────┐
│  Stripe  │ │ PayPal  │ │  Cloudinary  │
│ Checkout │ │ Payouts │ │   (PDFs)     │
└──────────┘ └─────────┘ └──────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│     Database (PostgreSQL/Prisma)        │
│  - Users                                │
│  - Invoices                             │
│  - Payments                             │
└─────────────────────────────────────────┘
```

### Modelos de Datos (Prisma)

```typescript
model Invoice {
  id            Int           @id @default(autoincrement())
  invoiceNumber String        @unique
  issuerUserId  Int          // Usuario que recibe el pago
  debtorUserId  Int          // Usuario que paga
  amount        Decimal
  status        InvoiceStatus // PENDING, PAID, CANCELLED, OVERDUE
  payment       Payment?      // Relación 1:1
  // ... otros campos
}

model Payment {
  id              Int           @id @default(autoincrement())
  invoiceId       Int           @unique
  paymentDate     DateTime
  paymentMethod   PaymentMethod // PAYPAL, VISA, MASTERCARD, OTHER
  paymentReference String       // Stripe session ID o payment intent
  receiptPdfUrl   String?
  subject         String
  // ... otros campos
}
```

---

## Flujos de Peticiones Detallados

### 1. Listar Pagos (GET /api/payments)

#### Descripción
Obtiene una lista paginada de pagos filtrados según el rol del usuario autenticado.

#### Flujo de Ejecución

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ GET /api/payments?role=payer&page=1&limit=10
       ▼
┌─────────────────────────────────────────────────────────┐
│  API Route: /api/payments/route.ts                     │
│                                                         │
│  1. requireAuth()                                       │
│     └─> getServerSession() → Valida JWT                │
│     └─> Si no hay sesión → throw Error('Unauthorized') │
│                                                         │
│  2. paymentListQuerySchema.parse()                     │
│     └─> Valida query params (role, filters, etc.)      │
│     └─> Si inválido → throw ZodError                   │
│                                                         │
│  3. getPagination(searchParams)                        │
│     └─> Extrae page, limit, skip                       │
│                                                         │
│  4. Construir filtros WHERE (Prisma)                   │
│     ├─> role='payer' → debtorUserId = sessionUser.id   │
│     ├─> role='receiver' → issuerUserId = sessionUser.id│
│     ├─> paymentMethod (opcional)                       │
│     ├─> minAmount/maxAmount (opcional)                 │
│     └─> paymentDateFrom/paymentDateTo (opcional)       │
│                                                         │
│  5. db.payment.count() + db.payment.findMany()         │
│     └─> Ejecuta consulta SQL con filtros y paginación  │
│                                                         │
│  6. Calcular totalPages = ceil(total / limit)          │
│                                                         │
│  7. Retornar JSON con meta + data                      │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Response   │
│  200 OK     │
│  {          │
│    meta: {  │
│      total, │
│      page,  │
│      ...    │
│    },       │
│    data: [] │
│  }          │
└─────────────┘
```

#### Validaciones Aplicadas

| Validación | Librería | Descripción |
|------------|----------|-------------|
| Autenticación | `requireAuth()` | Verifica sesión activa con NextAuth |
| Query Params | `paymentListQuerySchema` (Zod) | Valida role, paymentMethod, amounts, dates |
| Paginación | `getPagination()` | page ≥ 1, limit entre 1-1000 |
| Rangos | `superRefine()` (Zod) | minAmount ≤ maxAmount, dateFrom ≤ dateTo |

#### Posibles Errores

| Código | Causa | Manejo |
|--------|-------|--------|
| 401 | No autenticado | `handleError()` → JSON con error |
| 400 | Validación fallida | ZodError → JSON con detalles |
| 500 | Error DB o interno | Error genérico |

---

### 2. Obtener Detalle de Pago (GET /api/payments/:id)

#### Descripción
Recupera información completa de un pago específico. Solo el pagador o receptor pueden acceder.

#### Flujo de Ejecución

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ GET /api/payments/123
       ▼
┌─────────────────────────────────────────────────────────┐
│  API Route: /api/payments/[id]/route.ts                │
│                                                         │
│  1. requireAuth()                                       │
│     └─> Obtiene sessionUser                            │
│                                                         │
│  2. await context.params → { id: "123" }               │
│                                                         │
│  3. Validar ID                                          │
│     ├─> parseInt(id, 10)                               │
│     ├─> isNaN(paymentId) → 400 "Invalid payment ID"   │
│     └─> paymentId <= 0 → 400 "Invalid payment ID"     │
│                                                         │
│  4. db.payment.findUnique()                            │
│     └─> Incluye invoice con issuerUser y debtorUser    │
│                                                         │
│  5. Si payment === null → 404 "Payment not found"     │
│                                                         │
│  6. Verificar autorización                             │
│     ├─> isDebtor = debtorUserId === sessionUser.id    │
│     ├─> isIssuer = issuerUserId === sessionUser.id    │
│     └─> Si !isDebtor && !isIssuer → 403 Forbidden     │
│                                                         │
│  7. Retornar payment completo                          │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Response   │
│  200 OK     │
│  {          │
│    id,      │
│    invoice, │
│    ...      │
│  }          │
└─────────────┘
```

#### Validaciones Aplicadas

| Validación | Ubicación | Descripción |
|------------|-----------|-------------|
| Autenticación | `requireAuth()` | Sesión activa |
| ID numérico | Manual (parseInt) | ID debe ser entero positivo |
| Existencia | DB query | Payment debe existir |
| Autorización | Lógica custom | User debe ser debtor o issuer |

#### Posibles Errores

| Código | Causa | Manejo |
|--------|-------|--------|
| 401 | No autenticado | handleError() |
| 400 | ID inválido | JSON con mensaje |
| 404 | Payment no existe | JSON con mensaje |
| 403 | Sin permiso | JSON con mensaje |

---

### 3. Crear Sesión de Checkout (POST /api/payments/stripe/checkout)

#### Descripción
Crea una sesión de Stripe Checkout para pagar una factura. Solo el deudor puede iniciar el pago.

#### Flujo de Ejecución Completo

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ POST /api/payments/stripe/checkout
       │ Body: { invoiceId: 1, successUrl, cancelUrl }
       ▼
┌────────────────────────────────────────────────────────────────┐
│  API Route: /api/payments/stripe/checkout/route.ts            │
│                                                                │
│  1. requireAuth()                                              │
│     └─> Valida sesión → sessionUser                           │
│                                                                │
│  2. validateBody(stripeCheckoutCreateSchema, body)            │
│     ├─> invoiceId: int, positive                             │
│     ├─> successUrl: URL válida (opcional)                     │
│     └─> cancelUrl: URL válida (opcional)                      │
│                                                                │
│  3. db.invoice.findUnique({ where: { id } })                  │
│     └─> Incluye issuerUser, debtorUser, payment              │
│                                                                │
│  4. Validaciones de negocio                                   │
│     ├─> Si !invoice → 404 "Invoice not found"                │
│     ├─> Si debtorUserId !== sessionUser.id → 403             │
│     ├─> Si invoice.payment existe → 400 "Already paid"       │
│     └─> Si status !== PENDING/OVERDUE → 400 "Cannot pay"     │
│                                                                │
│  5. toCents(invoice.amount)                                   │
│     └─> Convierte decimal a centavos (99.99 → 9999)          │
│                                                                │
│  6. createCheckoutSession() [libs/stripe.ts]                  │
│     ├─> stripe.checkout.sessions.create()                    │
│     ├─> payment_method_types: ['paypal']                     │
│     ├─> line_items: [{ price_data, quantity: 1 }]           │
│     ├─> metadata: { invoiceId, payerId, receiverId, ... }   │
│     ├─> success_url, cancel_url                              │
│     └─> expires_at: +30 minutos                              │
│                                                                │
│  7. Retornar sesión creada                                    │
│     └─> { sessionId, checkoutUrl, invoice }                  │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Response 201 Created   │
│  {                      │
│    sessionId: "cs_...", │
│    checkoutUrl: "...",  │
│    invoice: { ... }     │
│  }                      │
└─────────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Cliente redirige   │
│  a Stripe Checkout  │
└─────────────────────┘
```

#### Librerías y Funciones Utilizadas

```typescript
// Validación de entrada
stripeCheckoutCreateSchema (Zod)
  ├─> invoiceId: z.number().int().positive()
  ├─> successUrl: z.url().optional()
  └─> cancelUrl: z.url().optional()

// Helpers
requireAuth() → Session validation
validateBody() → Zod parsing
toCents() → Decimal to cents conversion

// Stripe integration
createCheckoutSession() [stripe.ts]
  └─> stripe.checkout.sessions.create()
      ├─> Mode: 'payment'
      ├─> Payment method: PayPal only
      ├─> Metadata: Invoice & user info
      └─> Expiration: 30 minutes
```

#### Validaciones en Cascada

```
requireAuth()
    ↓
validateBody(stripeCheckoutCreateSchema)
    ↓
DB: invoice.findUnique()
    ↓
Authorization: debtorUserId === sessionUser.id
    ↓
Business rules:
    - No payment exists
    - Status is PENDING or OVERDUE
    ↓
Stripe API validation (internal)
```

#### Posibles Errores

| Código | Causa | Origen | Manejo |
|--------|-------|--------|--------|
| 401 | No autenticado | requireAuth() | handleError() |
| 400 | Body inválido | Zod validation | ZodError response |
| 404 | Invoice no existe | DB query | JSON message |
| 403 | No es el deudor | Business logic | JSON message |
| 400 | Ya pagada | invoice.payment check | JSON message |
| 400 | Status inválido | invoice.status check | JSON message |
| 500 | Stripe API error | stripe.checkout.sessions.create() | handleError() |

---

### 4. Consultar Estado de Sesión (GET /api/payments/stripe/session/:sessionId)

#### Descripción
Recupera el estado actual de una sesión de Stripe Checkout. Solo participantes pueden acceder.

#### Flujo de Ejecución

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ GET /api/payments/stripe/session/cs_test_abc123
       ▼
┌────────────────────────────────────────────────────────────────┐
│  API Route: /api/payments/stripe/session/[sessionId]/route.ts │
│                                                                │
│  1. requireAuth()                                              │
│     └─> sessionUser                                            │
│                                                                │
│  2. await params → { sessionId }                               │
│                                                                │
│  3. Validar formato sessionId                                  │
│     └─> Debe empezar con "cs_"                                │
│     └─> Si inválido → 400 "Invalid session ID format"         │
│                                                                │
│  4. getCheckoutSession(sessionId) [stripe.ts]                 │
│     └─> stripe.checkout.sessions.retrieve(sessionId, {        │
│           expand: ['payment_intent', 'line_items']            │
│         })                                                     │
│                                                                │
│  5. Extraer metadata                                           │
│     └─> const metadata = session.metadata as ...              │
│     └─> Si !metadata.invoiceId → 400                          │
│                                                                │
│  6. Verificar autorización                                     │
│     ├─> payerId = parseInt(metadata.payerId)                  │
│     ├─> receiverId = parseInt(metadata.receiverId)            │
│     └─> Si sessionUser.id !== payerId/receiverId → 403       │
│                                                                │
│  7. db.invoice.findUnique() (opcional, info adicional)        │
│                                                                │
│  8. Calcular amount de line_items                             │
│     └─> totalAmount = sum(item.amount_total)                  │
│                                                                │
│  9. Mapear estado con mapSessionStatus()                      │
│     └─> Convierte Stripe status a status interno              │
│                                                                │
│  10. Retornar información de sesión                            │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Response 200 OK        │
│  {                      │
│    sessionId,           │
│    status: "completed", │
│    paymentStatus,       │
│    amount,              │
│    invoice,             │
│    ...                  │
│  }                      │
└─────────────────────────┘
```

#### Funciones de Utilidad

```typescript
// Mapping de estados Stripe a estados internos
mapSessionStatus(session: Stripe.Checkout.Session): StripeSessionStatus
  ├─> 'complete' + 'paid' → 'completed'
  ├─> 'expired' → 'expired'
  ├─> 'unpaid' → 'pending'
  └─> default → 'processing'

// Conversión de centavos
fromCents(cents: number): number
  └─> return cents / 100
```

#### Posibles Errores

| Código | Causa | Manejo |
|--------|-------|--------|
| 401 | No autenticado | handleError() |
| 400 | Formato sessionId inválido | JSON message |
| 400 | Metadata faltante | JSON message |
| 403 | No autorizado | JSON message |
| 404 | Session no existe en Stripe | Error catch específico |
| 500 | Stripe API error | handleError() |

---

### 5. Webhook de Stripe (POST /api/payments/stripe/webhook)

#### Descripción
**Endpoint crítico**: Recibe eventos de Stripe cuando ocurren cambios en el estado del pago. No requiere autenticación (usa firma webhook).

#### Flujo de Procesamiento de Pago Exitoso

```
┌──────────────────┐
│  Stripe Servers  │
└────────┬─────────┘
         │ POST /api/payments/stripe/webhook
         │ Headers: stripe-signature
         │ Body: Event JSON
         ▼
┌────────────────────────────────────────────────────────────────────┐
│  API Route: /api/payments/stripe/webhook/route.ts                 │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 1: VERIFICACIÓN DE SEGURIDAD                                │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  1. await request.text() → payload (raw body)                     │
│                                                                    │
│  2. request.headers.get('stripe-signature')                       │
│     └─> Si falta → 400 "Missing signature header"                │
│                                                                    │
│  3. verifyWebhookSignature(payload, signature)                    │
│     └─> stripe.webhooks.constructEvent()                          │
│     └─> Verifica HMAC con STRIPE_WEBHOOK_SECRET                   │
│     └─> Si falla → 400 "Invalid signature"                        │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 2: ROUTING DE EVENTOS                                       │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  4. switch (event.type)                                            │
│     ├─> 'checkout.session.completed'                              │
│     │   └─> handleCheckoutComplete()                              │
│     │                                                              │
│     ├─> 'checkout.session.async_payment_succeeded'                │
│     │   └─> handleAsyncPaymentSuccess()                           │
│     │                                                              │
│     ├─> 'checkout.session.async_payment_failed'                   │
│     │   └─> handleAsyncPaymentFailed()                            │
│     │                                                              │
│     └─> 'checkout.session.expired'                                │
│         └─> handleSessionExpired()                                │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 3: PROCESAMIENTO DE PAGO (checkout.session.completed)       │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  5. handleCheckoutComplete(session)                                │
│     └─> Si payment_status === 'paid'                              │
│         └─> processSuccessfulPayment(session)                     │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 4: PROCESO DE PAGO EXITOSO (processSuccessfulPayment)       │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  6. Extraer metadata                                               │
│     └─> { invoiceId, payerId, receiverId, ... }                   │
│                                                                    │
│  7. Verificar idempotencia                                         │
│     └─> db.payment.findUnique({ where: { invoiceId } })          │
│     └─> Si existe → return (ya procesado)                         │
│                                                                    │
│  8. Verificar invoice                                              │
│     ├─> db.invoice.findUnique()                                   │
│     ├─> Si no existe → return                                     │
│     └─> Si status === PAID → return (ya pagada)                   │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 5: GENERACIÓN DE RECIBO                                     │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  9. Intentar obtener recibo de Stripe                             │
│     ├─> stripe.paymentIntents.retrieve()                          │
│     ├─> stripe.charges.retrieve()                                 │
│     └─> Si tiene receipt_url → usar esa                           │
│                                                                    │
│  10. Si no hay receipt de Stripe → Generar PDF                    │
│      ├─> generateReceiptPdf() [pdf-generator.ts]                  │
│      │   └─> Genera PDF con PDFKit                                │
│      ├─> Convert to base64                                        │
│      └─> uploadPdf() a Cloudinary                                 │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 6: PERSISTENCIA EN BASE DE DATOS (Transacción)              │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  11. db.$transaction()                                             │
│      ├─> db.payment.create({                                      │
│      │     invoiceId,                                             │
│      │     paymentDate: new Date(),                               │
│      │     paymentMethod: PAYPAL,                                 │
│      │     paymentReference: session.payment_intent || session.id,│
│      │     receiptPdfUrl                                          │
│      │   })                                                        │
│      │                                                             │
│      └─> db.invoice.update({                                      │
│            where: { id: invoiceId },                              │
│            data: { status: PAID }                                 │
│          })                                                        │
│                                                                    │
│  ══════════════════════════════════════════════════════════════  │
│  FASE 7: PAYOUT A RECEPTOR (PayPal)                               │
│  ══════════════════════════════════════════════════════════════  │
│                                                                    │
│  12. createPayPalPayout() [paypal.ts]                             │
│      ├─> Convierte cents a decimal                                │
│      ├─> Genera senderBatchId único                               │
│      ├─> payoutsSdk.payouts.PayoutsPostRequest()                  │
│      ├─> requestBody({                                            │
│      │     sender_batch_header,                                   │
│      │     items: [{ recipient_type: 'EMAIL', ... }]              │
│      │   })                                                        │
│      └─> getPayPalClient().execute()                              │
│                                                                    │
│  13. Si payout exitoso → Actualizar payment                       │
│      └─> db.payment.update({                                      │
│            data: {                                                 │
│              paymentReference: "STRIPE_ID|PAYOUT:BATCH_ID"        │
│            }                                                       │
│          })                                                        │
│                                                                    │
│  14. Si payout falla → Log error (no falla webhook)               │
│      └─> console.error() + TODO: Queue retry                      │
│                                                                    │
│  15. Retornar { received: true }                                   │
└────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Response 200 OK    │
│  { received: true } │
└─────────────────────┘
```

#### Eventos Manejados

| Evento Stripe | Handler | Descripción |
|---------------|---------|-------------|
| `checkout.session.completed` | `handleCheckoutComplete()` | Sesión completada (puede ser async si PayPal) |
| `checkout.session.async_payment_succeeded` | `handleAsyncPaymentSuccess()` | Pago async confirmado (PayPal) |
| `checkout.session.async_payment_failed` | `handleAsyncPaymentFailed()` | Pago async falló |
| `checkout.session.expired` | `handleSessionExpired()` | Sesión expiró sin pago |

#### Validaciones y Seguridad

```typescript
// Verificación de firma webhook (CRÍTICO)
verifyWebhookSignature(payload, signature)
  └─> stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      )
  └─> Valida HMAC SHA-256
  └─> Previene ataques de replay y falsificación

// Idempotencia (evita procesamiento duplicado)
db.payment.findUnique({ where: { invoiceId } })
  └─> Si existe → return early

// Validación de estado de invoice
invoice.status !== PAID
  └─> Evita doble procesamiento
```

#### Integraciones Externas

```typescript
// 1. Stripe (recuperar recibo)
stripe.paymentIntents.retrieve(paymentIntentId)
  └─> stripe.charges.retrieve(chargeId)
      └─> charge.receipt_url

// 2. PDF Generation
generateReceiptPdf(params) [pdf-generator.ts]
  └─> PDFKit para crear documento
  └─> Retorna Buffer

// 3. Cloudinary (subir PDF)
uploadPdf(base64Pdf, folder)
  └─> cloudinary.uploader.upload()
  └─> Retorna URL pública

// 4. PayPal Payouts
createPayPalPayout(params) [paypal.ts]
  └─> PayPal SDK
  └─> Transfiere fondos al receptor
```

#### Manejo de Errores Robusto

```typescript
// Errores de verificación → Rechazar inmediatamente
catch (signature verification)
  └─> 400 "Invalid signature"

// Errores de procesamiento → Log pero no fallar
try {
  processSuccessfulPayment()
} catch (error) {
  console.error()
  return 500 // Stripe reintentará
}

// Errores de payout → No fallar webhook
try {
  createPayPalPayout()
} catch (payoutError) {
  console.error() // Log para admin
  // Webhook sigue exitoso (200)
  // TODO: Implementar cola de reintentos
}
```

#### Garantías de Consistencia

1. **Transacción DB**: Payment + Invoice update en transacción atómica
2. **Idempotencia**: Verifica existencia antes de crear
3. **Reintentos Stripe**: Si webhook falla (500), Stripe reintenta automáticamente
4. **Fallback receipt**: Si Stripe receipt falla, genera PDF custom

---

## Diagramas de Flujo

### Diagrama 1: Flujo Completo de Pago Exitoso

```mermaid
graph TD
    A[Usuario Deudor] -->|1. POST /api/payments/stripe/checkout| B[API: Crear Sesión]
    B -->|2. Validar auth y body| C{¿Válido?}
    C -->|No| D[Error 400/401/403]
    C -->|Sí| E[Buscar Invoice en DB]
    E -->|3. Validar estado| F{¿Puede pagar?}
    F -->|No| G[Error 400/404]
    F -->|Sí| H[createCheckoutSession]
    H -->|4. Stripe API| I[Stripe Checkout Session]
    I -->|5. Retornar URL| J[Redirigir a Stripe]
    J -->|6. Usuario paga| K[Stripe procesa PayPal]
    K -->|7. Webhook event| L[POST /webhook]
    L -->|8. Verificar firma| M{¿Firma válida?}
    M -->|No| N[Error 400]
    M -->|Sí| O[handleCheckoutComplete]
    O -->|9. Verificar idempotencia| P{¿Ya procesado?}
    P -->|Sí| Q[Return 200]
    P -->|No| R[processSuccessfulPayment]
    R -->|10. Generar recibo| S[PDF + Cloudinary]
    S -->|11. Transacción DB| T[Crear Payment + Update Invoice]
    T -->|12. PayPal Payout| U[createPayPalPayout]
    U -->|13. Transferir fondos| V[Receptor PayPal]
    V -->|14. Success| W[Webhook 200 OK]
    
    style B fill:#e1f5ff
    style H fill:#fff4e1
    style L fill:#ffe1e1
    style T fill:#e1ffe1
    style U fill:#f0e1ff
```

### Diagrama 2: Flujo de Validaciones en POST /checkout

```mermaid
graph TD
    A[POST /checkout Request] --> B[requireAuth]
    B -->|Sin sesión| C[401 Unauthorized]
    B -->|Con sesión| D[validateBody con Zod]
    D -->|Datos inválidos| E[400 ZodError]
    D -->|Datos válidos| F[findUnique Invoice]
    F -->|No existe| G[404 Not Found]
    F -->|Existe| H{debtorUserId === sessionUser.id?}
    H -->|No| I[403 Forbidden]
    H -->|Sí| J{invoice.payment existe?}
    J -->|Sí| K[400 Already Paid]
    J -->|No| L{status === PENDING o OVERDUE?}
    L -->|No| M[400 Cannot Pay]
    L -->|Sí| N[createCheckoutSession]
    N --> O[201 Created + checkoutUrl]
    
    style B fill:#ffecb3
    style D fill:#ffecb3
    style H fill:#c8e6c9
    style J fill:#c8e6c9
    style L fill:#c8e6c9
    style N fill:#bbdefb
```

### Diagrama 3: Flujo de Manejo de Errores en Webhook

```mermaid
graph TD
    A[Webhook Event] --> B{Firma válida?}
    B -->|No| C[400 Invalid Signature]
    B -->|Sí| D[switch event.type]
    D --> E[processSuccessfulPayment]
    E --> F{Payment existe?}
    F -->|Sí| G[Return early - Idempotente]
    F -->|No| H{Invoice existe y no pagada?}
    H -->|No| I[Return early - Log error]
    H -->|Sí| J[Generar recibo]
    J -->|Error| K[Usar fallback 'unavailable']
    J -->|OK| L[DB Transaction]
    L -->|Error DB| M[500 - Stripe reintentará]
    L -->|OK| N[PayPal Payout]
    N -->|Error| O[Log error + 200 OK]
    N -->|OK| P[Update payment reference]
    P --> Q[200 OK]
    
    style B fill:#ffcdd2
    style F fill:#fff9c4
    style H fill:#fff9c4
    style L fill:#c8e6c9
    style N fill:#d1c4e9
```

### Diagrama 4: Flujo de GET /api/payments (Listar)

```mermaid
graph TD
    A[GET /api/payments?role=payer] --> B[requireAuth]
    B -->|No auth| C[401]
    B -->|Auth OK| D[paymentListQuerySchema.parse]
    D -->|Invalid| E[400 ZodError]
    D -->|Valid| F[getPagination]
    F --> G[Construir WHERE clause]
    G -->|role=payer| H[debtorUserId = sessionUser.id]
    G -->|role=receiver| I[issuerUserId = sessionUser.id]
    H --> J[Aplicar filtros opcionales]
    I --> J
    J --> K[paymentMethod?]
    J --> L[minAmount/maxAmount?]
    J --> M[dateFrom/dateTo?]
    K --> N[db.payment.count + findMany]
    L --> N
    M --> N
    N --> O[Calcular totalPages]
    O --> P[200 OK con meta + data]
    
    style D fill:#ffecb3
    style G fill:#e1bee7
    style N fill:#bbdefb
```

### Diagrama 5: Flujo de PayPal Payout

```mermaid
graph TD
    A[createPayPalPayout llamado] --> B{Credenciales configuradas?}
    B -->|No| C[simulatePayPalPayout]
    C --> D[Return datos simulados]
    B -->|Sí| E[Convertir cents → decimal]
    E --> F[Generar senderBatchId único]
    F --> G[PayoutsPostRequest]
    G --> H[requestBody con sender/items]
    H --> I[getPayPalClient.execute]
    I -->|Error API| J[Throw Error con mensaje]
    I -->|Success| K[Return batch info]
    K --> L[payoutBatchId, batchStatus]
    L --> M[DB: Update payment reference]
    
    style B fill:#fff9c4
    style C fill:#ffccbc
    style I fill:#c5e1a5
    style K fill:#b2dfdb
```

### Diagrama 6: Flujo de Autorización en GET /payments/:id

```mermaid
graph TD
    A[GET /payments/123] --> B[requireAuth]
    B --> C[Parse ID]
    C -->|NaN o <=0| D[400 Invalid ID]
    C -->|Valid| E[db.payment.findUnique con invoice]
    E -->|null| F[404 Not Found]
    E -->|Found| G{User es debtor?}
    G -->|Sí| H[200 OK - Return payment]
    G -->|No| I{User es issuer?}
    I -->|Sí| H
    I -->|No| J[403 Forbidden]
    
    style G fill:#c8e6c9
    style I fill:#c8e6c9
    style H fill:#81c784
```

### Diagrama 7: Estados de Invoice y Payment

```mermaid
stateDiagram-v2
    [*] --> PENDING: Invoice creada
    PENDING --> OVERDUE: Fecha vencida
    PENDING --> PAID: Pago exitoso
    OVERDUE --> PAID: Pago exitoso
    PENDING --> CANCELLED: Cancelada
    OVERDUE --> CANCELLED: Cancelada
    PAID --> [*]
    CANCELLED --> [*]
    
    note right of PAID
        Payment creado aquí
        - paymentDate
        - paymentMethod: PAYPAL
        - paymentReference
        - receiptPdfUrl
    end note
```

### Diagrama 8: Flujo Temporal del Sistema

```mermaid
sequenceDiagram
    actor Usuario
    participant Frontend
    participant API
    participant Stripe
    participant DB
    participant PayPal
    participant Cloudinary
    
    Usuario->>Frontend: Clic "Pagar Factura"
    Frontend->>API: POST /checkout {invoiceId}
    API->>API: requireAuth + validate
    API->>DB: findUnique(invoice)
    DB-->>API: Invoice data
    API->>API: Validar permisos y estado
    API->>Stripe: createCheckoutSession
    Stripe-->>API: {sessionId, url}
    API-->>Frontend: 201 {checkoutUrl}
    Frontend->>Usuario: Redirect a Stripe
    Usuario->>Stripe: Completa pago PayPal
    Stripe->>Stripe: Procesa PayPal
    Stripe->>API: POST /webhook (checkout.session.completed)
    API->>API: verifyWebhookSignature
    API->>Stripe: Retrieve receipt URL
    Stripe-->>API: receipt_url o null
    alt Sin receipt de Stripe
        API->>API: generateReceiptPdf
        API->>Cloudinary: uploadPdf
        Cloudinary-->>API: PDF URL
    end
    API->>DB: Transaction: CREATE payment + UPDATE invoice
    DB-->>API: OK
    API->>PayPal: createPayPalPayout
    PayPal-->>API: {batchId, status}
    API->>DB: UPDATE payment reference
    API-->>Stripe: 200 {received: true}
    Stripe->>Usuario: Email confirmación
    Note over Usuario,PayPal: Receptor recibe fondos en PayPal
```

---

## Validaciones y Seguridad

### Matriz de Validaciones

| Endpoint | Tipo | Validador | Campos Validados |
|----------|------|-----------|------------------|
| GET /payments | Query Params | `paymentListQuerySchema` | role, paymentMethod, amounts, dates, sort |
| GET /payments/:id | Path Param | Manual | ID numérico positivo |
| GET /payments/:id | Authorization | Manual | debtorUserId o issuerUserId === sessionUser.id |
| POST /checkout | Body | `stripeCheckoutCreateSchema` | invoiceId, successUrl, cancelUrl |
| POST /checkout | Authorization | Manual | debtorUserId === sessionUser.id |
| POST /checkout | Business | Manual | !payment, status PENDING/OVERDUE |
| GET /session/:sessionId | Path Param | Manual | sessionId format "cs_*" |
| GET /session/:sessionId | Authorization | Manual | payerId o receiverId === sessionUser.id |
| POST /webhook | Signature | `verifyWebhookSignature` | HMAC SHA-256 con webhook secret |
| POST /webhook | Idempotency | DB query | Payment no debe existir |

### Esquemas Zod Completos

```typescript
// paymentListQuerySchema
{
  role: enum(['payer', 'receiver']).default('payer'),
  paymentMethod: enum(PaymentMethod).optional(),
  minAmount: number().nonnegative().optional(),
  maxAmount: number().nonnegative().optional(),
  paymentDateFrom: string().datetime().optional(),
  paymentDateTo: string().datetime().optional(),
  sortBy: enum(['paymentDate', 'createdAt']).default('paymentDate'),
  sortOrder: enum(['asc', 'desc']).default('desc')
}
// + superRefine: minAmount <= maxAmount, dateFrom <= dateTo

// stripeCheckoutCreateSchema
{
  invoiceId: number().int().positive(),
  successUrl: url().optional(),
  cancelUrl: url().optional()
}
```

### Niveles de Seguridad

#### Nivel 1: Autenticación (requireAuth)
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) throw new Error('Unauthorized');
```

#### Nivel 2: Validación de Entrada (Zod)
```typescript
const parsed = schema.parse(data);
// Throws ZodError si inválido
```

#### Nivel 3: Autorización (Business Logic)
```typescript
if (invoice.debtorUserId !== sessionUser.id) {
  throw new Error('Forbidden');
}
```

#### Nivel 4: Webhook Signature Verification
```typescript
const event = stripe.webhooks.constructEvent(
  payload,
  signature,
  webhookSecret
);
// Verifica HMAC para prevenir ataques
```

---

## Manejo de Errores

### Jerarquía de Error Handling

```typescript
// handleError() en api-helpers.ts
export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { errors: error.issues },
      { status: 400 }
    );
  }
  
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { message: 'Forbidden' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Tabla de Códigos de Error

| Código | Tipo | Causa Común | Respuesta |
|--------|------|-------------|-----------|
| 400 | Bad Request | Validación Zod, ID inválido, estado incorrecto | `{ errors: [...] }` o `{ message: "..." }` |
| 401 | Unauthorized | Sin sesión, JWT inválido | `{ error: "Unauthorized" }` |
| 403 | Forbidden | No es el debtor/issuer | `{ message: "Forbidden" }` |
| 404 | Not Found | Payment/Invoice no existe | `{ message: "... not found" }` |
| 500 | Internal Error | Error DB, Stripe API, PayPal API | `{ error: "..." }` |

### Estrategias de Recuperación

#### 1. Reintentos Automáticos (Stripe Webhook)
- Stripe reintenta automáticamente webhooks fallidos
- Exponential backoff hasta 3 días
- Implementar idempotencia para evitar duplicados

#### 2. Fallbacks
```typescript
// Recibo PDF
let receiptUrl = '';
try {
  receiptUrl = await getStripeReceipt();
} catch {
  receiptUrl = await generateAndUploadPDF();
}
if (!receiptUrl) {
  receiptUrl = 'unavailable'; // Fallback final
}
```

#### 3. Logging y Monitoreo
```typescript
console.error('[Stripe Webhook] Error:', error);
console.log('[PayPal Payout] Success:', result);
// TODO: Integrar con servicio de logging (Sentry, DataDog)
```

#### 4. Transacciones DB
```typescript
await db.$transaction(async (tx) => {
  await tx.payment.create(...);
  await tx.invoice.update(...);
});
// Si cualquier operación falla, rollback automático
```

---

## Referencias de API

### Endpoints Disponibles

| Método | Ruta | Descripción | Auth | Body/Params |
|--------|------|-------------|------|-------------|
| GET | `/api/payments` | Listar pagos paginados | ✅ | Query params |
| GET | `/api/payments/:id` | Detalle de pago | ✅ | Path param: id |
| POST | `/api/payments/stripe/checkout` | Crear sesión Stripe | ✅ | Body: invoiceId, urls |
| GET | `/api/payments/stripe/session/:sessionId` | Estado de sesión | ✅ | Path param: sessionId |
| POST | `/api/payments/stripe/webhook` | Webhook de Stripe | ❌ | Event payload |

### Variables de Entorno Requeridas

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:80

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox  # o 'live'

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

### Librerías Principales

```json
{
  "stripe": "^17.4.0",
  "@paypal/payouts-sdk": "^1.1.1",
  "@prisma/client": "^6.1.0",
  "next-auth": "^4.24.0",
  "zod": "^3.23.0",
  "pdfkit": "^0.15.2",
  "cloudinary": "^2.5.1"
}
```

### Tipos TypeScript Importantes

```typescript
// Metadata de sesión Stripe
interface StripePaymentMetadata {
  invoiceId: string;
  payerId: string;
  receiverId: string;
  invoiceNumber: string;
  payerEmail: string;
  receiverEmail: string;
}

// Resultado de payout PayPal
interface PayPalPayoutResult {
  payoutBatchId: string;
  batchStatus: string;
  payoutItemId?: string;
  transactionId?: string;
  transactionStatus?: string;
  error?: string;
}

// Estados de sesión Stripe
type StripeSessionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'canceled';
```

---

## Diagramas Adicionales: Casos de Error

### Diagrama 9: Flujo de Pago Fallido

```mermaid
graph TD
    A[Usuario inicia pago] --> B[POST /checkout]
    B --> C{Validaciones OK?}
    C -->|No| D[400/403 Error Response]
    C -->|Sí| E[Redirect a Stripe]
    E --> F[Usuario en Stripe Checkout]
    F -->|Cancela| G[Redirect a cancelUrl]
    F -->|Pago falla| H[async_payment_failed event]
    F -->|Sesión expira| I[session.expired event]
    H --> J[handleAsyncPaymentFailed]
    I --> K[handleSessionExpired]
    J --> L[Log error - No crear Payment]
    K --> M[Log info - No cambios en DB]
    G --> N[Usuario ve mensaje de cancelación]
    L --> O[Invoice permanece PENDING/OVERDUE]
    M --> O
    
    style D fill:#ffcdd2
    style H fill:#ffcdd2
    style I fill:#fff9c4
    style L fill:#ffab91
    style O fill:#ffccbc
```

### Diagrama 10: Flujo de PayPal Payout Fallido

```mermaid
graph TD
    A[Pago Stripe exitoso] --> B[Payment creado en DB]
    B --> C[Iniciar PayPal Payout]
    C --> D{Credenciales configuradas?}
    D -->|No| E[simulatePayPalPayout]
    D -->|Sí| F[PayPal API request]
    F -->|Error de red| G[Catch error]
    F -->|API error| H[Catch error]
    F -->|Límite excedido| I[Catch error]
    G --> J[Log error + Webhook 200]
    H --> J
    I --> J
    J --> K[Payment existe pero sin payout]
    K --> L[TODO: Cola de reintentos]
    E --> M[Log simulación + 200 OK]
    
    style G fill:#ffcdd2
    style H fill:#ffcdd2
    style I fill:#ffcdd2
    style K fill:#fff9c4
    style L fill:#ffe082
```

### Diagrama 11: Manejo de Errores en Generación de Recibo

```mermaid
graph TD
    A[processSuccessfulPayment] --> B{Stripe receipt disponible?}
    B -->|Sí| C[Usar receipt_url de Stripe]
    B -->|No| D[generateReceiptPdf]
    D -->|Error PDFKit| E[Catch error]
    D -->|Success| F[uploadPdf a Cloudinary]
    F -->|Error upload| G[Catch error]
    F -->|Success| H[receiptPdfUrl = cloudinary URL]
    E --> I[receiptPdfUrl = 'unavailable']
    G --> I
    C --> J[receiptPdfUrl = stripe URL]
    H --> K[Continuar con Payment creation]
    I --> K
    J --> K
    K --> L[DB transaction]
    
    style E fill:#ffcdd2
    style G fill:#ffcdd2
    style I fill:#ffab91
    style K fill:#c8e6c9
```

---

## Resumen de Integraciones

### Diagrama 12: Mapa de Integraciones

```mermaid
graph LR
    A[ClutchPay API] --> B[Stripe API]
    A --> C[PayPal API]
    A --> D[Cloudinary API]
    A --> E[PostgreSQL DB]
    A --> F[NextAuth]
    
    B -->|Checkout Sessions| B1[stripe.checkout.sessions]
    B -->|Payment Intents| B2[stripe.paymentIntents]
    B -->|Charges| B3[stripe.charges]
    B -->|Webhooks| B4[stripe.webhooks]
    
    C -->|Payouts| C1[payoutsSdk.payouts]
    
    D -->|Upload| D1[cloudinary.uploader]
    
    E -->|ORM| E1[Prisma Client]
    
    F -->|Auth| F1[getServerSession]
    
    style A fill:#4fc3f7
    style B fill:#7e57c2
    style C fill:#0277bd
    style D fill:#ff6f00
    style E fill:#388e3c
    style F fill:#d32f2f
```

---

## Conclusión

Este sistema de pagos implementa:

✅ **Autenticación robusta** con NextAuth  
✅ **Validación exhaustiva** con Zod  
✅ **Transacciones atómicas** con Prisma  
✅ **Webhooks seguros** con verificación de firma  
✅ **Manejo de errores** con múltiples niveles de fallback  
✅ **Idempotencia** para prevenir duplicados  
✅ **Logging** para debugging y monitoreo  
✅ **Integración completa** Stripe + PayPal  

**Flujo principal**: Usuario → Stripe Checkout → Webhook → DB → PayPal Payout → Receptor

---

*Documentación generada el 9 de diciembre de 2025*  
*Versión: 1.0*  
*Proyecto: ClutchPay - Pasarela de Pagos*
