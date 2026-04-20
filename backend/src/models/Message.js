const mongoose = require('mongoose');

const ALLOWED_REACTION_TYPES = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

const reactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        reactionType: {
            type: String,
            enum: ALLOWED_REACTION_TYPES,
            required: true,
        },
        reactedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
            index: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        text: {
            type: String,
            required: [true, 'Message text is required'],
            maxlength: [2000, 'Message cannot exceed 2000 characters'],
            trim: true,
        },
        readBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
        readAt: {
            type: Date,
            default: null,
        },
        reactions: {
            type: [reactionSchema],
            default: [],
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        isDisappearing: {
            type: Boolean,
            default: false,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

messageSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 300,
        partialFilterExpression: { expiresAt: { $type: 'date' } },
    }
);

messageSchema.index({ text: 'text' });

messageSchema.path('expiresAt').validate(function validateExpiresAt(value) {
    if (this.isDisappearing) {
        return value instanceof Date;
    }
    return value === null || value === undefined;
}, 'expiresAt must be set only for disappearing messages');

messageSchema.path('deletedAt').validate(function validateDeletedAt(value) {
    if (this.isDeleted) {
        return value instanceof Date;
    }
    return value === null || value === undefined;
}, 'deletedAt must be set only for deleted messages');

messageSchema.path('deletedBy').validate(function validateDeletedBy(value) {
    if (this.isDeleted) {
        return mongoose.Types.ObjectId.isValid(value);
    }
    return value === null || value === undefined;
}, 'deletedBy must be set only for deleted messages');

messageSchema.path('reactions').validate(function validateUniqueReactions(value) {
    const seen = new Set();
    for (const reaction of value || []) {
        const userId = reaction?.userId?.toString();
        if (!userId) {
            return false;
        }
        if (seen.has(userId)) {
            return false;
        }
        seen.add(userId);
    }
    return true;
}, 'Each user can only have one reaction per message');

module.exports = mongoose.model('Message', messageSchema);
