const { users } = require('../data');

function authUser(req, resp, next) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return resp.status(401).json({error: 'Unauthorized. Please log in.'});
    }
    const user = users.find((u) => u._id === userId);
    if (!user) {
        return resp.status(401).json({error: 'Unauthorized. Invalid user.'});
    }
    req.user = user;
    next();
}
module.exports = { authUser };