const mongoose = require('mongoose');

function normalizeAllowedPositions(positions) {
  const list = Array.isArray(positions) ? positions : [];
  const unique = [];

  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (!unique.some((item) => item.toLowerCase() === value.toLowerCase())) {
      unique.push(value);
    }
  }

  if (!unique.some((item) => item.toLowerCase() === 'member')) {
    unique.unshift('Member');
  }

  return unique;
}

/**
 * Club profile model
 */
const clubSchema = new mongoose.Schema(
  {
    // name of club
    name: { type: String, required: true, trim: true },
    // short description of club and activities
    description: { type: String, default: '', trim: true },
    // club contact info
    contactInfo: { type: String, default: '', trim: true },
    // cateogry of club
    category: { type: String, default: '', trim: true },
    // unqiue id for club organizer
    // support multiple organizers
    organizerIds: { type: [String], required: true, default: [] },
    // user ids waiting for organizer approval
    pendingMemberIds: { type: [String], default: [] },
    // assignable custom positions for this club
    allowedPositions: {
      type: [String],
      default: ['Member'],
      set: normalizeAllowedPositions,
    },
  },
  { timestamps: true }
);

// index for filtering clubs by organizer and by category.
clubSchema.index({ organizerIds: 1 });
clubSchema.index({ category: 1 });

module.exports = mongoose.models.Club || mongoose.model('Club', clubSchema);
