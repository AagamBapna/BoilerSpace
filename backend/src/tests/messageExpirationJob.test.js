const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

jest.mock('../config/socket', () => ({
    emitMessageDisappeared: jest.fn(),
}));

const { emitMessageDisappeared } = require('../config/socket');
const { processExpiredMessages } = require('../jobs/expirationJob');

jest.setTimeout(30000);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    emitMessageDisappeared.mockClear();
});

describe('processExpiredMessages', () => {
    test('removes expired disappearing messages and emits participant notifications', async () => {
        const userA = new mongoose.Types.ObjectId();
        const userB = new mongoose.Types.ObjectId();
        const conversation = await Conversation.create({
            participants: [userA, userB],
        });

        const expiredMessage = await Message.create({
            conversationId: conversation._id,
            sender: userA,
            text: 'expired',
            readBy: [userA],
            isDisappearing: true,
            expiresAt: new Date(Date.now() - 60_000),
        });

        await Message.create({
            conversationId: conversation._id,
            sender: userA,
            text: 'active',
            readBy: [userA],
            isDisappearing: true,
            expiresAt: new Date(Date.now() + 60_000),
        });

        await processExpiredMessages();

        const removed = await Message.findById(expiredMessage._id);
        expect(removed).toBeNull();
        expect(emitMessageDisappeared).toHaveBeenCalledTimes(1);
        expect(emitMessageDisappeared).toHaveBeenCalledWith({
            conversationId: conversation._id.toString(),
            messageId: expiredMessage._id.toString(),
            participantIds: conversation.participants,
        });
    });

    test('rebuilds conversation lastMessage after expired message removal', async () => {
        const userA = new mongoose.Types.ObjectId();
        const userB = new mongoose.Types.ObjectId();
        const conversation = await Conversation.create({
            participants: [userA, userB],
        });

        const olderMessage = await Message.create({
            conversationId: conversation._id,
            sender: userA,
            text: 'older',
            readBy: [userA],
            createdAt: new Date(Date.now() - 120_000),
            updatedAt: new Date(Date.now() - 120_000),
        });

        const newestExpiredMessage = await Message.create({
            conversationId: conversation._id,
            sender: userA,
            text: 'newest expired',
            readBy: [userA],
            isDisappearing: true,
            expiresAt: new Date(Date.now() - 60_000),
            createdAt: new Date(Date.now() - 60_000),
            updatedAt: new Date(Date.now() - 60_000),
        });

        conversation.lastMessage = {
            text: newestExpiredMessage.text,
            sender: newestExpiredMessage.sender,
            timestamp: newestExpiredMessage.createdAt,
        };
        await conversation.save();

        await processExpiredMessages();

        const updatedConversation = await Conversation.findById(conversation._id);
        expect(updatedConversation.lastMessage.text).toBe(olderMessage.text);
        expect(updatedConversation.lastMessage.sender.toString()).toBe(olderMessage.sender.toString());
    });
});
