const mongoose = require('mongoose');

const { RECURRENCE_TYPES } = require('../utils/recurrence');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    date: { type: String, required: true },
    time: String,
    location: String,
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    recurrence: {
      type: {
        type: String,
        enum: RECURRENCE_TYPES,
        default: 'none',
      },
      interval: {
        type: Number,
        default: 1,
        min: 1,
      },
      endDate: {
        type: String,
        default: null,
      },
      recurrenceGroupId: {
        type: String,
        default: null,
        index: true,
      },
    },
  },
  { timestamps: true }
);

eventSchema.index({ clubId: 1 });
eventSchema.index({ date: 1 });

eventSchema.pre('validate', function validateRecurrence(next) {
  const recurrence = this.recurrence || {};
  if (!recurrence.type || recurrence.type === 'none') {
    if (recurrence.endDate || recurrence.recurrenceGroupId) {
      return next(new Error('Recurring events must include endDate and recurrenceGroupId'));
    }
    return next();
  }

  if (!recurrence.endDate || !recurrence.recurrenceGroupId) {
    return next(new Error('Recurring events must include endDate and recurrenceGroupId'));
  }

  return next();
});

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
