const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    authorId: { type: mongoose.Schema.Types.Mixed, required: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

announcementSchema.index({ eventId: 1, createdAt: 1 });

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
