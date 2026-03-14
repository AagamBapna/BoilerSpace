const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');

// Mock GCS bucket
jest.mock('../config/gcs', () => {
    const mockDelete = jest.fn().mockResolvedValue();
    const mockCreateWriteStream = jest.fn().mockImplementation(() => {
        const { PassThrough } = require('stream');
        const stream = new PassThrough();
        setTimeout(() => stream.emit('finish'), 10);
        return stream;
    });
    return {
        bucket: {
            name: 'boilerspace-uploads',
            file: jest.fn().mockReturnValue({
                createWriteStream: mockCreateWriteStream,
                delete: mockDelete,
                name: 'profile-pictures/test-file.jpg',
            }),
        },
        __mockDelete: mockDelete,
    };
});

const { __mockDelete } = require('../config/gcs');

let mongoServer;
let token;
let testUser;

const validUser = {
    email: 'test@purdue.edu',
    password: 'password123',
    displayName: 'Test User',
    major: 'Computer Science',
    year: 'Sophomore',
};

// Create a minimal valid JPEG buffer (smallest valid JPEG)
const createTestImageBuffer = () => {
    return Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
};

// Create a minimal valid PNG buffer
const createTestPngBuffer = () => {
    return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
        0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    __mockDelete.mockClear();

    await request(app).post('/api/auth/register').send(validUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
    token = loginRes.body.token;
    testUser = loginRes.body.user;
});

describe('PUT /api/users/:id/profile-picture', () => {
    test('uploads a valid JPEG profile picture', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .attach('profilePicture', createTestImageBuffer(), 'photo.jpg');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Profile picture updated successfully');
        expect(res.body.user.profilePictureUrl).toContain('https://storage.googleapis.com/');
    });

    test('uploads a valid PNG profile picture', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .attach('profilePicture', createTestPngBuffer(), 'photo.png');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Profile picture updated successfully');
        expect(res.body.user.profilePictureUrl).toContain('https://storage.googleapis.com/');
    });

    test('rejects non-image files (PDF)', async () => {
        const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');

        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .attach('profilePicture', pdfBuffer, {
                filename: 'document.pdf',
                contentType: 'application/pdf',
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid file type');
    });

    test('rejects request without auth (401)', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .attach('profilePicture', createTestImageBuffer(), 'photo.jpg');

        expect(res.status).toBe(401);
    });

    test('rejects updating another user\'s profile picture (403)', async () => {
        const otherUser = await User.create({
            email: 'other@purdue.edu',
            password: 'password123',
            displayName: 'Other User',
            major: 'Math',
            year: 'Junior',
        });

        const res = await request(app)
            .put(`/api/users/${otherUser._id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .attach('profilePicture', createTestImageBuffer(), 'photo.jpg');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You can only update your own profile picture');
    });

    test('rejects request with no file attached', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .send();

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('No file uploaded');
    });

    test('deletes old picture from GCS when uploading a new one', async () => {
        // Set an existing profile picture on the user
        await User.findByIdAndUpdate(testUser.id, {
            profilePictureUrl: 'https://storage.googleapis.com/boilerspace-uploads/profile-pictures/old.jpg',
            profilePictureFileName: 'profile-pictures/old.jpg',
        });

        const res = await request(app)
            .put(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`)
            .attach('profilePicture', createTestImageBuffer(), 'new-photo.jpg');

        expect(res.status).toBe(200);
        // Verify old file deletion was attempted
        expect(__mockDelete).toHaveBeenCalled();
    });
});

describe('DELETE /api/users/:id/profile-picture', () => {
    test('removes profile picture and resets to default', async () => {
        // First set a profile picture
        await User.findByIdAndUpdate(testUser.id, {
            profilePictureUrl: 'https://storage.googleapis.com/boilerspace-uploads/profile-pictures/test.jpg',
            profilePictureFileName: 'profile-pictures/test.jpg',
        });

        const res = await request(app)
            .delete(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Profile picture removed successfully');
        expect(res.body.user.profilePictureUrl).toBe('');

        // Verify GCS deletion was called
        expect(__mockDelete).toHaveBeenCalled();
    });

    test('rejects request without auth (401)', async () => {
        const res = await request(app)
            .delete(`/api/users/${testUser.id}/profile-picture`);

        expect(res.status).toBe(401);
    });

    test('rejects deleting another user\'s profile picture (403)', async () => {
        const otherUser = await User.create({
            email: 'other2@purdue.edu',
            password: 'password123',
            displayName: 'Other User 2',
            major: 'Physics',
            year: 'Senior',
        });

        const res = await request(app)
            .delete(`/api/users/${otherUser._id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });

    test('GET /:id confirms profile picture was removed', async () => {
        await User.findByIdAndUpdate(testUser.id, {
            profilePictureUrl: 'https://storage.googleapis.com/boilerspace-uploads/profile-pictures/test.jpg',
            profilePictureFileName: 'profile-pictures/test.jpg',
        });

        await request(app)
            .delete(`/api/users/${testUser.id}/profile-picture`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app).get(`/api/users/${testUser.id}`);
        expect(res.status).toBe(200);
        expect(res.body.profilePictureUrl).toBe('');
    });
});
