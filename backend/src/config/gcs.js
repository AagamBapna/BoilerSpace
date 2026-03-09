const path = require('path');
const fs = require('fs');
const keyPath = path.join(__dirname, '../../gcs-key.json');
let bucket;
if (fs.existsSync(keyPath)) {
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage({
        keyFilename: keyPath,
        projectId: 'boilerspace',
    });
    bucket = storage.bucket('boilerspace-uploads');
} else {
    console.warn('GCS key file not found — file uploads will not work.');
    bucket = {
        name: 'boilerspace-uploads',
        file: () => ({
            createWriteStream: () => { throw new Error('GCS not configured'); },
            delete: () => Promise.resolve(),
        }),
    };
}
module.exports = { bucket };