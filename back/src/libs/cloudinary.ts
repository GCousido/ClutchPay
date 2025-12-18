// libs/cloudinary.ts
import { InternalServerError } from '@/libs/api-helpers';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an image to Cloudinary with automatic transformations
 * @param {string} base64Image - Base64 encoded image (with data:image/ prefix)
 * @param {string} [folder='ClutchPay/profile_images'] - Cloudinary folder path
 * @returns {Promise<{url: string, publicId: string}>} Secure URL and public ID of the resource
 * @throws {Error} If Cloudinary upload fails
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
    throw new InternalServerError('Failed to upload image to Cloudinary');
  }
}

/**
 * Deletes an image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<DestroyResult>} Result of the deletion operation
 * @throws {Error} If deletion fails or result is unexpected
 */
export async function deleteImage(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new InternalServerError(`Cloudinary delete failed: ${result.result}`);
    }
    
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new InternalServerError('Failed to delete image from Cloudinary');
  }
}

/**
 * Extracts the public_id from a Cloudinary URL
 * @param {string} url - Cloudinary image/document URL
 * @returns {string | null} Extracted public ID or null if URL is invalid
 * @example
 * extractPublicId('https://res.cloudinary.com/cloud/image/upload/v123/folder/image.jpg')
 * // returns 'folder/image'
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
 * Uploads a PDF to Cloudinary as a raw resource
 * @param {string} base64Pdf - Base64 encoded PDF (with data:application/pdf;base64, prefix)
 * @param {string} [folder='ClutchPay/invoices'] - Cloudinary folder path
 * @returns {Promise<{url: string, publicId: string}>} Secure URL and public ID of the resource
 * @throws {Error} If Cloudinary upload fails
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
    throw new InternalServerError('Failed to upload PDF to Cloudinary');
  }
}

/**
 * Deletes a PDF from Cloudinary (raw resource)
 * @param {string} publicId - Public ID of the PDF to delete
 * @returns {Promise<DestroyResult>} Result of the deletion operation
 * @throws {Error} If deletion fails or result is unexpected
 */
export async function deletePdf(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
    });
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new InternalServerError(`Failed to delete PDF: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error('Cloudinary PDF delete error:', error);
    throw new InternalServerError('Failed to delete PDF from Cloudinary');
  }
}

/**
 * Generates a signed URL for secure PDF access
 * @param {string} publicIdOrUrl - Public ID or full URL of the PDF in Cloudinary
 * @param {number} [expiresIn=3600] - Expiration time in seconds (default 1 hour)
 * @returns {string} Signed URL that allows temporary access to the PDF
 */
export function getSignedPdfUrl(publicIdOrUrl: string, expiresIn: number = 3600): string {
  // If it's already a URL, extract the public_id
  let publicId = publicIdOrUrl;
  if (publicIdOrUrl.includes('cloudinary.com')) {
    publicId = extractPublicId(publicIdOrUrl) || publicIdOrUrl;
  }
  
  // Remove .pdf extension if present
  const cleanPublicId = publicId.replace(/\.pdf$/, '');
  
  const timestamp = Math.round(Date.now() / 1000) + expiresIn;
  
  // Generate signed URL with proper configuration
  const signedUrl = cloudinary.url(cleanPublicId + '.pdf', {
    resource_type: 'raw',
    sign_url: true,
    type: 'upload',
    secure: true
  });
  
  return signedUrl;
}

export { cloudinary };

