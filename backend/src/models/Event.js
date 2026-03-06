const mongoose = require('mongoose');

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

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
