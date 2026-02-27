import mongoose from 'mongoose';

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    contactInfo: String,
    category: String,
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

clubSchema.index({ organizerId: 1 });
clubSchema.index({ category: 1 });

export default mongoose.model('Club', clubSchema);
