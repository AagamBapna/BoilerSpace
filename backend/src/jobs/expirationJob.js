const CheckIn = require('../models/CheckIn');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { emitMessageDisappeared } = require('../config/socket');
const { handleCheckout } = require('../utils/checkoutHandler');

const INTERVAL_MS = 10 * 1000; // Check every 10 seconds

async function rebuildConversationLastMessage(conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
        return;
    }

    const latestMessage = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 });

    if (!latestMessage) {
        conversation.lastMessage = {
            text: '',
            sender: undefined,
            timestamp: undefined,
        };
        await conversation.save();
        return;
    }

    conversation.lastMessage = {
        text: latestMessage.text,
        sender: latestMessage.sender,
        timestamp: latestMessage.createdAt,
    };
    await conversation.save();
}

async function processExpiredMessages() {
    const expiredMessages = await Message.find({
        isDisappearing: true,
        expiresAt: { $lte: new Date() },
    });

    for (const message of expiredMessages) {
        const conversation = await Conversation.findById(message.conversationId);
        if (!conversation) {
            await Message.deleteOne({ _id: message._id });
            continue;
        }

        await Message.deleteOne({ _id: message._id });
        await rebuildConversationLastMessage(conversation._id);
        emitMessageDisappeared({
            conversationId: conversation._id.toString(),
            messageId: message._id.toString(),
            participantIds: conversation.participants,
        });
    }
}

function startExpirationJob() {
    console.log(`[Job] Starting expiration job. Runs every ${INTERVAL_MS / 1000} seconds.`);
    
    setInterval(async () => {
        try {
            const expiredCheckins = await CheckIn.find({ expiresAt: { $lt: new Date() } });
            
            if (expiredCheckins.length > 0) {
                console.log(`[Job] Found ${expiredCheckins.length} expired check-ins.`);
                
                for (const checkin of expiredCheckins) {
                    await handleCheckout(checkin._id);
                }
            }

            await processExpiredMessages();
        } catch (error) {
            console.error('[Job] Error processing expirations:', error);
        }
    }, INTERVAL_MS);
}

module.exports = {
    startExpirationJob,
    processExpiredMessages,
};
