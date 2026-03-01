import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

announcementSchema.index({ eventId: 1 });
announcementSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
