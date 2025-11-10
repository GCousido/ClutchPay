// Export all validations from a single entry point
export * from './invoice';
export * from './notification';
export * from './payment';
export * from './user';

// Helper to format Zod errors
import { ZodError } from 'zod';
export function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

// Helper for safe async validation
export async function validateAsync<T>(
  schema: any,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: { field: string; message: string }[] }> {
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
