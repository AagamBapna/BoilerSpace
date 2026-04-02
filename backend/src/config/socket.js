const { Server } = require('socket.io');
const { verifyToken } = require('./jwt');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

let io;

function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.id);
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.userId = user._id.toString();
            socket.userEmail = user.email;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        socket.join(socket.userId);

        socket.on('sendMessage', async (data) => {
            const { conversationId, text } = data;

            if (!conversationId || !text || !text.trim()) return;
            if (text.length > 2000) return;

            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;

                if (!conversation.participants.some(p => p.toString() === socket.userId)) return;

                const message = await Message.create({
                    conversationId,
                    sender: socket.userId,
                    text: text.trim(),
                    readBy: [socket.userId],
                });

                conversation.lastMessage = {
                    text: message.text,
                    sender: socket.userId,
                    timestamp: message.createdAt,
                };
                await conversation.save();

                const populated = await Message.findById(message._id)
                    .populate('sender', 'displayName email profilePictureUrl');

                const otherParticipants = conversation.participants
                    .filter(p => p.toString() !== socket.userId);

                otherParticipants.forEach(participantId => {
                    io.to(participantId.toString()).emit('newMessage', {
                        message: populated,
                        conversationId,
                    });
                });

                socket.emit('messageSent', {
                    message: populated,
                    conversationId,
                });
            } catch (err) {
                console.error('Socket sendMessage error:', err.message);
            }
        });

        socket.on('markRead', async (data) => {
            const { conversationId } = data;
            if (!conversationId) return;

            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;
                if (!conversation.participants.some(p => p.toString() === socket.userId)) return;

                await Message.updateMany(
                    {
                        conversationId,
                        readBy: { $ne: socket.userId },
                    },
                    { $addToSet: { readBy: socket.userId } }
                );

                const otherParticipants = conversation.participants
                    .filter(p => p.toString() !== socket.userId);

                otherParticipants.forEach(participantId => {
                    io.to(participantId.toString()).emit('messagesRead', {
                        conversationId,
                        readBy: socket.userId,
                    });
                });
            } catch (err) {
                console.error('Socket markRead error:', err.message);
            }
        });

        socket.on('disconnect', () => {});
    });

    return io;
}

function getIO() {
    return io;
}

module.exports = { initSocket, getIO };
