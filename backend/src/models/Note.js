const mongoose = require('mongoose');

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

const noteSchema = new mongoose.Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, 'Course ID is required'],
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Uploader ID is required'],
        },
        title: {
            type: String,
            required: [true, 'Note title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        description: {
            type: String,
            trim: true,
            default: '',
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        fileUrl: {
            type: String,
            required: [true, 'File URL is required'],
        },
        fileName: {
            type: String,
            required: [true, 'File name is required'],
            trim: true,
        },
        fileSize: {
            type: Number,
            required: [true, 'File size is required'],
            max: [MAX_FILE_SIZE, 'File size cannot exceed 16MB'],
        },
        fileType: {
            type: String,
            required: [true, 'File type is required'],
            enum: {
                values: ALLOWED_FILE_TYPES,
                message: 'File type must be PDF, PNG, or JPEG',
            },
        },
    },
    { timestamps: true }
);

noteSchema.index({ courseId: 1, createdAt: -1 });
noteSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('Note', noteSchema);
module.exports.ALLOWED_FILE_TYPES = ALLOWED_FILE_TYPES;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
