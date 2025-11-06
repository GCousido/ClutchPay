import { default as authProxy } from "next-auth/middleware";

export default authProxy;

// Protect dashboard routes
export const config = { 
  matcher: ["/dashboard/:path*"] 
};
