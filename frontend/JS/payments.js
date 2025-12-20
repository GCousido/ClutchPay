/**
 * PaymentManager - Gestión de Pagos con Stripe
 * 
 * Este módulo maneja todo el flujo de pagos:
 * - Crear sesiones de checkout
 * - Consultar estado de sesiones
 * - Listar pagos del usuario
 * - Obtener detalle de un pago
 */
class PaymentManager {
    /**
     * Constructor
     * @param {Auth} authInstance - Instancia de Auth para obtener API_BASE_URL
     */
    constructor(authInstance) {
        this.auth = authInstance;
        this.API_BASE_URL = authInstance.API_BASE_URL;
    }

    /**
     * Crear sesión de checkout (Iniciar Pago)
     * 
     * @param {number} invoiceId - ID de la factura a pagar
     * @param {Object} options - Opciones adicionales
     * @param {string} options.successUrl - URL de redirección tras éxito
     * @param {string} options.cancelUrl - URL de redirección si cancela
     * @returns {Promise<{success: boolean, checkoutUrl?: string, error?: string}>}
     */
    async createCheckoutSession(invoiceId, options = {}) {
        try {
            // Configurar URLs de redirección con el invoiceId y session_id en los parámetros
            const baseOrigin = window.location.origin;
            const successUrl = options.successUrl || `${baseOrigin}/main.html?payment=success&invoiceId=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`;
            const cancelUrl = options.cancelUrl || `${baseOrigin}/main.html?payment=cancel&invoiceId=${invoiceId}`;

            console.log('[Payment] Creating checkout session for invoice:', invoiceId);
            console.log('[Payment] Success URL:', successUrl);
            console.log('[Payment] Cancel URL:', cancelUrl);

            // Llamada a la API
            const response = await fetch(`${this.API_BASE_URL}/api/payments/stripe/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invoiceId: invoiceId,
                    successUrl: successUrl,
                    cancelUrl: cancelUrl,
                }),
                credentials: 'include',  // Envía cookies de sesión
            });

            // Manejar errores HTTP
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Payment] Checkout error:', response.status, errorData);
                
                return {
                    success: false,
                    error: this.getErrorMessage(response.status, errorData),
                };
            }

            // Parsear respuesta exitosa
            const data = await response.json();
            
            console.log('[Payment] Checkout session created:', data.sessionId);

            return {
                success: true,
                sessionId: data.sessionId,
                checkoutUrl: data.checkoutUrl,
                invoice: data.invoice,
            };
        } catch (error) {
            console.error('[Payment] Network error:', error);
            return {
                success: false,
                error: 'Error de conexión. Por favor, inténtalo de nuevo.',
            };
        }
    }

    /**
     * Consultar estado de sesión
     * 
     * @param {string} sessionId - ID de sesión de Stripe (cs_xxx)
     * @returns {Promise<Object>} Estado de la sesión
     */
    async getSessionStatus(sessionId) {
        try {
            // Validar formato de sessionId
            if (!sessionId || !sessionId.startsWith('cs_')) {
                return {
                    success: false,
                    error: 'ID de sesión inválido',
                };
            }

            const response = await fetch(
                `${this.API_BASE_URL}/api/payments/stripe/session/${sessionId}`,
                {
                    method: 'GET',
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: this.getErrorMessage(response.status, errorData),
                };
            }

            const data = await response.json();
            
            return {
                success: true,
                sessionId: data.sessionId,
                status: data.status,
                paymentStatus: data.paymentStatus,
                amount: data.amount,
                currency: data.currency,
                invoice: data.invoice,
            };
        } catch (error) {
            console.error('[Payment] Error getting session status:', error);
            return {
                success: false,
                error: 'Error de conexión',
            };
        }
    }

    /**
     * Listar pagos del usuario
     * 
     * @param {Object} options - Opciones de filtrado
     * @param {string} options.role - 'payer' (pagos hechos) o 'receiver' (pagos recibidos)
     * @param {string} options.paymentMethod - PAYPAL, VISA, MASTERCARD, OTHER
     * @param {number} options.page - Número de página (default: 1)
     * @param {number} options.limit - Items por página (default: 10)
     * @returns {Promise<Object>} Lista paginada de pagos
     */
    async listPayments(options = {}) {
        try {
            // Construir query params
            const params = new URLSearchParams();
            
            if (options.role) params.append('role', options.role);
            if (options.paymentMethod) params.append('paymentMethod', options.paymentMethod);
            if (options.page) params.append('page', options.page.toString());
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.sortBy) params.append('sortBy', options.sortBy);
            if (options.sortOrder) params.append('sortOrder', options.sortOrder);

            const url = `${this.API_BASE_URL}/api/payments?${params.toString()}`;
            
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: this.getErrorMessage(response.status, errorData),
                };
            }

            const data = await response.json();
            
            return {
                success: true,
                meta: data.meta,
                payments: data.data,
            };
        } catch (error) {
            console.error('[Payment] Error listing payments:', error);
            return {
                success: false,
                error: 'Error de conexión',
            };
        }
    }

    /**
     * Obtener detalle de pago
     * 
     * @param {number} paymentId - ID del pago
     * @returns {Promise<Object>} Detalle del pago
     */
    async getPaymentDetail(paymentId) {
        try {
            const response = await fetch(
                `${this.API_BASE_URL}/api/payments/${paymentId}`,
                {
                    method: 'GET',
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: this.getErrorMessage(response.status, errorData),
                };
            }

            const payment = await response.json();
            
            return {
                success: true,
                payment: payment,
            };
        } catch (error) {
            console.error('[Payment] Error getting payment detail:', error);
            return {
                success: false,
                error: 'Error de conexión',
            };
        }
    }

    /**
     * Convierte códigos de error HTTP a mensajes amigables
     * @private
     */
    getErrorMessage(statusCode, errorData) {
        const messages = {
            400: errorData.message || 'Datos inválidos',
            401: 'Debes iniciar sesión para realizar esta acción',
            403: errorData.message || 'No tienes permisos para realizar esta acción',
            404: errorData.message || 'Recurso no encontrado',
            409: errorData.message || 'Esta factura ya ha sido pagada',
            500: 'Error del servidor. Por favor, inténtalo más tarde',
        };

        return messages[statusCode] || errorData.message || 'Error inesperado';
    }
}
