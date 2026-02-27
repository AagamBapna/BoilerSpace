/**
 * Simple auth: reads authenticated user id from X-User-Id header.
 * Replace with real auth (JWT, sessions) when available.
 */
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to perform this action.',
    });
  }
  req.userId = userId;
  next();
}

function optionalAuth(req, res, next) {
  req.userId = req.headers['x-user-id'] || null;
  next();
}

module.exports = { requireAuth, optionalAuth };
