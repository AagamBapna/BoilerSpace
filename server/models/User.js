const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        major: {
            type: String,
            trim: true,
            default: '',
        },
        year: {
            type: Number,
            min: 2020,
            max: 2030,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        courses: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
        }],
        profileVisibility: {
            type: String,
            enum: ['public', 'private'],
            default: 'public',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
