// tests/libs/cloudinary-integration.test.ts
import { v2 as cloudinary } from 'cloudinary';
import { beforeAll, describe, expect, it } from 'vitest';

const runIntegration =
  (!!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    !!process.env.CLOUDINARY_URL) &&
  process.env.RUN_CLOUDINARY_INTEGRATION === 'true';

(runIntegration ? describe : describe.skip)('Cloudinary Integration (real)', () => {
  beforeAll(() => {
    // Configure Cloudinary before running tests
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  });

  it('uploads and deletes an image using real Cloudinary account', async () => {
    // Minimal 1x1 transparent PNG in base64
    const base64Image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const folder = 'ClutchPay/tests/images';

    // Upload image
    const uploadRes = await cloudinary.uploader.upload(base64Image, {
      folder,
      resource_type: 'image',
    } as any);

    expect(uploadRes).toHaveProperty('secure_url');
    expect(uploadRes).toHaveProperty('public_id');
    expect(uploadRes.secure_url).toContain('image/upload');
    const publicId = uploadRes.public_id as string;

    // Delete / cleanup
    const destroyRes = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    } as any);

    expect(['ok', 'not found']).toContain(destroyRes.result);
  }, 30_000);

  it('uploads and deletes a PDF using real Cloudinary account', async () => {
    // Minimal valid PDF in base64
    const base64Pdf =
      'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKNCAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDMgMCBSL1Jlc291cmNlcyA8PC9Gb250IDw8L0YxIDEgMCBSPj4+Pi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vQ29udGVudHMgNSAwIFI+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUCi9GMSA3MiBUZgoxMCA3MTJUZAKVSW50ZWdyYXRpb24gVGVzdApFVAplbmRzdHJlYW0KZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzIFs0IDAgUl0vQ291bnQgMT4+CmVuZG9iagozIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxODkgMDAwMDAgbiAKMDAwMDAwMDI1OCAwMDAwMCBuIAowMDAwMDAwMzE1IDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEyNCAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDMgMCBSPj4Kc3RhcnR4cmVmCjM2NAolJUVPRg==';

    const folder = 'ClutchPay/tests/invoices';

    // Upload PDF
    const uploadRes = await cloudinary.uploader.upload(base64Pdf, {
      folder,
      resource_type: 'raw',
      format: 'pdf',
    } as any);

    expect(uploadRes).toHaveProperty('secure_url');
    expect(uploadRes).toHaveProperty('public_id');
    expect(uploadRes.secure_url).toContain('raw/upload');
    expect(uploadRes.secure_url).toContain('.pdf');
    const publicId = uploadRes.public_id as string;

    // Delete / cleanup
    const destroyRes = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    } as any);

    expect(['ok', 'not found']).toContain(destroyRes.result);
  }, 30_000);
});
