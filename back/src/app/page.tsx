function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '24px',
        padding: '60px 50px',
        boxShadow: '0 20px 60px rgba(46, 125, 50, 0.15)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: '120px',
          height: '120px',
          margin: '0 auto 30px',
          background: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(67, 160, 71, 0.3)'
        }}>
          <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '48px',
          fontWeight: '700',
          color: '#2e7d32',
          marginBottom: '20px',
          letterSpacing: '-0.5px'
        }}>
          ClutchPay API
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '20px',
          color: '#558b2f',
          marginBottom: '40px',
          fontWeight: '500'
        }}>
          Secure Payment Gateway Service
        </p>

        {/* Description */}
        <div style={{
          fontSize: '16px',
          lineHeight: '1.8',
          color: '#555',
          marginBottom: '40px',
          textAlign: 'left'
        }}>
          <p style={{ marginBottom: '20px' }}>
            Welcome to <strong>ClutchPay</strong>, a payment processing platform 
            designed to simplify financial transactions.
          </p>
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          background: '#e8f5e9',
          padding: '16px 32px',
          borderRadius: '50px',
          fontSize: '16px',
          fontWeight: '600',
          color: '#2e7d32',
          border: '2px solid #81c784'
        }}>
          <span style={{
            width: '12px',
            height: '12px',
            background: '#4caf50',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
            boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.7)'
          }} />
          <span>API Deployed Successfully</span>
        </div>

        {/* Footer */}
        <p style={{
          marginTop: '50px',
          fontSize: '14px',
          color: '#888',
          fontStyle: 'italic'
        }}>
          Powered by Next.js • PostgreSQL • Stripe • PayPal
        </p>
      </div>

      {/* Keyframe animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
          }
        }
      `}} />
    </div>
  )
}

export default Home