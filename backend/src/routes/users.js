const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');
const profileUpload = require('../middleware/profileUpload');
const { bucket } = require('../config/gcs');
const { validateAvailability } = require('../utils/timeValidation');

// GET /api/users/me/availability — get cur user's study availability
router.get('/me/availability', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json(user.availability || []);
    } catch (err) {
        console.error('Error fetching availability:', err);
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// PUT /api/users/me/availability — update cur user's study availability
router.put('/me/availability', protect, async (req, res) => {
    try {
        const { availability } = req.body;

        const { valid, errors } = validateAvailability(availability);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid availability', details: errors });
        }

        const user = await User.findById(req.user._id);
        user.availability = availability;
        await user.save();

        res.json({ message: 'Availability updated', availability: user.availability });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(val => val.message).join(', ');
            return res.status(400).json({ error: message });
        }
        console.error('Error updating availability:', err);
        res.status(500).json({ error: 'Failed to update availability' });
    }
});

router.get('/recentBuildings', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('recentBuildings.buildingId')
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.recentBuildings);
    } catch (err) {
         if (err.name === 'CastError') {
            return res.status(404).json({ error: 'User not found' });
        }
        console.error('Error fetching user recentBuildings:', err);
        res.status(500).json({ error: 'Failed to fetch user recentBuildings' });
    }
});

router.get('/search', protect, async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    try {
        const regex = new RegExp(q.trim(), 'i');
        const users = await User.find({
            _id: { $ne: req.user._id },
            $or: [
                { displayName: regex },
                { email: regex },
            ],
        })
            .select('displayName email profilePictureUrl')
            .limit(10);

        res.json(users);
    } catch (err) {
        console.error('User search error:', err.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /api/users/:id, get user by ID (with privacy guard)
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('courses');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // If user is private and viewer is not their friend, return limited info
        if (user.profileVisibility === 'private' && req.user._id.toString() !== user._id.toString()) {
            const Friendship = require('../models/Friendship');
            const friendship = await Friendship.findOne({
                $or: [
                    { requester: req.user._id, recipient: user._id, status: 'accepted' },
                    { requester: user._id, recipient: req.user._id, status: 'accepted' },
                ],
            });

            if (!friendship) {
                return res.json({
                    _id: user._id,
                    displayName: user.displayName,
                    profilePictureUrl: user.profilePictureUrl,
                    profileVisibility: user.profileVisibility,
                });
            }
        }

        res.json(user);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'User not found' });
        }
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// PUT /api/users/:id, update user profile
router.put('/:id', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'You can only update your own profile' });
        }
        const { displayName, major, year } = req.body;
        if (displayName !== undefined && (!displayName || displayName.trim().length === 0)) {
            return res.status(400).json({ error: 'Display name cannot be empty' });
        }
        if (year !== undefined) {
            const validYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
            if (!validYears.includes(year)) {
                return res.status(400).json({ 
                error: 'Year must be one of: Freshman, Sophomore, Junior, Senior, Graduate' 
            });
    }
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (displayName !== undefined) {
            user.displayName = displayName.trim();
        }
        if (major !== undefined) {
            user.major = major.trim();
        }
        if (year !== undefined) {
            user.year = year;
        }
        await user.save();
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                major: user.major,
                year: user.year,
                profilePictureUrl: user.profilePictureUrl,
            }
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(val => val.message).join(', ');
            return res.status(400).json({ error: message });
        }
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// GET /api/users/:id/courses, get user's enrolled courses
router.get('/:id/courses', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('courses');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.courses);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'User not found' });
        }
        console.error('Error fetching user courses:', err);
        res.status(500).json({ error: 'Failed to fetch user courses' });
    }
});

async function handleCourseUpdate(req, res) {
    try {
        const { courseIds } = req.body;
        if (!courseIds || !Array.isArray(courseIds)) {
            return res.status(400).json({
                error: 'courseIds must be an array of course IDs'
            });
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'You can only update your own courses' });
        }
        const uniqueCourseIds = [...new Set(courseIds)];
        const foundCourses = await Course.find({ _id: { $in: uniqueCourseIds } });
        if (foundCourses.length !== uniqueCourseIds.length) {
            const foundIds = foundCourses.map(c => c._id.toString());
            const invalidIds = uniqueCourseIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                error: 'Invalid course IDs provided',
                invalidIds
            });
        }
        user.courses = uniqueCourseIds;
        await user.save();
        const updatedUser = await User.findById(req.params.id).populate('courses');

        res.json({
            message: 'Courses updated successfully',
            courses: updatedUser.courses
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({
                error: 'Invalid course IDs provided',
                invalidIds: [req.body.courseIds?.find(id => !id.match(/^[0-9a-fA-F]{24}$/))]
            });
        }
        console.error('Error updating courses:', err);
        res.status(500).json({ error: 'Failed to update courses' });
    }
}

// PUT /api/users/:id/profile-picture — upload or replace profile picture
router.put('/:id/profile-picture', protect, (req, res) => {
    profileUpload.single('profilePicture')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds the 5MB limit.' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            if (req.user._id.toString() !== req.params.id) {
                return res.status(403).json({ error: 'You can only update your own profile picture' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded. Please attach a PNG or JPEG image.' });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Delete old profile picture from GCS if one exists
            if (user.profilePictureFileName) {
                await bucket.file(user.profilePictureFileName).delete().catch(() => {});
            }

            // Upload new picture to GCS
            const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const gcsFileName = `profile-pictures/${user._id}-${Date.now()}-${sanitizedName}`;
            const blob = bucket.file(gcsFileName);
            await new Promise((resolve, reject) => {
                const stream = blob.createWriteStream({ resumable: false, contentType: req.file.mimetype });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(req.file.buffer);
            });

            const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            user.profilePictureUrl = fileUrl;
            user.profilePictureFileName = gcsFileName;
            await user.save();

            res.json({
                message: 'Profile picture updated successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    displayName: user.displayName,
                    major: user.major,
                    year: user.year,
                    profilePictureUrl: user.profilePictureUrl,
                },
            });
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            res.status(500).json({ error: 'Failed to upload profile picture.' });
        }
    });
});

// DELETE /api/users/:id/profile-picture — remove profile picture
router.delete('/:id/profile-picture', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'You can only update your own profile picture' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.profilePictureFileName) {
            await bucket.file(user.profilePictureFileName).delete().catch(() => {});
        }

        user.profilePictureUrl = '';
        user.profilePictureFileName = '';
        await user.save();

        res.json({
            message: 'Profile picture removed successfully',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                major: user.major,
                year: user.year,
                profilePictureUrl: user.profilePictureUrl,
            },
        });
    } catch (error) {
        console.error('Error removing profile picture:', error);
        res.status(500).json({ error: 'Failed to remove profile picture.' });
    }
});

// POST /api/users/:id/courses — set user's courses for the semester
router.post('/:id/courses', protect, handleCourseUpdate);

// PUT /api/users/:id/courses — update user's courses (alias)
router.put('/:id/courses', protect, handleCourseUpdate);

module.exports = router;
