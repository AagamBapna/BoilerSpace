const mongoose = require('mongoose');

const aiBookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    promptString: {
      type: String,
      required: [true, 'Prompt is required'],
      trim: true,
    },
    aiResponseText: {
      type: String,
      required: [true, 'AI response text is required'],
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
  },
  { timestamps: true }
);

aiBookmarkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AIBookmark', aiBookmarkSchema);
