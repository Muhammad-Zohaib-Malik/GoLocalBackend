import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath, fname) => {
  try {
    if (!localFilePath) return null;
    // Upload the file to Cloudinary

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: fname,
    });

    return response;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    // Remove the temporary local file if upload fails
    if (fs.existsSync(localFilePath)) {
      console.log("Cloudinary localFilePath:", localFilePath);
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

const deleteOnCloudinary = async (public_id) => {
  try {
    if (!public_id) return null;
    // Delete the file from Cloudinary
    const response = await cloudinary.uploader.destroy(public_id);
    console.log("Cloudinary response:", response);
    return response;
  } catch (error) {
    return null;
  }
};

/**
 * Helper function to upload photos to Cloudinary.
 * @param {string} filePath - The local file path of the photo.
 * @param {string} folder - The folder in Cloudinary.
 * @returns {Promise<string|null>} - The Cloudinary URL or null if upload fails.
 */
const uploadPhoto = async (filePath, folder) => {
  try {
    const cloudinaryResponse = await uploadOnCloudinary(filePath, folder);
    return cloudinaryResponse?.secure_url || null;
  } catch (error) {
    console.error("Error uploading photo to Cloudinary:", error);
    return null;
  }
};

/**
 * Helper function to delete photos from Cloudinary using their URL.
 * @param {string} photoUrl - The secure_url of the photo from Cloudinary.
 * @returns {Promise<any|null>} - The Cloudinary response or null if delete fails.
 */
const deletePhoto = async (photoUrl) => {
  try {
    if (!photoUrl) return null;

    // Extract public_id from URL
    // Typical URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const uploadPath = photoUrl.split("/upload/")[1];
    if (!uploadPath) return null;

    // Remove versioning (v + numbers) if present
    const pathWithoutVersion = uploadPath.replace(/^v\d+\//, "");

    // Remove extension
    const publicId = pathWithoutVersion.substring(
      0,
      pathWithoutVersion.lastIndexOf("."),
    );
    const finalPublicId = publicId || pathWithoutVersion;

    return await deleteOnCloudinary(finalPublicId);
  } catch (error) {
    console.error("Error deleting photo from Cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteOnCloudinary, uploadPhoto, deletePhoto };
