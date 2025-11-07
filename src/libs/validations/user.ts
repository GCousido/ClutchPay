import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { z } from 'zod';

// Validación de teléfono personalizada
const phoneValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (value) => {
      if (!value) return true; // Opcional
      try {
        const phone = parsePhoneNumberWithError(value);
        return phone.isValid();
      } catch {
        return false;
      }
    },
    { message: 'Número de teléfono inválido (incluye el prefijo internacional)' }
  )
  .transform((value) => {
    if (!value) return null;
    const phone = parsePhoneNumberWithError(value);
    return phone.format('E.164'); // Formato estándar: +34612345678
  });

// Validación de contraseña segura
const passwordValidation = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(255, 'La contraseña no puede exceder 255 caracteres')
  .refine((password) => /[A-Z]/.test(password), {
    message: 'La contraseña debe contener al menos una mayúscula',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'La contraseña debe contener al menos una minúscula',
  })
  .refine((password) => /\d/.test(password), {
    message: 'La contraseña debe contener al menos un número',
  })
  .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), {
    message: 'La contraseña debe contener al menos un carácter especial',
  });

// Schema para crear usuario
export const userCreateSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: passwordValidation,
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  surnames: z
    .string()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden exceder 100 caracteres')
    .trim(),
  phone: phoneValidation,
  country: z
    .string()
    .length(2, 'El código de país debe ser ISO 3166-1 alpha-2 (2 caracteres)')
    .toUpperCase()
    .optional()
    .nullable(),
  imageUrl: z
    .string()
    .url('URL de imagen inválida')
    .optional()
    .nullable(),
});

// Schema para actualizar usuario (todos los campos opcionales excepto validaciones)
export const userUpdateSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional(),
  password: passwordValidation.optional(),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim()
    .optional(),
  surnames: z
    .string()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden exceder 100 caracteres')
    .trim()
    .optional(),
  phone: phoneValidation,
  country: z
    .string()
    .length(2, 'El código de país debe ser ISO 3166-1 alpha-2')
    .toUpperCase()
    .optional()
    .nullable(),
  imageUrl: z
    .string()
    .url('URL de imagen inválida')
    .optional()
    .nullable(),
});

// Schema para agregar contactos (many-to-many)
export const addContactSchema = z.object({
  contactId: z.number().int().positive('ID de contacto inválido'),
});

// Tipos TypeScript inferidos
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type AddContactInput = z.infer<typeof addContactSchema>;
