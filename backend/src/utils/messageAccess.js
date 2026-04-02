const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

async function usersExist(userIds) {
    const normalized = userIds.map((id) => id.toString());
    const unique = [...new Set(normalized)];
    const existingCount = await User.countDocuments({
        _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) },
    });
    return existingCount === unique.length;
}

async function hasBlockedRelationship(userIds) {
    const normalized = [...new Set(userIds.map((id) => id.toString()))];
    if (normalized.length !== 2) {
        return false;
    }

    const [a, b] = normalized;
    const blocked = await Friendship.findOne({
        status: 'blocked',
        $or: [
            { requester: a, recipient: b },
            { requester: b, recipient: a },
        ],
    }).select('_id');

    return Boolean(blocked);
}

module.exports = {
    usersExist,
    hasBlockedRelationship,
};
