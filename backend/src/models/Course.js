const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Exam title is required'],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Exam date is required'],
        },
        location: {
            type: String,
            default: '',
            trim: true,
        },
    },
    { timestamps: true }
);

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
            required: [true, 'Semester is required'],
            trim: true,
            validate: {
                validator: (value) => /^(Spring|Summer|Fall)(\s\d{4})?$/.test(value),
                message: 'Semester must be Spring, Summer, or Fall (optionally with year, e.g. Spring 2026)',
            },
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
        exams: {
            type: [examSchema],
            default: [],
        },
    },
    { timestamps: true }
);

courseSchema.index({ department: 1 });

module.exports = mongoose.model('Course', courseSchema);
