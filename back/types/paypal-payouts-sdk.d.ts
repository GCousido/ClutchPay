// types/paypal-payouts-sdk.d.ts
declare module '@paypal/payouts-sdk' {
  export namespace core {
    class PayPalEnvironment {
      constructor(clientId: string, clientSecret: string);
    }

    class SandboxEnvironment extends PayPalEnvironment {
      constructor(clientId: string, clientSecret: string);
    }

    class LiveEnvironment extends PayPalEnvironment {
      constructor(clientId: string, clientSecret: string);
    }

    class PayPalHttpClient {
      constructor(environment: PayPalEnvironment);
      execute<T>(request: any): Promise<{ result: T; statusCode: number }>;
    }
  }

  export namespace payouts {
    interface PayoutItem {
      recipient_type: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';
      amount: {
        value: string;
        currency: string;
      };
      receiver: string;
      note?: string;
      sender_item_id?: string;
    }

    interface PayoutBatchHeader {
      sender_batch_id: string;
      email_subject?: string;
      email_message?: string;
    }

    interface PayoutCreateRequest {
      sender_batch_header: PayoutBatchHeader;
      items: PayoutItem[];
    }

    interface PayoutBatchResponseHeader {
      payout_batch_id: string;
      batch_status: string;
      sender_batch_header?: PayoutBatchHeader;
    }

    interface PayoutItemResponse {
      payout_item_id?: string;
      transaction_id?: string;
      transaction_status?: string;
      payout_item_fee?: {
        value: string;
        currency: string;
      };
    }

    interface PayoutCreateResponse {
      batch_header: PayoutBatchResponseHeader;
      items?: PayoutItemResponse[];
    }

    interface PayoutGetResponse {
      batch_header: PayoutBatchResponseHeader;
      items?: PayoutItemResponse[];
    }

    class PayoutsPostRequest {
      constructor();
      requestBody(body: PayoutCreateRequest): this;
    }

    class PayoutsGetRequest {
      constructor(payoutBatchId: string);
    }
  }
}
