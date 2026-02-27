import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    date: { type: String, required: true },
    time: String,
    location: String,
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  },
  { timestamps: true }
);

eventSchema.index({ clubId: 1 });
eventSchema.index({ date: 1 });

export default mongoose.model('Event', eventSchema);
