import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { z } from 'zod';

// Custom phone validation
const phoneValidation = z
  .string()
  .optional()
  .nullable()
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const phone = parsePhoneNumberWithError(value);
        return phone.isValid();
      } catch {
        return false;
      }
    },
    { message: 'Invalid phone number (include the international prefix)' }
  )
  .transform((value) => {
    if (!value) return null;
    const phone = parsePhoneNumberWithError(value);
    return phone.format('E.164'); // Standard format: +34612345678
  });

// Secure password validation
const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(255, 'Password must not exceed 255 characters')
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /\d/.test(password), {
    message: 'Password must contain at least one number',
  })
  .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), {
    message: 'Password must contain at least one special character',
  });

// Schema for creating a user
export const userCreateSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .toLowerCase()
    .trim(),
  password: passwordValidation,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  surnames: z
    .string()
    .min(2, 'Surnames must be at least 2 characters')
    .max(100, 'Surnames must not exceed 100 characters')
    .trim(),
  phone: phoneValidation,
  country: z
    .string()
    .length(2, 'Country code must be ISO 3166-1 alpha-2 (2 characters)')
    .toUpperCase()
    .optional()
    .nullable(),
  imageUrl: z
    .string()
    .url('Invalid image URL')
    .optional()
    .nullable(),
});

// Schema for updating a user (all fields optional except validations)
export const userUpdateSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .toLowerCase()
    .trim()
    .optional(),
  password: passwordValidation.optional(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim()
    .optional(),
  surnames: z
    .string()
    .min(2, 'Surnames must be at least 2 characters')
    .max(100, 'Surnames must not exceed 100 characters')
    .trim()
    .optional(),
  phone: phoneValidation,
  country: z
    .string()
    .length(2, 'Country code must be ISO 3166-1 alpha-2')
    .toUpperCase()
    .optional()
    .nullable(),
  imageUrl: z
    .string()
    .url('Invalid image URL')
    .optional()
    .nullable(),
});

// Schema to add contacts (many-to-many)
export const addContactSchema = z.object({
  contactId: z.number().int().positive('Invalid contact ID'),
});

// Export inferred types
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type AddContactInput = z.infer<typeof addContactSchema>;
