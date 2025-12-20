import type { NextConfig } from 'next';

// Get the frontend URL and server IP from environment variables
const serverIp = (process.env.SERVER_IP || 'localhost').replace(/^https?:\/\//, ''); // Strip protocol if present
const frontendPort = process.env.FRONTEND_PORT || '80';

// Build base origins (without port considerations)
const baseOrigins = [
  'localhost',
  serverIp,
].filter((origin, index, self) => self.indexOf(origin) === index);

const nextConfig: NextConfig = {
  // Enable standalone output for production builds
  output: 'standalone',
  
  // Exclude packages that need native file access from bundling
  // PDFKit needs to read AFM font files from disk at runtime
  serverExternalPackages: ['pdfkit'],
  
  // API only configuration - CORS headers for external access
  async headers() {
    // Create rules that match origins with or without :80 (or configured frontend port)
    return baseOrigins.flatMap(base => {
      // Regex to match http://base or http://base:80 or http://base:frontendPort
      const originRegex = `http://${base.replace(/\./g, '\\.')}(:${frontendPort})?`;
      
      return [
        // Match with explicit port
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Credentials", value: "true" },
            { key: "Access-Control-Allow-Origin", value: `http://${base}:${frontendPort}` },
            { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
            { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
          ],
          has: [
            {
              type: 'header',
              key: 'origin',
              value: `http://${base.replace(/\./g, '\\.')}:${frontendPort}`,
            },
          ],
        },
        // Match without port (when browser omits default port 80)
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Credentials", value: "true" },
            { key: "Access-Control-Allow-Origin", value: `http://${base}` },
            { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
            { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
          ],
          has: [
            {
              type: 'header',
              key: 'origin',
              value: `http://${base.replace(/\./g, '\\.')}(?!:)`, // Negative lookahead to match without port
            },
          ],
        },
      ];
    });
  },
};

export default nextConfig;

