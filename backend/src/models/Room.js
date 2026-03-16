const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
    {
        buildingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building',
            required: [true, 'Building reference is required'],
        },
        name: {
            type: String,
            required: [true, 'Room name is required'],
            trim: true,
        },
        floor: {
            type: Number,
            default: 1,
        },
        capacity: {
            type: Number,
            default: 0,
            min: [0, 'Capacity cannot be negative'],
        },
        amenities: {
            type: [String],
            default: [],
        },
        noiseLevel: {
            type: String,
            enum: {
                values: ['quiet', 'moderate', 'loud'],
                message: 'noiseLevel must be quiet, moderate, or loud',
            },
            default: 'moderate',
        },
        currentOccupancy: {
            type: Number,
            default: 0,
            min: [0, 'Capacity can not be negative'],
        },
        lastActivityAt: {
            default: null,
            type: Date,
        },
    },
    { timestamps: true }
);

// Compound index — a room name must be unique within a building
roomSchema.index({ buildingId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
