const { Server } = require('socket.io');
const { verifyToken } = require('./jwt');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { usersExist, hasBlockedRelationship } = require('../utils/messageAccess');
const { shouldNotify } = require('../services/NotificationService');

let io;
const onlineUsers = new Map();

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

function emitConversationAccepted({ conversationId, initiatorId }) {
    if (!io) return;
    io.to(initiatorId.toString()).emit('conversationAccepted', { conversationId });
}

function emitMessageReactionUpdated({ conversationId, message, participantIds }) {
    if (!io) return;
    participantIds.forEach((participantId) => {
        io.to(participantId.toString()).emit('messageReactionUpdated', {
            conversationId,
            message,
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

    io.on('connection', async (socket) => {
        socket.join(socket.userId);

        onlineUsers.set(socket.userId, socket.id);

        try {
            const conversations = await Conversation.find({ participants: socket.userId });
            const relevantUserIds = new Set();
            conversations.forEach(conv => {
                conv.participants.forEach(p => {
                    const pid = p.toString();
                    if (pid !== socket.userId) relevantUserIds.add(pid);
                });
            });

            relevantUserIds.forEach(uid => {
                io.to(uid).emit('userOnline', { userId: socket.userId });
            });

            const currentlyOnline = [];
            relevantUserIds.forEach(uid => {
                if (onlineUsers.has(uid)) currentlyOnline.push(uid);
            });
            socket.emit('onlineUsers', currentlyOnline);
        } catch (err) {
            console.error('Socket presence connect error:', err.message);
        }

        socket.on('sendMessage', async (data) => {
            const {
                conversationId,
                text,
                isDisappearing = false,
                disappearingDurationSeconds,
                clientTempId,
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

                if (conversation.status === 'rejected') {
                    socket.emit('messageError', {
                        conversationId,
                        error: 'This conversation request was rejected',
                    });
                    return;
                }

                if (conversation.status === 'pending' && conversation.initiator && conversation.initiator.toString() !== socket.userId) {
                    socket.emit('messageError', {
                        conversationId,
                        error: 'Cannot send messages — accept the request first',
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

                if (conversation.status === 'accepted') {
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
                }

                socket.emit('messageSent', {
                    message: populated,
                    conversationId,
                    clientTempId,
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

        socket.on('disconnect', async () => {
            onlineUsers.delete(socket.userId);

            try {
                const conversations = await Conversation.find({ participants: socket.userId });
                const relevantUserIds = new Set();
                conversations.forEach(conv => {
                    conv.participants.forEach(p => {
                        const pid = p.toString();
                        if (pid !== socket.userId) relevantUserIds.add(pid);
                    });
                });

                relevantUserIds.forEach(uid => {
                    io.to(uid).emit('userOffline', { userId: socket.userId });
                });
            } catch (err) {
                console.error('Socket presence disconnect error:', err.message);
            }
        });
    });

    return io;
}

function getIO() {
    return io;
}

module.exports = {
    initSocket,
    getIO,
    emitMessageDeleted,
    emitMessageDisappeared,
    emitConversationAccepted,
    emitMessageReactionUpdated,
    onlineUsers,
};
