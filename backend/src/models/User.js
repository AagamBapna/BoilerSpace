const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [emailRegex, 'Please provide a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            select: false,
        },
        displayName: {
            type: String,
            required: [true, 'Display name is required'],
            trim: true,
        },
        major: {
            type: String,
            required: [true, 'Major is required'],
            trim: true,
        },
        year: {
            type: String,
            required: [true, 'Year is required'],
            trim: true,
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        courses: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
        }],
        bookmarks: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
        }],
        availability: [{
            day: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                required: true,
            },
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
        }],
        profileVisibility: {
            type: String,
            enum: ['public', 'private'],
            default: 'public',
        },
        resetPasswordTokenHash: {
            type: String,
            select: false,
        },
        resetPasswordExpiresAt: {
            type: Date,
            select: false,
        },
        // list of club ids the user belongs to
        clubIds: { type: [String], default: [] },
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

module.exports = mongoose.model('User', userSchema);
