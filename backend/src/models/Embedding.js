const mongoose = require('mongoose');

const embeddingSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    source: { type: String, required: true }, // e.g., note title or "Course Description"
  },
  { timestamps: true }
);

embeddingSchema.index({ courseId: 1 });
embeddingSchema.index({ noteId: 1 });

module.exports = mongoose.model('Embedding', embeddingSchema);
