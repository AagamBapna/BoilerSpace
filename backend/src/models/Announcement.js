const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: false, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: false, default: null },
    authorId: { type: mongoose.Schema.Types.Mixed, required: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

announcementSchema.index({ eventId: 1, createdAt: 1 });
announcementSchema.index({ clubId: 1, createdAt: 1 });

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
