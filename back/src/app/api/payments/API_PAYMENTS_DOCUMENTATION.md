# Documentación de API de Pagos (ClutchPay)

Este documento detalla el funcionamiento, flujos y especificaciones del módulo de pagos de la API de ClutchPay.

## Visión General

El sistema de pagos de ClutchPay permite a los usuarios (deudores) pagar facturas emitidas por otros usuarios (emisores). El flujo de pago utiliza **Stripe** como pasarela de pago principal (configurada para aceptar PayPal) y **PayPal Payouts** para dispersar los fondos al emisor de la factura.

### Flujo de Pago Completo

1.  **Inicio del Pago**: El deudor inicia el pago de una factura desde el frontend.
2.  **Sesión de Checkout**: El backend crea una sesión de Stripe Checkout configurada para PayPal.
3.  **Redirección**: El usuario es redirigido a Stripe/PayPal para autorizar el pago.
4.  **Confirmación**: Stripe procesa el pago y notifica al backend mediante Webhooks.
5.  **Registro**: El backend registra el pago y actualiza el estado de la factura a `PAID`.
6.  **Dispersión (Payout)**: Automáticamente, el backend inicia una transferencia (Payout) desde la cuenta de PayPal de la plataforma hacia la cuenta de PayPal del emisor de la factura, descontando la comisión de la plataforma.

---

## Integración Frontend (Vanilla JS)

Para implementar el pago en el frontend, se debe seguir el siguiente patrón. El usuario no introduce credenciales en nuestra aplicación; todo se delega a la página segura de Stripe/PayPal.

### Ejemplo de Implementación

```javascript
// Función para iniciar el pago de una factura
async function initiatePayment(invoiceId) {
    try {
        // 1. Solicitar creación de sesión de checkout al backend
        const response = await fetch('/api/payments/stripe/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Incluir token de autenticación si es necesario (cookies suelen manejarse automáticamente)
            },
            body: JSON.stringify({
                invoiceId: invoiceId,
                successUrl: window.location.origin + '/payment-success.html', // URL de retorno exitoso
                cancelUrl: window.location.origin + '/dashboard.html'         // URL de cancelación
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al iniciar el pago');
        }

        const session = await response.json();

        // 2. Redirigir al usuario a la URL de checkout proporcionada por Stripe
        if (session.checkoutUrl) {
            window.location.href = session.checkoutUrl;
        } else {
            throw new Error('No se recibió URL de redirección');
        }

    } catch (error) {
        console.error('Error de pago:', error);
        alert('No se pudo iniciar el pago: ' + error.message);
    }
}
```

### Autorización del Usuario (PayPal)

El proceso de autorización ocurre completamente fuera de nuestra aplicación:

1.  Al redirigir a `session.checkoutUrl`, el usuario aterriza en una página alojada por Stripe.
2.  El usuario selecciona **PayPal** como método de pago.
3.  Se abre una ventana emergente o se redirige a **paypal.com**.
4.  **Login**: El usuario inicia sesión con sus credenciales de PayPal (email y contraseña).
5.  **Aprobación**: PayPal muestra el monto a pagar y las fuentes de fondos (saldo, tarjeta, cuenta bancaria). El usuario confirma el pago.
6.  **Retorno**: PayPal devuelve al usuario a Stripe, y Stripe lo redirige a la `successUrl` definida en el paso 1.

---

## Detalle del Flujo de Fondos (Money Flow)

Es crucial entender que existen dos movimientos de dinero separados:

### 1. Recaudación (Debtor -> Platform)
*   **Actor**: Deudor (Payer).
*   **Vía**: Stripe Checkout (PayPal Method).
*   **Destino**: Cuenta de Stripe de la Plataforma (ClutchPay).
*   **Resultado**: El dinero entra al saldo de Stripe de la plataforma.

### 2. Dispersión (Platform -> Issuer)
*   **Actor**: Plataforma (ClutchPay).
*   **Vía**: PayPal Payouts API.
*   **Origen**: Cuenta de PayPal de la Plataforma (Business Account).
*   **Destino**: Cuenta de PayPal del Emisor (Receiver).
*   **Resultado**: El dinero sale del saldo de PayPal de la plataforma y llega al usuario.

> **Nota Importante de Liquidez**: Stripe y PayPal son ecosistemas separados. El dinero cobrado en Stripe **NO** aparece automáticamente en la cuenta de PayPal para hacer el payout.
> *   La plataforma debe asegurarse de tener **saldo suficiente en su cuenta de PayPal Business** para cubrir los payouts automáticos.
> *   Periódicamente, el administrador debe retirar fondos de Stripe a su banco y recargar la cuenta de PayPal, o mantener un fondo de maniobra en PayPal.

---

## Endpoints

### 1. Listar Pagos

Recupera una lista paginada de pagos relacionados con el usuario autenticado.

*   **Método**: `GET`
*   **Ruta**: `/api/payments`
*   **Autenticación**: Requerida

#### Parámetros de Consulta (Query Params)

| Parámetro | Tipo | Descripción | Ejemplo |
| :--- | :--- | :--- | :--- |
| `page` | `number` | Número de página (defecto: 1) | `1` |
| `limit` | `number` | Elementos por página (defecto: 10) | `20` |
| `role` | `string` | Rol del usuario en el pago: `payer` (pagador) o `receiver` (receptor). | `payer` |
| `paymentMethod` | `string` | Filtrar por método: `PAYPAL`, `VISA`, `MASTERCARD`, `OTHER`. | `PAYPAL` |
| `minAmount` | `number` | Monto mínimo de la factura. | `100.00` |
| `maxAmount` | `number` | Monto máximo de la factura. | `500.00` |
| `paymentDateFrom` | `string` | Fecha inicial (ISO 8601). | `2024-01-01T00:00:00Z` |
| `paymentDateTo` | `string` | Fecha final (ISO 8601). | `2024-12-31T23:59:59Z` |
| `sortBy` | `string` | Campo de ordenamiento: `paymentDate`, `amount`. | `paymentDate` |
| `sortOrder` | `string` | Dirección: `asc` o `desc`. | `desc` |

#### Respuesta Exitosa (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "invoiceId": 10,
      "paymentDate": "2024-03-15T10:00:00.000Z",
      "paymentMethod": "PAYPAL",
      "paymentReference": "pi_3Op...",
      "amount": 150.00,
      "currency": "EUR",
      "status": "COMPLETED",
      "invoice": {
        "invoiceNumber": "INV-001",
        "issuerUser": { "name": "Juan", "email": "juan@example.com" },
        "debtorUser": { "name": "Pedro", "email": "pedro@example.com" }
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 2. Obtener Detalle de Pago

Recupera información detallada de un pago específico. Solo accesible para el pagador o el receptor.

*   **Método**: `GET`
*   **Ruta**: `/api/payments/:id`
*   **Autenticación**: Requerida

#### Respuesta Exitosa (200 OK)

```json
{
  "id": 1,
  "invoiceId": 10,
  "paymentDate": "2024-03-15T10:00:00.000Z",
  "paymentMethod": "PAYPAL",
  "paymentReference": "pi_3Op...",
  "receiptPdfUrl": "https://...",
  "invoice": {
    "invoiceNumber": "INV-001",
    "amount": 150.00,
    "status": "PAID",
    "issuerUser": { ... },
    "debtorUser": { ... }
  }
}
```

#### Errores Comunes

*   `403 Forbidden`: El usuario no es ni el pagador ni el receptor de la factura asociada.
*   `404 Not Found`: El pago no existe.

---

### 3. Crear Sesión de Checkout (Stripe)

Inicia el proceso de pago creando una sesión en Stripe.

*   **Método**: `POST`
*   **Ruta**: `/api/payments/stripe/checkout`
*   **Autenticación**: Requerida (Solo el deudor de la factura puede iniciarla)

#### Cuerpo de la Petición (JSON)

```json
{
  "invoiceId": 10,
  "successUrl": "https://mi-app.com/pagos/exito",
  "cancelUrl": "https://mi-app.com/pagos/cancelado"
}
```

#### Validaciones

*   La factura debe existir.
*   El usuario autenticado debe ser el `debtorUserId` de la factura.
*   La factura no debe estar ya pagada (`invoice.payment` debe ser null).
*   El estado de la factura debe ser `PENDING` o `OVERDUE`.

#### Respuesta Exitosa (200 OK)

```json
{
  "sessionId": "cs_test_a1b2c3...",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/..."
}
```

---

### 4. Consultar Estado de Sesión (Stripe)

Verifica el estado de una sesión de pago de Stripe. Útil para confirmar el pago en el frontend tras la redirección.

*   **Método**: `GET`
*   **Ruta**: `/api/payments/stripe/session/:sessionId`
*   **Autenticación**: Requerida

#### Respuesta Exitosa (200 OK)

```json
{
  "sessionId": "cs_test_a1b2c3...",
  "status": "complete",
  "paymentStatus": "paid",
  "amount": 15000, // en centavos
  "currency": "eur",
  "invoice": {
    "id": 10,
    "status": "PAID"
  }
}
```

---

### 5. Webhook de Stripe

Endpoint público que recibe notificaciones de eventos de Stripe. **No requiere autenticación de usuario**, pero verifica la firma criptográfica de Stripe (`stripe-signature`).

*   **Método**: `POST`
*   **Ruta**: `/api/payments/stripe/webhook`

#### Eventos Manejados

1.  `checkout.session.completed`: El pago se ha completado exitosamente.
2.  `checkout.session.async_payment_succeeded`: Un pago asíncrono (como algunos flujos de PayPal) se ha confirmado.
3.  `checkout.session.async_payment_failed`: El pago falló.
4.  `checkout.session.expired`: La sesión expiró sin pago.

#### Acciones tras Pago Exitoso

Cuando se recibe `checkout.session.completed` o `async_payment_succeeded`:

1.  **Verificación**: Se valida que la factura exista y no esté pagada.
2.  **Registro de Pago**: Se crea un registro en la tabla `Payment` con:
    *   `paymentMethod`: `PAYPAL`
    *   `paymentReference`: ID del PaymentIntent de Stripe (`pi_...`).
3.  **Actualización de Factura**: El estado de la factura cambia a `PAID`.
4.  **Dispersión (Payout)**: Se invoca `createPayPalPayout` para transferir los fondos al emisor.
    *   Se calcula la comisión de la plataforma (2.9% + 0.30€).
    *   Se envía el monto neto al email de PayPal del emisor (`receiverEmail`).
    *   Se actualiza `paymentReference` concatenando el ID del payout (`pi_...|PAYOUT:...`).

---

## Características Técnicas Importantes

### Integración con PayPal Payouts

El sistema utiliza la API de PayPal Payouts para dispersar fondos.

*   **Librería**: `@paypal/payouts-sdk`
*   **Entorno**: Configurable vía `PAYPAL_MODE` (`sandbox` o `live`).
*   **Manejo de Errores**: Si el payout falla, el webhook **no falla** (retorna 200 OK) para evitar reintentos infinitos de Stripe, pero registra el error. El pago queda registrado, pero la dispersión debe revisarse manualmente.

### Seguridad

*   **Autenticación**: Todos los endpoints de usuario requieren sesión activa (`requireAuth`).
*   **Autorización**: Se verifica estrictamente que solo los participantes de una factura (emisor/deudor) puedan ver o manipular sus pagos.
*   **Webhooks**: Protegidos mediante validación de firma (`stripe-signature`) usando `STRIPE_WEBHOOK_SECRET`.

### Variables de Entorno Requeridas

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox
```
