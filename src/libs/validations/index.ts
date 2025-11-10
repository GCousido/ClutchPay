// Exportar todas las validaciones desde un solo punto
export * from './invoice';
export * from './notification';
export * from './payment';
export * from './user';

// Helper para manejar errores de Zod
import { ZodError } from 'zod';

export function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

// Helper para validación async segura
export async function validateAsync<T>(
  schema: any,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }> {
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
