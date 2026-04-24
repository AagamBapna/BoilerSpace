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
        },
        buildingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Building',
        },
        type: {
            type: String,
            enum: ['roomCapacity', 'sessionReminder', 'message', 'event', 'organizationUpdate', 'noteUpload'],
            default: 'roomCapacity',
        },
        message: {
            type: String,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
        },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);