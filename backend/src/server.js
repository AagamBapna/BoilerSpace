require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const startExpirationJob = require('./jobs/expirationJob');
const CheckIn = require('./models/CheckIn');
const { initSocket } = require('./config/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        
        // Drop the old TTL index so MongoDB doesn't silently delete our documents
        CheckIn.collection.dropIndex('expiresAt_1').catch((err) => {
             // Ignore if index doesn't exist
        });
        
        startExpirationJob();

        server.listen(PORT, () => {
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
    });