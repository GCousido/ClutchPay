import type { NextConfig } from 'next';

// Get the frontend URL and server IP from environment variables
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:80';
const serverIp = (process.env.SERVER_IP || 'localhost').replace(/^https?:\/\//, ''); // Strip protocol if present

// Build list of allowed origins for CORS
const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  `http://${serverIp}`,
  `http://${serverIp}:80`,
  frontendUrl,
].filter((origin, index, self) => self.indexOf(origin) === index); // Remove duplicates

const nextConfig: NextConfig = {
  // Enable standalone output for production builds
  output: 'standalone',
  
  // API only configuration - CORS headers for external access
  async headers() {
    return allowedOrigins.map((origin) => ({
      source: "/:path*",
      headers: [
        { key: "Access-Control-Allow-Credentials", value: "true" },
        { key: "Access-Control-Allow-Origin", value: origin },
        { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
      ],
    }));
  },
};

export default nextConfig;

