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

export { clearMockSession };

