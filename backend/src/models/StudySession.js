const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required'],
            index: true, // Speeds up queries since we filter by user heavily
        },
        startTime: {
            type: Date,
            required: [true, 'Start time is required'],
        },
        endTime: {
            type: Date,
            required: [true, 'End time is required'],
        },
        durationMinutes: {
            type: Number,
            required: [true, 'Duration in minutes is required'],
            min: [1, 'Study session must be at least 1 minute long'],
            max: [1440, 'Study session cannot mathematically exceed 24 hours (1440 mins)'],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('StudySession', studySessionSchema);
