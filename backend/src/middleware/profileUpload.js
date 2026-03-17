const multer = require('multer');

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PNG and JPEG images are allowed.'), false);
    }
};

const profileUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_PROFILE_PICTURE_SIZE,
    },
});

module.exports = profileUpload;
