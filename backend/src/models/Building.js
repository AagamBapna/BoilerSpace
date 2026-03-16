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
    },
    { timestamps: true }
);

module.exports = mongoose.model('Building', buildingSchema);
