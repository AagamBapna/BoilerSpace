const mongoose = require('mongoose');

const studyGuideSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    notesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

studyGuideSchema.index({ courseId: 1, createdAt: -1 });

module.exports = mongoose.model('StudyGuide', studyGuideSchema);
