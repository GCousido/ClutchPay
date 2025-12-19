// tests/libs/resend-integration.test.ts
import { Resend } from 'resend';
import { beforeAll, describe, expect, it } from 'vitest';

const runIntegration =
  !!process.env.RESEND_API_KEY &&
  process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegration ? describe : describe.skip)('Resend Integration (real)', () => {
  let resend: Resend;

  beforeAll(() => {
    resend = new Resend(process.env.RESEND_API_KEY!);
  });

  it('verifies Resend API key is valid', async () => {
    // List domains to verify authentication
    const { data, error } = await resend.domains.list();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data?.data)).toBe(true);
  }, 10_000);

  it('verifies from email domain exists or uses default', async () => {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const domain = fromEmail.split('@')[1];

    expect(domain).toBeDefined();
    expect(domain.length).toBeGreaterThan(0);

    // List domains to check if the configured domain exists
    const { data } = await resend.domains.list();
    
    if (data?.data) {
      const configuredDomain = data.data.find((d) => d.name === domain);
      
      if (configuredDomain) {
        expect(configuredDomain.status).toBe('verified');
      }
    }
  }, 10_000);

  it('can send a test email (optional - only if TEST_EMAIL_RECIPIENT is set)', async () => {
    // Only run if we have a test recipient email configured
    const testEmail = process.env.TEST_EMAIL_RECIPIENT;
    
    if (!testEmail) {
      // Skip test if no recipient configured
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: testEmail,
      subject: 'ClutchPay Integration Test',
      html: '<p>This is a test email from ClutchPay integration tests.</p>',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeDefined();
  }, 15_000);

  it('verifies API key format', () => {
    const apiKey = process.env.RESEND_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^re_/);
    expect(apiKey!.length).toBeGreaterThan(20);
  });

  it('can retrieve API key information', async () => {
    // Get API keys to verify access
    const { data, error } = await resend.apiKeys.list();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data?.data)).toBe(true);
  }, 10_000);
});
