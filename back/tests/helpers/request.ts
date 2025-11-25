import { clearMockSession, setMockSession } from '../setup';

// Helper para crear Request objects en tests
export function createRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Request {
  const { method = 'GET', body, headers = {} } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  return new Request(url, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Helper para crear Request autenticado (mock de sesión)
export function createAuthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    userId: number;
    email?: string;
  }
): Request {
  const { method = 'GET', body, headers = {}, userId, email = `user${userId}@test.com` } = options;

  // Set the mock session globally
  setMockSession({
    user: { id: userId, email },
  });

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  return new Request(url, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function getJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

// Helper para testear API handlers de Next.js
export async function testApiHandler(options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  userId?: number | null;
}): Promise<Response> {
  const { method, url, body, headers = {}, userId } = options;

  // Extract route parameters from URL
  const params: Record<string, string> = {};
  
  // Parse URL to determine route file path
  // e.g., /api/users/1 -> users/[id]/route.ts with params.id = "1"
  // e.g., /api/users/1/contacts -> users/[id]/contacts/route.ts with params.id = "1"
  const apiPath = url.replace('/api/', '').split('?')[0]; // Remove query params
  const pathSegments = apiPath.split('/');
  
  let routePath = 'c:\\Users\\guill\\Documents\\4 - PDP\\back\\src\\app\\api';
  
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    
    // Check if this segment is a numeric ID (dynamic parameter)
    if (/^\d+$/.test(segment)) {
      params.id = segment;
      routePath += '\\[id]';
    } else {
      routePath += `\\${segment}`;
    }
  }
  
  routePath += '\\route.ts';

  // Dynamically import the route handler
  const routeModule = await import(routePath);
  
  // Setup authentication if userId is provided
  if (userId !== undefined && userId !== null) {
    setMockSession({
      user: { id: userId, email: `user${userId}@test.com` },
    });
  } else {
    clearMockSession();
  }

  // Create the request with a full URL (required by Request API)
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const request = new Request(fullUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Call the appropriate HTTP method handler
  const handler = routeModule[method];
  if (!handler) {
    throw new Error(`No ${method} handler found in ${routePath}`);
  }

  // Execute the handler
  const response = await handler(request, { params });

  // Cleanup
  clearMockSession();

  return response;
}

export { clearMockSession };

