const passport = require('passport');

function protect(req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    })(req, res, next);
}

module.exports = { protect };
