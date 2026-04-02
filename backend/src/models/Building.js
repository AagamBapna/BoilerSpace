const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Building name is required'],
            unique: true,
            trim: true,
        },
        abbreviation: {
            type: String,
            required: [true, 'Abbreviation is required'],
            unique: true,
            uppercase: true,
            trim: true,
        },
        latitude: {
            type: Number,
            required: [true, 'Latitude is required'],
        },
        longitude: {
            type: Number,
            required: [true, 'Longitude is required'],
        },
        address: {
            type: String,
            default: '',
        },
        amenities: {
            type: [String],
            default: [],
        },
        imageUrl: {
            type: String,
            default: '',
        },
        lastActivityAt: {
            default: null,
            type: Date,
        },
        snackReports: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            type: { type: String, enum: ['cafe', 'vending'], required: true },
            value: { type: Boolean, required: true },
            createdAt: { type: Date, default: Date.now },
        }],
        cafeScore: { type: Number, default: 0 },
        vendingScore: { type: Number, default: 0 },
        cafeCount: { type: Number, default: 0 },
        vendingCount: { type: Number, default: 0 },
        lastSnackReportAt: { type: Date, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Building', buildingSchema);
