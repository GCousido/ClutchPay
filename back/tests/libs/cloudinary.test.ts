// tests/libs/cloudinary.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cloudinary before importing our functions
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn(),
    },
  },
}));

// Import after mocking
import { deleteImage, extractPublicId, uploadImage } from '@/libs/cloudinary';
import { v2 as cloudinary } from 'cloudinary';

describe('Cloudinary Image Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload a base64 image successfully', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123/clutchpay/profile-images/abc123.jpg',
        public_id: 'clutchpay/profile-images/abc123',
      };

      vi.mocked(cloudinary.uploader.upload).mockResolvedValue(mockResult as any);

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...';
      const result = await uploadImage(base64Image);

      expect(result).toEqual({
        url: mockResult.secure_url,
        publicId: mockResult.public_id,
      });

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        base64Image,
        expect.objectContaining({
          folder: 'ClutchPay/profile_images',
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'fill', gravity: 'center' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        })
      );
    });

    it('should upload to custom folder when specified', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/image/upload/v123/custom-folder/xyz789.jpg',
        public_id: 'custom-folder/xyz789',
      };

      vi.mocked(cloudinary.uploader.upload).mockResolvedValue(mockResult as any);

      const base64Image = 'data:image/png;base64,iVBORw0KGgo...';
      await uploadImage(base64Image, 'custom-folder');

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        base64Image,
        expect.objectContaining({
          folder: 'custom-folder',
        })
      );
    });

    it('should throw error when upload fails', async () => {
      vi.mocked(cloudinary.uploader.upload).mockRejectedValue(
        new Error('Cloudinary API error')
      );

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQ...';

      await expect(uploadImage(base64Image)).rejects.toThrow(
        'Failed to upload image to Cloudinary'
      );
    });
  });

  describe('deleteImage', () => {
    it('should delete an image successfully', async () => {
      const mockResult = { result: 'ok' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'clutchpay/profile-images/abc123';
      const result = await deleteImage(publicId);

      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId);
    });

    it('should handle "not found" result without throwing', async () => {
      const mockResult = { result: 'not found' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'clutchpay/profile-images/nonexistent';
      const result = await deleteImage(publicId);

      expect(result).toEqual(mockResult);
    });

    it('should throw error when deletion fails', async () => {
      const mockResult = { result: 'error' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'clutchpay/profile-images/abc123';

      await expect(deleteImage(publicId)).rejects.toThrow(
        'Failed to delete image from Cloudinary'
      );
    });

    it('should throw error when Cloudinary API fails', async () => {
      vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(
        new Error('Network error')
      );

      const publicId = 'clutchpay/profile-images/abc123';

      await expect(deleteImage(publicId)).rejects.toThrow(
        'Failed to delete image from Cloudinary'
      );
    });
  });

  describe('extractPublicId', () => {
    it('should extract public_id from standard Cloudinary URL', () => {
      const url = 'https://res.cloudinary.com/test/image/upload/v1234567/clutchpay/profile-images/abc123.jpg';
      const publicId = extractPublicId(url);

      expect(publicId).toBe('clutchpay/profile-images/abc123');
    });

    it('should extract public_id from URL without version', () => {
      const url = 'https://res.cloudinary.com/test/image/upload/clutchpay/profile-images/xyz789.png';
      const publicId = extractPublicId(url);

      expect(publicId).toBe('clutchpay/profile-images/xyz789');
    });

    it('should handle different image extensions', () => {
      const urls = [
        'https://res.cloudinary.com/test/image/upload/v123/folder/image.jpg',
        'https://res.cloudinary.com/test/image/upload/v123/folder/image.png',
        'https://res.cloudinary.com/test/image/upload/v123/folder/image.webp',
      ];

      urls.forEach(url => {
        const publicId = extractPublicId(url);
        expect(publicId).toBe('folder/image');
      });
    });

    it('should return null for invalid URL', () => {
      const invalidUrls = [
        'https://example.com/image.jpg',
        'not-a-url',
        '',
        'https://res.cloudinary.com/test/invalid',
      ];

      invalidUrls.forEach(url => {
        const publicId = extractPublicId(url);
        expect(publicId).toBeNull();
      });
    });

    it('should return null when URL parsing throws error', () => {
      const publicId = extractPublicId('malformed://url');
      expect(publicId).toBeNull();
    });
  });
});
