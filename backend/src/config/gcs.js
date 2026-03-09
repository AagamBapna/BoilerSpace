const { Storage } = require('@google-cloud/storage');
const path = require('path');
const storage = new Storage({
    keyFilename: path.join(__dirname, '../../gcs-key.json'),
    projectId: 'boilerspace',
});
const bucket = storage.bucket('boilerspace-uploads');
module.exports = { bucket };