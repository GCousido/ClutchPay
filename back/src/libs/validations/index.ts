// Export all validations from a single entry point
export * from './invoice';
export * from './user';

// Helper to format Zod errors
import { ZodError } from 'zod';
export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  error.issues.forEach((issue) => {
    const field = issue.path.join('.') || 'body';
    formatted[field] = issue.message;
  });
  
  return formatted;
}

// Helper for safe async validation
export async function validateAsync<T>(
  schema: any,
  data: unknown
): Promise<
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> }
> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    throw error;
  }
}
