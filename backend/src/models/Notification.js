const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true,
        },
        buildingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building',
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);