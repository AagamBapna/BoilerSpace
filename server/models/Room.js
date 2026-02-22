const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
    {
        buildingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building',
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        floor: {
            type: Number,
            default: 1,
        },
        capacity: {
            type: Number,
            default: 0,
        },
        amenities: {
            type: [String],
            default: [],
        },
        noiseLevel: {
            type: String,
            enum: ['quiet', 'moderate', 'loud'],
            default: 'moderate',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
