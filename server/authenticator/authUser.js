const { users } = require('../data');

function authUser(request, response, next) {
    const userId = request.headers['x-user-id'];
    if (!userId) {
        return response.status(401).json({error: 'Unauthorized. Please log in.'});
    }
    const user = users.find((u) => u._id === userId);
    if (!user) {
        return response.status(401).json({error: 'Unauthorized. Invalid user.'});
    }
    request.user = user;
    next();
}
module.exports = { authUser };