const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');

// Maps notification types to their corresponding notificationSettings field
const TYPE_TO_SETTING = {
    sessionReminder: 'sessionReminders',
    message: 'messages',
    event: 'events',
    organizationUpdate: 'organizationUpdates',
};

/**
 * Check whether a user's notification preferences allow a given type.
 * Returns true if the notification should be sent, false if suppressed.
 */
async function shouldNotify(userId, type) {
    const user = await User.findById(userId).select('notificationSettings');
    if (!user) return false;

    const settings = user.notificationSettings || {};

    // Global mute suppresses everything
    if (settings.globalMute) return false;

    // Check the specific category flag
    const settingKey = TYPE_TO_SETTING[type];
    if (settingKey && settings[settingKey] === false) return false;

    return true;
}

/**
 * Send a notification to a user, respecting their notification preferences.
 *
 * @param {Object} options
 * @param {string} options.userId - Recipient user ID
 * @param {string} options.type - Notification type: 'sessionReminder' | 'message' | 'event' | 'organizationUpdate'
 * @param {string} options.message - Notification message text
 * @param {string} [options.roomId] - Associated room ID (if applicable)
 * @param {string} [options.buildingId] - Associated building ID (if applicable)
 * @returns {Object|null} The created notification, or null if suppressed
 */
async function sendNotification({ userId, type, message, roomId, buildingId }) {
    const allowed = await shouldNotify(userId, type);
    if (!allowed) return null;

    // Build notification document fields
    const notificationData = { userId, message };
    if (roomId) notificationData.roomId = roomId;
    if (buildingId) notificationData.buildingId = buildingId;

    const notification = await Notification.create(notificationData);

    // Emit real-time event via Socket.io if available
    const io = getIO();
    if (io) {
        io.to(userId.toString()).emit('notification', {
            type,
            notification,
        });
    }

    return notification;
}

module.exports = { sendNotification, shouldNotify };
