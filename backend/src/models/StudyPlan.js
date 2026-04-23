const mongoose = require('mongoose');

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const studyPlanSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, default: 'Study Plan' },
        courses: [{
            courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
            examDate: { type: Date, required: true },
            priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        }],
        preferredStudyHours: {
            startTime: { type: String, default: '09:00' },
            endTime: { type: String, default: '19:00' },
        },
        busySlots: [{
            day: { type: String, enum: days, required: true },
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
            label: { type: String, default: '' },
        }],
        blocks: [{
            day: { type: String, enum: days, required: true },
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
            courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            courseCode: { type: String },
            topic: { type: String, default: '' },
        }],
        weekStartDate: { type: Date },
    },
    { timestamps: true }
);

studyPlanSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('StudyPlan', studyPlanSchema);