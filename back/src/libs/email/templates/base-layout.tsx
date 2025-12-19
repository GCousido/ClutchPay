// libs/email/templates/base-layout.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

/**
 * Props for the base email layout component.
 */
export interface BaseLayoutProps {
  /** Preview text shown in email client inbox */
  preview: string;
  /** Main heading of the email */
  heading: string;
  /** Children content to render in the email body */
  children: React.ReactNode;
}

/**
 * Base layout component for all ClutchPay emails.
 * Provides consistent styling, header with logo, and footer.
 *
 * @param props - Component props
 * @param props.preview - Text shown in email preview
 * @param props.heading - Main heading displayed in the email
 * @param props.children - Email body content
 * @returns React element for the base email layout
 */
export function BaseLayout({ preview, heading, children }: BaseLayoutProps) {
  const appUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            <Link href={appUrl}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Img
                  src={`${backendUrl}/logo.svg`}
                  width="60"
                  height="60"
                  alt="ClutchPay"
                  style={{
                    display: 'block',
                    width: '60px',
                    height: '60px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </Link>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This email was sent by ClutchPay. If you have any questions,
              please contact our support team.
            </Text>
            <Text style={footerText}>
              <Link href={`${appUrl}/unsubscribe`} style={link}>
                Manage notification preferences
              </Link>
              {' • '}
              <Link href={appUrl} style={link}>
                Visit ClutchPay
              </Link>
            </Text>
            <Text style={footerTextSmall}>
              © {new Date().getFullYear()} ClutchPay. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '24px',
  textAlign: 'center' as const,
  backgroundColor: '#059669',
};

const logo = {
  margin: '0 auto',
};

const content = {
  padding: '24px 48px',
};

const h1 = {
  color: '#1a1a2e',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '0 0 24px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
};

const footer = {
  padding: '0 48px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
  textAlign: 'center' as const,
};

const footerTextSmall = {
  color: '#8898aa',
  fontSize: '10px',
  lineHeight: '14px',
  margin: '16px 0 0',
  textAlign: 'center' as const,
};

const link = {
  color: '#10b981',
  textDecoration: 'underline',
};

export default BaseLayout;
