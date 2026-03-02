const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
    {
        courseCode: {
            type: String,
            required: [true, 'Course code is required'],
            unique: true,
            uppercase: true,
            trim: true,
        },
        title: {
            type: String,
            required: [true, 'Course title is required'],
            trim: true,
        },
        department: {
            type: String,
            required: [true, 'Department is required'],
            uppercase: true,
            trim: true,
        },
        semester: {
            type: String,
            enum: ['Fall', 'Spring', 'Summer'],
            required: [true, 'Semester is required'],
            trim: true,
        },
        credits: {
            type: Number,
            default: 3,
            min: [0, 'Credits cannot be negative'],
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
    },
    { timestamps: true }
);

courseSchema.index({ department: 1 });

module.exports = mongoose.model('Course', courseSchema);
