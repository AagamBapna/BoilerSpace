const multer = require('multer');
const { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../models/Note');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, and JPEG files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
});

module.exports = upload;
