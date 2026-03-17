/**
 * Time format: "HH:mm" (24-hour)
 */

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Check if string matches HH:mm 24-hour format
 */
function isValidTimeFormat(str) {
    return typeof str === 'string' && TIME_REGEX.test(str);
}

/**
 * Convert "HH:mm" to minutes since midnight comparison.
 */
function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Check startTime strictly before endTime
 */
function isStartBeforeEnd(startTime, endTime) {
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) return false;
    return timeToMinutes(startTime) < timeToMinutes(endTime);
}

/**
 * Check for overlapping time ranges on the same day.
 */
function hasOverlaps(slots) {
    const byDay = {};
    for (const slot of slots) {
        if (!byDay[slot.day]) byDay[slot.day] = [];
        byDay[slot.day].push(slot);
    }

    for (const day of Object.keys(byDay)) {
        const daySlots = byDay[day].sort(
            (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );
        for (let i = 0; i < daySlots.length - 1; i++) {
            const curr = daySlots[i];
            const next = daySlots[i + 1];
            if (timeToMinutes(curr.endTime) > timeToMinutes(next.startTime)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Validate array of availability slots
 */
function validateAvailability(slots) {
    const errors = [];

    if (!Array.isArray(slots)) {
        return { valid: false, errors: ['Availability must be an array'] };
    }

    // Empty array is valid 
    if (slots.length === 0) {
        return { valid: true, errors: [] };
    }

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const label = `Slot ${i + 1}`;

        if (!slot.day || !VALID_DAYS.includes(slot.day)) {
            errors.push(`${label}: day must be one of ${VALID_DAYS.join(', ')}`);
        }

        if (!isValidTimeFormat(slot.startTime)) {
            errors.push(`${label}: startTime must be in HH:mm 24-hour format`);
        }

        if (!isValidTimeFormat(slot.endTime)) {
            errors.push(`${label}: endTime must be in HH:mm 24-hour format`);
        }

        if (isValidTimeFormat(slot.startTime) && isValidTimeFormat(slot.endTime)) {
            if (!isStartBeforeEnd(slot.startTime, slot.endTime)) {
                errors.push(`${label}: startTime must be before endTime`);
            }
        }
    }

    if (errors.length === 0 && hasOverlaps(slots)) {
        errors.push('Time ranges must not overlap on the same day');
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    isValidTimeFormat,
    isStartBeforeEnd,
    hasOverlaps,
    validateAvailability,
    VALID_DAYS,
    timeToMinutes,
};
