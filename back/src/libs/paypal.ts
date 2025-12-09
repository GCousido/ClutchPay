// libs/paypal.ts
import payoutsSdk from '@paypal/payouts-sdk';

/**
 * PayPal API client configuration.
 * 
 * Required environment variables:
 * - PAYPAL_CLIENT_ID: PayPal REST API client ID
 * - PAYPAL_CLIENT_SECRET: PayPal REST API client secret
 * - PAYPAL_MODE: 'sandbox' for testing, 'live' for production
 */

const isProduction = process.env.PAYPAL_MODE === 'live';

/**
 * Creates the PayPal environment based on configuration
 */
function getPayPalEnvironment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  
  if (isProduction) {
    return new payoutsSdk.core.LiveEnvironment(clientId, clientSecret);
  }
  return new payoutsSdk.core.SandboxEnvironment(clientId, clientSecret);
}

/**
 * PayPal HTTP client instance (lazy initialization)
 */
let _paypalClient: InstanceType<typeof payoutsSdk.core.PayPalHttpClient> | null = null;

function getPayPalClient() {
  if (!_paypalClient) {
    _paypalClient = new payoutsSdk.core.PayPalHttpClient(getPayPalEnvironment());
  }
  return _paypalClient;
}

/**
 * Result of a PayPal payout operation
 */
export interface PayPalPayoutResult {
  payoutBatchId: string;
  batchStatus: string;
  payoutItemId?: string;
  transactionId?: string;
  transactionStatus?: string;
  error?: string;
}

/**
 * Parameters for creating a PayPal payout
 */
export interface CreatePayoutParams {
  receiverEmail: string;
  amount: number; // Amount in cents
  currency: string;
  invoiceNumber: string;
  note?: string;
  senderId: number;
  receiverId: number;
}

/**
 * Creates a PayPal payout to transfer funds to the invoice issuer
 * 
 * Flow: After Stripe payment succeeds, this transfers funds to the receiver's PayPal
 * 
 * @param params - Payout parameters
 * @returns Promise with payout result including batch ID and status
 * @throws Error if payout creation fails
 */
export async function createPayPalPayout(params: CreatePayoutParams): Promise<PayPalPayoutResult> {
  const {
    receiverEmail,
    amount,
    currency,
    invoiceNumber,
    note,
    senderId,
    receiverId,
  } = params;

  // Convert cents to decimal for PayPal (they expect decimal amounts)
  const decimalAmount = (amount / 100).toFixed(2);
  
  // Create unique sender batch ID for tracking
  const senderBatchId = `CLUTCHPAY_${Date.now()}_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
  
  try {
    // Check if PayPal credentials are configured
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.warn('[PayPal Payout] PayPal credentials not configured. Simulating payout.');
      return simulatePayPalPayout(params, senderBatchId);
    }

    const request = new payoutsSdk.payouts.PayoutsPostRequest();
    request.requestBody({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: `Payment received for Invoice ${invoiceNumber}`,
        email_message: note || `You have received a payment of ${decimalAmount} ${currency.toUpperCase()} for Invoice ${invoiceNumber} via ClutchPay.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: decimalAmount,
            currency: currency.toUpperCase(),
          },
          receiver: receiverEmail,
          note: `Payment for Invoice ${invoiceNumber}`,
          sender_item_id: `ITEM_${senderId}_${receiverId}_${invoiceNumber}`,
        },
      ],
    });

    const response = await getPayPalClient().execute<payoutsSdk.payouts.PayoutCreateResponse>(request);
    const result = response.result;
    
    console.log('[PayPal Payout] Batch created:', {
      batchId: result.batch_header?.payout_batch_id,
      status: result.batch_header?.batch_status,
      receiver: receiverEmail,
      amount: decimalAmount,
      currency: currency.toUpperCase(),
    });

    return {
      payoutBatchId: result.batch_header?.payout_batch_id || senderBatchId,
      batchStatus: result.batch_header?.batch_status || 'PENDING',
      payoutItemId: result.items?.[0]?.payout_item_id,
      transactionId: result.items?.[0]?.transaction_id,
      transactionStatus: result.items?.[0]?.transaction_status,
    };
  } catch (error: any) {
    console.error('[PayPal Payout] Error creating payout:', error);
    
    // If it's an API error, extract details
    if (error.result) {
      const apiError = error.result;
      throw new Error(`PayPal payout failed: ${apiError.message || apiError.name || 'Unknown error'}`);
    }
    
    throw new Error(`PayPal payout failed: ${error.message}`);
  }
}

/**
 * Simulates a PayPal payout for development/testing when credentials aren't configured
 */
function simulatePayPalPayout(params: CreatePayoutParams, batchId: string): PayPalPayoutResult {
  const decimalAmount = (params.amount / 100).toFixed(2);
  
  console.log('[PayPal Payout] SIMULATED payout:', {
    receiver: params.receiverEmail,
    amount: decimalAmount,
    currency: params.currency.toUpperCase(),
    invoiceNumber: params.invoiceNumber,
    batchId,
  });

  return {
    payoutBatchId: batchId,
    batchStatus: 'PENDING',
    payoutItemId: `SIMULATED_ITEM_${Date.now()}`,
    transactionId: `SIMULATED_TXN_${Date.now()}`,
    transactionStatus: 'SUCCESS',
  };
}

/**
 * Retrieves the status of a payout batch
 * 
 * @param payoutBatchId - The payout batch ID to check
 * @returns Promise with the current batch status
 */
export async function getPayoutStatus(payoutBatchId: string): Promise<{
  batchStatus: string;
  items: Array<{
    payoutItemId: string;
    transactionStatus: string;
    payoutItemFee?: { value: string; currency: string };
  }>;
}> {
  try {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return {
        batchStatus: 'SUCCESS',
        items: [{ payoutItemId: 'SIMULATED', transactionStatus: 'SUCCESS' }],
      };
    }

    const request = new payoutsSdk.payouts.PayoutsGetRequest(payoutBatchId);
    const response = await getPayPalClient().execute<payoutsSdk.payouts.PayoutGetResponse>(request);
    const result = response.result;
    
    return {
      batchStatus: result.batch_header?.batch_status || 'UNKNOWN',
      items: (result.items || []).map((item: payoutsSdk.payouts.PayoutItemResponse) => ({
        payoutItemId: item.payout_item_id || '',
        transactionStatus: item.transaction_status || 'UNKNOWN',
        payoutItemFee: item.payout_item_fee,
      })),
    };
  } catch (error: any) {
    console.error('[PayPal Payout] Error getting payout status:', error);
    throw new Error(`Failed to get payout status: ${error.message}`);
  }
}

/**
 * Calculates the net amount after PayPal fees
 * PayPal typically charges around 2% for payouts (varies by country/currency)
 * 
 * @param amountCents - Gross amount in cents
 * @param feePercentage - Fee percentage (default 2%)
 * @returns Net amount in cents after fees
 */
export function calculateNetAfterFees(amountCents: number, feePercentage: number = 2): number {
  const feeAmount = Math.ceil(amountCents * (feePercentage / 100));
  return amountCents - feeAmount;
}

/**
 * Validates a PayPal email address format
 * 
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export function isValidPayPalEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
