const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const DELETED_MESSAGE_PLACEHOLDER = 'This message was deleted';

router.post('/', protect, async (req, res) => {
    const { participantId } = req.body;

    if (!participantId) {
        return res.status(400).json({ error: 'participantId is required' });
    }

    if (participantId === req.user._id.toString()) {
        return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
    }

    try {
        const otherUser = await User.findById(participantId);
        if (!otherUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const sorted = [req.user._id.toString(), participantId].sort();

        let conversation = await Conversation.findOne({
            participants: { $all: sorted, $size: 2 },
        }).populate('participants', 'displayName email profilePictureUrl');

        if (conversation) {
            return res.json(conversation);
        }

        conversation = await Conversation.create({ participants: sorted });
        conversation = await Conversation.findById(conversation._id)
            .populate('participants', 'displayName email profilePictureUrl');

        res.status(201).json(conversation);
    } catch (err) {
        console.error('Create conversation error:', err.message);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

router.get('/', protect, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
        })
            .populate('participants', 'displayName email profilePictureUrl')
            .sort({ updatedAt: -1 });

        const withUnread = await Promise.all(
            conversations.map(async (conv) => {
                const unreadCount = await Message.countDocuments({
                    conversationId: conv._id,
                    readBy: { $ne: req.user._id },
                    sender: { $ne: req.user._id },
                });
                return { ...conv.toObject(), unreadCount };
            })
        );

        res.json(withUnread);
    } catch (err) {
        console.error('List conversations error:', err.message);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
});

router.get('/:id/messages', protect, async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;

    try {
        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!conversation.participants.some(p => p.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        const total = await Message.countDocuments({ conversationId: id });
        const messages = await Message.find({ conversationId: id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('sender', 'displayName email profilePictureUrl');

        res.json({
            messages: messages.reverse(),
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (err) {
        console.error('Get messages error:', err.message);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

router.post('/:id/messages', protect, async (req, res) => {
    const { id } = req.params;
    const { text, isDisappearing = false, disappearingDurationSeconds } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Message text is required' });
    }

    if (text.length > 2000) {
        return res.status(400).json({ error: 'Message cannot exceed 2000 characters' });
    }

    if (typeof isDisappearing !== 'boolean') {
        return res.status(400).json({ error: 'isDisappearing must be a boolean' });
    }

    if (isDisappearing) {
        if (!Number.isInteger(disappearingDurationSeconds) || disappearingDurationSeconds <= 0) {
            return res.status(400).json({ error: 'disappearingDurationSeconds must be a positive integer' });
        }
    } else if (disappearingDurationSeconds !== undefined) {
        return res.status(400).json({ error: 'disappearingDurationSeconds is only allowed for disappearing messages' });
    }

    try {
        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!conversation.participants.some(p => p.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        const message = await Message.create({
            conversationId: id,
            sender: req.user._id,
            text: text.trim(),
            readBy: [req.user._id],
            isDisappearing,
            expiresAt: isDisappearing ? new Date(Date.now() + (disappearingDurationSeconds * 1000)) : null,
        });

        conversation.lastMessage = {
            text: message.text,
            sender: req.user._id,
            timestamp: message.createdAt,
        };
        await conversation.save();

        const populated = await Message.findById(message._id)
            .populate('sender', 'displayName email profilePictureUrl');

        res.status(201).json(populated);
    } catch (err) {
        console.error('Send message error:', err.message);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

router.delete('/:conversationId/messages/:messageId', protect, async (req, res) => {
    const { conversationId, messageId } = req.params;

    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!conversation.participants.some(p => p.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        const message = await Message.findOne({
            _id: messageId,
            conversationId,
        });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the message author can delete this message' });
        }

        if (message.isDeleted) {
            return res.status(400).json({ error: 'Message is already deleted' });
        }

        message.text = DELETED_MESSAGE_PLACEHOLDER;
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = req.user._id;
        await message.save();

        if (conversation.lastMessage && conversation.lastMessage.timestamp
            && message.createdAt.getTime() === new Date(conversation.lastMessage.timestamp).getTime()) {
            conversation.lastMessage.text = DELETED_MESSAGE_PLACEHOLDER;
            conversation.lastMessage.sender = message.sender;
            conversation.lastMessage.timestamp = message.deletedAt;
            await conversation.save();
        }

        const populated = await Message.findById(message._id)
            .populate('sender', 'displayName email profilePictureUrl')
            .populate('deletedBy', 'displayName email profilePictureUrl');

        res.json(populated);
    } catch (err) {
        console.error('Delete message error:', err.message);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

router.put('/:id/read', protect, async (req, res) => {
    const { id } = req.params;

    try {
        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (!conversation.participants.some(p => p.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        await Message.updateMany(
            {
                conversationId: id,
                readBy: { $ne: req.user._id },
            },
            { $addToSet: { readBy: req.user._id } }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (err) {
        console.error('Mark read error:', err.message);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

module.exports = router;
