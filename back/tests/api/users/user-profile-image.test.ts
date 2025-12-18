// tests/api/users/user-profile-image.test.ts
import * as cloudinaryLib from '@/libs/cloudinary';
import { db } from '@/libs/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testApiHandler } from '../../helpers/request';

// Mock Cloudinary functions
vi.mock('@/libs/cloudinary', async () => {
  const actual = await vi.importActual('@/libs/cloudinary');
  return {
    ...actual,
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
    extractPublicId: vi.fn(),
  };
});

// Mock database
vi.mock('@/libs/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('User Profile Image Management', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedpassword',
    name: 'John',
    surnames: 'Doe',
    phone: '+34612345678',
    country: 'ES',
    imageUrl: null,
    emailNotifications: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCloudinaryUrl = 'https://res.cloudinary.com/test/image/upload/v123/clutchpay/profile-images/abc123.jpg';
  const mockPublicId = 'clutchpay/profile-images/abc123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(cloudinaryLib.uploadImage).mockResolvedValue({
      url: mockCloudinaryUrl,
      publicId: mockPublicId,
    });
    
    vi.mocked(cloudinaryLib.deleteImage).mockResolvedValue({ result: 'ok' } as any);
    
    vi.mocked(cloudinaryLib.extractPublicId).mockImplementation((url: string) => {
      if (url && url.includes('cloudinary')) {
        return 'clutchpay/profile-images/old123';
      }
      return null;
    });
  });

  describe('PUT /api/users/:id - Upload First Image', () => {
    it('should upload profile image for user without existing image', async () => {
      const userWithoutImage = { ...mockUser, imageUrl: null };
      
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce(userWithoutImage);
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithoutImage,
        imageUrl: mockCloudinaryUrl,
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.imageUrl).toBe(mockCloudinaryUrl);
      expect(cloudinaryLib.uploadImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'
      );
      expect(cloudinaryLib.deleteImage).not.toHaveBeenCalled();
    });

    it('should upload image with other profile fields', async () => {
      const userWithoutImage = { ...mockUser, imageUrl: null };
      
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce(userWithoutImage);
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithoutImage,
        name: 'Jane',
        imageUrl: mockCloudinaryUrl,
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          name: 'Jane',
          imageBase64: 'data:image/png;base64,iVBORw0KGgo...',
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.name).toBe('Jane');
      expect(data.imageUrl).toBe(mockCloudinaryUrl);
    });
  });

  describe('PUT /api/users/:id - Replace Existing Image', () => {
    it('should replace existing image and delete old one', async () => {
      const oldImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/clutchpay/profile-images/old123.jpg';
      const userWithImage = { ...mockUser, imageUrl: oldImageUrl };
      
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce(userWithImage);
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithImage,
        imageUrl: mockCloudinaryUrl,
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,NEW_IMAGE_DATA...',
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.imageUrl).toBe(mockCloudinaryUrl);
      expect(cloudinaryLib.uploadImage).toHaveBeenCalled();
      expect(cloudinaryLib.extractPublicId).toHaveBeenCalledWith(oldImageUrl);
      expect(cloudinaryLib.deleteImage).toHaveBeenCalledWith('clutchpay/profile-images/old123');
    });

    it('should continue if old image deletion fails', async () => {
      const oldImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/clutchpay/profile-images/old123.jpg';
      const userWithImage = { ...mockUser, imageUrl: oldImageUrl };
      
      // Mock delete to fail
      vi.mocked(cloudinaryLib.deleteImage).mockRejectedValueOnce(
        new Error('Cloudinary deletion failed')
      );
      
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce(userWithImage);
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithImage,
        imageUrl: mockCloudinaryUrl,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,NEW_IMAGE_DATA...',
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [User] Failed to delete old profile image')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('PUT /api/users/:id - Delete Image', () => {
    it('should delete image by setting imageUrl to null', async () => {
      const oldImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/clutchpay/profile-images/old123.jpg';
      const userWithImage = { ...mockUser, imageUrl: oldImageUrl };
      
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithImage,
        imageUrl: null,
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageUrl: null,
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.imageUrl).toBeNull();
      expect(cloudinaryLib.uploadImage).not.toHaveBeenCalled();
    });

    it('should allow deleting image while updating other fields', async () => {
      const userWithImage = { 
        ...mockUser, 
        imageUrl: 'https://res.cloudinary.com/test/image/upload/v123/old.jpg' 
      };
      
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithImage,
        name: 'Updated Name',
        imageUrl: null,
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          name: 'Updated Name',
          imageUrl: null,
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.name).toBe('Updated Name');
      expect(data.imageUrl).toBeNull();
    });
  });

  describe('PUT /api/users/:id - Update Without Touching Image', () => {
    it('should update other fields without changing imageUrl', async () => {
      const existingImageUrl = 'https://res.cloudinary.com/test/image/upload/v123/existing.jpg';
      const userWithImage = { ...mockUser, imageUrl: existingImageUrl };
      
      vi.spyOn(db.user, 'update').mockResolvedValueOnce({
        ...userWithImage,
        name: 'Updated Name',
        phone: '+34698765432',
      });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          name: 'Updated Name',
          phone: '+34698765432',
        },
        userId: 1,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.name).toBe('Updated Name');
      expect(data.phone).toBe('+34698765432');
      expect(data.imageUrl).toBe(existingImageUrl);
      expect(cloudinaryLib.uploadImage).not.toHaveBeenCalled();
      expect(cloudinaryLib.deleteImage).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/users/:id - Error Handling', () => {
    it('should return 400 for invalid base64 image format', async () => {
      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'invalid-base64-string',
        },
        userId: 1,
      });

      expect(response.status).toBe(400);
    });

    it('should return error if Cloudinary upload fails', async () => {
      vi.mocked(cloudinaryLib.uploadImage).mockRejectedValueOnce(
        new Error('Failed to upload image to Cloudinary')
      );
      
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({ ...mockUser, imageUrl: null });

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        },
        userId: 1,
      });

      expect(response.status).toBe(500);
    });

    it('should require authentication', async () => {
      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        },
        userId: null, // No authentication
      });

      expect(response.status).toBe(401);
    });

    it('should prevent user from updating other user image', async () => {
      // Temporarily change to production to test authorization
      vi.stubEnv('NODE_ENV', 'production');

      const response = await testApiHandler({
        method: 'PUT',
        url: '/api/users/1',
        body: {
          imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        },
        userId: 999, // Different user
      });

      // Restore original environment
      vi.unstubAllEnvs();

      expect(response.status).toBe(403);
    });
  });
});
