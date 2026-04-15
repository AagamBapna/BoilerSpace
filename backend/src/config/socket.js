const { Server } = require('socket.io');
const { verifyToken } = require('./jwt');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { usersExist, hasBlockedRelationship } = require('../utils/messageAccess');
const { shouldNotify } = require('../services/NotificationService');

let io;

function emitMessageDeleted({ conversationId, message, participantIds }) {
    if (!io) return;
    participantIds.forEach((participantId) => {
        io.to(participantId.toString()).emit('messageDeleted', {
            conversationId,
            message,
        });
    });
}

function emitMessageDisappeared({ conversationId, messageId, participantIds }) {
    if (!io) return;
    participantIds.forEach((participantId) => {
        io.to(participantId.toString()).emit('messageDisappeared', {
            conversationId,
            messageId: messageId.toString(),
        });
    });
}

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
            const {
                conversationId,
                text,
                isDisappearing = false,
                disappearingDurationSeconds,
            } = data;

            if (!conversationId || !text || !text.trim()) return;
            if (text.length > 2000) return;
            if (typeof isDisappearing !== 'boolean') return;
            if (isDisappearing) {
                if (!Number.isInteger(disappearingDurationSeconds) || disappearingDurationSeconds <= 0) return;
            } else if (disappearingDurationSeconds !== undefined) {
                return;
            }

            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;

                if (!conversation.participants.some(p => p.toString() === socket.userId)) return;

                const participantIds = conversation.participants.map((p) => p.toString());
                const allParticipantsExist = await usersExist(participantIds);
                if (!allParticipantsExist) {
                    socket.emit('messageError', {
                        conversationId,
                        error: 'Cannot send message because a participant no longer exists',
                    });
                    return;
                }

                const blocked = await hasBlockedRelationship(participantIds);
                if (blocked) {
                    socket.emit('messageError', {
                        conversationId,
                        error: 'Messaging is not allowed because one user has blocked the other',
                    });
                    return;
                }

                const message = await Message.create({
                    conversationId,
                    sender: socket.userId,
                    text: text.trim(),
                    readBy: [socket.userId],
                    isDisappearing,
                    expiresAt: isDisappearing ? new Date(Date.now() + (disappearingDurationSeconds * 1000)) : null,
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

                for (const participantId of otherParticipants) {
                    const allowed = await shouldNotify(participantId.toString(), 'message');
                    if (allowed) {
                        io.to(participantId.toString()).emit('newMessage', {
                            message: populated,
                            conversationId,
                        });
                    }
                }

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

                const now = new Date();

                await Message.updateMany(
                    {
                        conversationId,
                        sender: { $ne: socket.userId },
                        readBy: { $ne: socket.userId },
                        readAt: null,
                    },
                    {
                        $addToSet: { readBy: socket.userId },
                        $set: { readAt: now },
                    }
                );

                await Message.updateMany(
                    {
                        conversationId,
                        sender: { $ne: socket.userId },
                        readBy: { $ne: socket.userId },
                        readAt: { $ne: null },
                    },
                    {
                        $addToSet: { readBy: socket.userId },
                    }
                );

                const otherParticipants = conversation.participants
                    .filter(p => p.toString() !== socket.userId);

                otherParticipants.forEach(participantId => {
                    io.to(participantId.toString()).emit('messagesRead', {
                        conversationId,
                        readBy: socket.userId,
                        readAt: now,
                    });
                });
            } catch (err) {
                console.error('Socket markRead error:', err.message);
            }
        });

        socket.on('typing', async (data) => {
            const { conversationId } = data;
            if (!conversationId) return;

            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;
                if (!conversation.participants.some(p => p.toString() === socket.userId)) return;

                const otherParticipants = conversation.participants
                    .filter(p => p.toString() !== socket.userId);

                otherParticipants.forEach(participantId => {
                    io.to(participantId.toString()).emit('userTyping', {
                        conversationId,
                        userId: socket.userId,
                    });
                });
            } catch (err) {
                console.error('Socket typing error:', err.message);
            }
        });

        socket.on('stopTyping', async (data) => {
            const { conversationId } = data;
            if (!conversationId) return;

            try {
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;
                if (!conversation.participants.some(p => p.toString() === socket.userId)) return;

                const otherParticipants = conversation.participants
                    .filter(p => p.toString() !== socket.userId);

                otherParticipants.forEach(participantId => {
                    io.to(participantId.toString()).emit('userStopTyping', {
                        conversationId,
                        userId: socket.userId,
                    });
                });
            } catch (err) {
                console.error('Socket stopTyping error:', err.message);
            }
        });

        socket.on('disconnect', () => {});
    });

    return io;
}

function getIO() {
    return io;
}

module.exports = { initSocket, getIO, emitMessageDeleted, emitMessageDisappeared };
