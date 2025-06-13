import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'aromix', // change to your folder name
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  },
});

const upload = multer({ storage });

export default upload;