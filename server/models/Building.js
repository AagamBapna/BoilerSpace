const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        abbreviation: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('Building', buildingSchema);
