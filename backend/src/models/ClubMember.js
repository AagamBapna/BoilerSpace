const mongoose = require('mongoose');

const CLUB_ROLES = ['member', 'officer', 'admin'];

const clubMemberSchema = new mongoose.Schema(
  {
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: CLUB_ROLES,
      default: 'member',
    },
    position: {
      type: String,
      default: 'Member',
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

clubMemberSchema.index({ clubId: 1, userId: 1 }, { unique: true });

const ClubMember = mongoose.models.ClubMember || mongoose.model('ClubMember', clubMemberSchema);

module.exports = ClubMember;
module.exports.CLUB_ROLES = CLUB_ROLES;
