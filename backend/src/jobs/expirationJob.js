const CheckIn = require('../models/CheckIn');
const { handleCheckout } = require('../utils/checkoutHandler');

const INTERVAL_MS = 10 * 1000; // Check every 10 seconds

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
        } catch (error) {
            console.error('[Job] Error processing expirations:', error);
        }
    }, INTERVAL_MS);
}

module.exports = startExpirationJob;
