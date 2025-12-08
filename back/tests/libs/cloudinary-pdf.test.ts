// tests/libs/cloudinary-pdf.test.ts
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
import { deletePdf, uploadPdf } from '@/libs/cloudinary';
import { v2 as cloudinary } from 'cloudinary';

describe('Cloudinary PDF Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadPdf', () => {
    it('should upload a base64 PDF successfully', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/raw/upload/v123/ClutchPay/invoices/invoice123.pdf',
        public_id: 'ClutchPay/invoices/invoice123',
      };

      vi.mocked(cloudinary.uploader.upload).mockResolvedValue(mockResult as any);

      const base64Pdf = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c...';
      const result = await uploadPdf(base64Pdf);

      expect(result).toEqual({
        url: mockResult.secure_url,
        publicId: mockResult.public_id,
      });

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        base64Pdf,
        expect.objectContaining({
          folder: 'ClutchPay/invoices',
          resource_type: 'raw',
          format: 'pdf',
        })
      );
    });

    it('should upload to custom folder when specified', async () => {
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/test/raw/upload/v123/custom-invoices/xyz789.pdf',
        public_id: 'custom-invoices/xyz789',
      };

      vi.mocked(cloudinary.uploader.upload).mockResolvedValue(mockResult as any);

      const base64Pdf = 'data:application/pdf;base64,JVBERi0xLjQK...';
      await uploadPdf(base64Pdf, 'custom-invoices');

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        base64Pdf,
        expect.objectContaining({
          folder: 'custom-invoices',
          resource_type: 'raw',
          format: 'pdf',
        })
      );
    });

    it('should throw error when PDF upload fails', async () => {
      vi.mocked(cloudinary.uploader.upload).mockRejectedValue(
        new Error('Cloudinary API error')
      );

      const base64Pdf = 'data:application/pdf;base64,JVBERi0xLjQK...';

      await expect(uploadPdf(base64Pdf)).rejects.toThrow(
        'Failed to upload PDF to Cloudinary'
      );
    });
  });

  describe('deletePdf', () => {
    it('should delete a PDF successfully', async () => {
      const mockResult = { result: 'ok' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'ClutchPay/invoices/invoice123';
      const result = await deletePdf(publicId);

      expect(result).toEqual(mockResult);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        publicId,
        expect.objectContaining({
          resource_type: 'raw',
        })
      );
    });

    it('should handle "not found" result without throwing', async () => {
      const mockResult = { result: 'not found' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'ClutchPay/invoices/nonexistent';
      const result = await deletePdf(publicId);

      expect(result).toEqual(mockResult);
    });

    it('should throw error when delete fails with unexpected result', async () => {
      const mockResult = { result: 'error' };
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValue(mockResult as any);

      const publicId = 'ClutchPay/invoices/invoice123';

      await expect(deletePdf(publicId)).rejects.toThrow(
        'Failed to delete PDF from Cloudinary'
      );
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(cloudinary.uploader.destroy).mockRejectedValue(
        new Error('Network error')
      );

      const publicId = 'ClutchPay/invoices/invoice123';

      await expect(deletePdf(publicId)).rejects.toThrow(
        'Failed to delete PDF from Cloudinary'
      );
    });
  });
});
