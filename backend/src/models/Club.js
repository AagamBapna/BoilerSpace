const mongoose = require('mongoose');

/**
 * Club profile model (User Story 71: Club Profile Creation & Management).
 *
 * Stores organization info so students can discover and view clubs.
 * Authentication is handled elsewhere; this schema only stores the organizer
 * identifier for ownership checks on update.
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
    organizerId: { type: String, required: true },
  },
  { timestamps: true }
);

// index for filtering clubs by organizer and by category.
clubSchema.index({ organizerId: 1 });
clubSchema.index({ category: 1 });

module.exports = mongoose.model('Club', clubSchema);
