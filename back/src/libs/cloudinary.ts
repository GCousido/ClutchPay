// libs/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an image to Cloudinary
 * @param base64Image - Base64 encoded image string (with data:image prefix)
 * @param folder - Cloudinary folder path (default: 'ClutchPay/profile_images')
 * @returns Upload result with secure_url and public_id
 */
export async function uploadImage(base64Image: string, folder = 'ClutchPay/profile_images') {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 500, height: 500, crop: 'fill', gravity: 'center' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}

/**
 * Delete an image from Cloudinary
 * @param publicId - Public ID of the image to delete
 * @returns Deletion result
 */
export async function deleteImage(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Failed to delete image: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
}

/**
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary image URL
 * @returns Public ID or null if invalid URL
 */
export function extractPublicId(url: string): string | null {
  try {
    // Example URL: https://res.cloudinary.com/cloud/image/upload/v1234567/clutchpay/profile-images/abc123.jpg
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

/**
 * Upload a PDF to Cloudinary
 * @param base64Pdf - Base64 encoded PDF string (with data:application/pdf prefix)
 * @param folder - Cloudinary folder path (default: 'ClutchPay/invoices')
 * @returns Upload result with secure_url and public_id
 */
export async function uploadPdf(base64Pdf: string, folder = 'ClutchPay/invoices') {
  try {
    const result = await cloudinary.uploader.upload(base64Pdf, {
      folder,
      resource_type: 'raw',
      format: 'pdf',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary PDF upload error:', error);
    throw new Error('Failed to upload PDF to Cloudinary');
  }
}

/**
 * Delete a PDF from Cloudinary
 * @param publicId - Public ID of the PDF to delete
 * @returns Deletion result
 */
export async function deletePdf(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    });
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Failed to delete PDF: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error('Cloudinary PDF delete error:', error);
    throw new Error('Failed to delete PDF from Cloudinary');
  }
}

export { cloudinary };

