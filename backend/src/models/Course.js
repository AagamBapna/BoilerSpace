const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        semester: {
            type: String,
            enum: ['Fall', 'Spring', 'Summer'],
            default: 'Spring',
        },
        year: {
            type: Number,
            default: new Date().getFullYear(),
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
