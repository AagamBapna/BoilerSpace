const mongoose = require('mongoose');
const checkInSchema = new mongoose.Schema(
    {
        buildingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building',
            required: [true, 'Building reference is required'],
        },
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: [true, 'Room reference is required'],
        },
        expiresAt: {
          type: Date,
          required: [true, 'Expire time is required'],
        },
        userId: {
            type : mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
        },
    },
    { timestamps: true }
);


module.exports = mongoose.model('CheckIn', checkInSchema);
