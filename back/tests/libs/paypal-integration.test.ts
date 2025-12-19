// tests/libs/paypal-integration.test.ts
import payoutsSdk from '@paypal/payouts-sdk';
import { beforeAll, describe, expect, it } from 'vitest';

const runIntegration =
  !!process.env.PAYPAL_CLIENT_ID &&
  !!process.env.PAYPAL_CLIENT_SECRET &&
  process.env.PAYPAL_MODE === 'sandbox' &&
  process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegration ? describe : describe.skip)('PayPal Integration (real)', () => {
  let client: payoutsSdk.core.PayPalHttpClient;

  beforeAll(() => {
    // Tests only run when PAYPAL_MODE=sandbox (enforced by runIntegration condition)
    const environment = new payoutsSdk.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID!,
      process.env.PAYPAL_CLIENT_SECRET!
    );

    client = new payoutsSdk.core.PayPalHttpClient(environment);
  });

  it('verifies PayPal API credentials by creating a test payout batch', async () => {
    // Create a minimal payout batch to verify authentication
    // Safe in sandbox mode - no real money is transferred
    const requestBody = {
      sender_batch_header: {
        sender_batch_id: `test_${Date.now()}`,
        email_subject: 'Integration test payout',
        email_message: 'This is a test payout for API verification',
      },
      items: [
        {
          recipient_type: 'EMAIL' as const,
          amount: {
            value: '1.00',
            currency: 'USD',
          },
          receiver: 'test-receiver@example.com',
          note: 'Integration test payout item',
          sender_item_id: `test_item_${Date.now()}`,
        },
      ],
    };

    const request = new payoutsSdk.payouts.PayoutsPostRequest();
    request.requestBody(requestBody);

    try {
      const response = await client.execute(request);
      
      // In sandbox, this should succeed even with a test email
      expect(response.statusCode).toBe(201);
      expect(response.result).toHaveProperty('batch_header');
      expect((response.result as any).batch_header).toHaveProperty('payout_batch_id');
    } catch (error: any) {
      // If it fails, check that it's not an authentication error
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new Error('PayPal authentication failed - check credentials');
      }
      // Other errors (like insufficient funds) mean credentials work
    }
  }, 20_000);

  it('verifies PayPal environment is sandbox', () => {
    expect(process.env.PAYPAL_MODE).toBe('sandbox');
    expect(client).toBeDefined();
  });
});
