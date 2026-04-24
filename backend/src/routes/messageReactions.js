const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { emitMessageReactionUpdated } = require('../config/socket');

const ALLOWED_REACTION_TYPES = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

router.post('/:id/reactions', protect, async (req, res) => {
    const { id } = req.params;
    const { reactionType } = req.body;

    if (!reactionType || !ALLOWED_REACTION_TYPES.includes(reactionType)) {
        return res.status(400).json({ error: 'Invalid reaction type' });
    }

    try {
        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const conversation = await Conversation.findById(message.conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        const existingReactionIdx = message.reactions.findIndex(
            (reaction) => reaction.userId.toString() === req.user._id.toString()
        );

        let action = 'added';

        if (existingReactionIdx === -1) {
            message.reactions.push({
                userId: req.user._id,
                reactionType,
                reactedAt: new Date(),
            });
        } else if (message.reactions[existingReactionIdx].reactionType === reactionType) {
            message.reactions.splice(existingReactionIdx, 1);
            action = 'removed';
        } else {
            message.reactions[existingReactionIdx].reactionType = reactionType;
            message.reactions[existingReactionIdx].reactedAt = new Date();
            action = 'updated';
        }

        await message.save();

        const populated = await Message.findById(message._id)
            .populate('sender', 'displayName email profilePictureUrl');

        emitMessageReactionUpdated({
            conversationId: conversation._id.toString(),
            message: populated.toObject(),
            participantIds: conversation.participants,
        });

        return res.json({ action, message: populated });
    } catch (err) {
        console.error('React to message error:', err.message);
        return res.status(500).json({ error: 'Failed to react to message' });
    }
});

module.exports = router;
