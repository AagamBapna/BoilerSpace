const Room = require('../models/Room');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CheckIn = require('../models/CheckIn');

/**
 * Handles checking out a user, updating room occupancy,
 * and firing off notifications if a room dips below any threshold.
 */
async function handleCheckout(checkinId) {
    const checkin = await CheckIn.findById(checkinId);
    if (!checkin) return false;

    const room = await Room.findById(checkin.roomId);
    if (!room) return false;

    // Remove the check-in document
    await checkin.deleteOne();
    
    // Safety check to prevent negative occupancy
    room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
    room.lastActivityAt = new Date();
    
    // Avoid division by zero if capacity is somehow 0
    if (room.capacity > 0) {
        // Check if occupancy crossed any user's threshold
        const oldOccupancy = (room.currentOccupancy + 1) / room.capacity;
        const newOccupancy = room.currentOccupancy / room.capacity;

        const users = await User.find({
            'notificationPreferences.roomId': room._id,
            'notificationPreferences.enabled': true,
        });

        for (const u of users) {
            const pref = u.notificationPreferences.find(
                (p) => p.roomId.toString() === room._id.toString()
            );
            if (!pref) continue;

            const thresholdDecimal = pref.threshold / 100;

            console.log(`[Checkout] Room ${room.name} | Old: ${oldOccupancy} | New: ${newOccupancy} | Threshold: ${thresholdDecimal}`);

            if (oldOccupancy >= thresholdDecimal && newOccupancy < thresholdDecimal) {
                await Notification.create({
                    userId: u._id,
                    roomId: room._id,
                    buildingId: room.buildingId,
                    message: `${room.name} is now under ${pref.threshold}% capacity (${room.currentOccupancy}/${room.capacity})`,
                });
            }
        }
    }
    
    await room.save();
    return true;
}

module.exports = { handleCheckout };
