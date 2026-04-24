const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: false, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: false, default: null },
    authorId: { type: mongoose.Schema.Types.Mixed, required: true },
    title: { type: String, trim: true },
    body: { type: String, required: true, trim: true },
    priorityLevel: { type: String, enum: ['info', 'warning', 'alert'], default: 'info' },
    expirationDate: { type: Date },
    type: { type: String, enum: ['event', 'club', 'global'], default: 'event' },
  },
  { timestamps: true }
);

announcementSchema.index({ eventId: 1, createdAt: 1 });
announcementSchema.index({ clubId: 1, createdAt: 1 });

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
