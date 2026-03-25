require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const { initSocket } = require('./config/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
    });