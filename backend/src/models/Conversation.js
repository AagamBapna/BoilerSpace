const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }],
        lastMessage: {
            text: { type: String, default: '' },
            sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date },
        },
    },
    { timestamps: true }
);

conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
