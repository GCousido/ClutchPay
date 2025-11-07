// Exportar todas las validaciones desde un solo punto
export * from './invoice';
export * from './notification';
export * from './payment';
export * from './user';

// Helper para manejar errores de Zod
import { ZodError } from 'zod';

export function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formatted[path] = err.message;
  });
  
  return formatted;
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
