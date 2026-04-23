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

const TOGGLABLE_FIELDS = [
    'email', 'major', 'year', 'bio',
    'studyPreferences', 'interests', 'linkedResources', 'studyGoals',
    'courses', 'availability', 'weeklyStudyGoalMinutes',
];

// Fallback for legacy user docs.
const DEFAULT_FIELD_VISIBILITY = {
    email: 'private',
    major: 'public',
    year: 'public',
    bio: 'public',
    studyPreferences: 'public',
    interests: 'public',
    linkedResources: 'public',
    studyGoals: 'public',
    courses: 'public',
    availability: 'public',
    weeklyStudyGoalMinutes: 'public',
};

// Strip fields marked private. Mutates profile.
function redactPrivateFields(profile, fieldVisibility) {
    if (!profile) return profile;
    const fv = fieldVisibility && typeof fieldVisibility === 'object'
        ? fieldVisibility
        : {};
    for (const field of TOGGLABLE_FIELDS) {
        const setting = fv[field] || DEFAULT_FIELD_VISIBILITY[field];
        if (setting === 'private') {
            delete profile[field];
        }
    }
    return profile;
}

router.get('/me/visibility', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            profileVisibility: user.profileVisibility,
            fieldVisibility: user.fieldVisibility,
        });
    } catch (err) {
        console.error('Error fetching visibility:', err);
        res.status(500).json({ error: 'Failed to fetch visibility' });
    }
});

router.put('/me/visibility', protect, async (req, res) => {
    try {
        const { profileVisibility, fieldVisibility } = req.body;

        if (profileVisibility === undefined && fieldVisibility === undefined) {
            return res.status(400).json({
                error: 'Provide profileVisibility and/or fieldVisibility to update.',
            });
        }

        if (profileVisibility !== undefined &&
            !['public', 'private'].includes(profileVisibility)) {
            return res.status(400).json({
                error: "profileVisibility must be 'public' or 'private'.",
            });
        }

        if (fieldVisibility !== undefined) {
            if (typeof fieldVisibility !== 'object' || fieldVisibility === null ||
                Array.isArray(fieldVisibility)) {
                return res.status(400).json({
                    error: 'fieldVisibility must be an object.',
                });
            }
            for (const [key, value] of Object.entries(fieldVisibility)) {
                if (!TOGGLABLE_FIELDS.includes(key)) {
                    return res.status(400).json({
                        error: `Unknown or non-togglable field: ${key}.`,
                    });
                }
                if (!['public', 'private'].includes(value)) {
                    return res.status(400).json({
                        error: `fieldVisibility.${key} must be 'public' or 'private'.`,
                    });
                }
            }
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (profileVisibility !== undefined) {
            user.profileVisibility = profileVisibility;
        }
        if (fieldVisibility !== undefined) {
            for (const [key, value] of Object.entries(fieldVisibility)) {
                user.fieldVisibility[key] = value;
            }
        }

        await user.save();

        res.json({
            message: 'Visibility updated',
            profileVisibility: user.profileVisibility,
            fieldVisibility: user.fieldVisibility,
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(v => v.message).join(', ');
            return res.status(400).json({ error: message });
        }
        console.error('Error updating visibility:', err);
        res.status(500).json({ error: 'Failed to update visibility' });
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
        // Private profiles stay in results so they're still findable; we just
        // strip all preview data beyond identity so nothing leaks until they
        // accept a friend request.
        const users = await User.find({
            _id: { $ne: req.user._id },
            $or: [
                { displayName: regex },
                { email: regex },
            ],
        })
            .select('displayName email profilePictureUrl profileVisibility fieldVisibility')
            .limit(10);

        const sanitized = users.map((u) => {
            const isPrivate = u.profileVisibility === 'private';
            const fv = u.fieldVisibility && typeof u.fieldVisibility === 'object'
                ? u.fieldVisibility
                : {};
            const emailSetting = fv.email || DEFAULT_FIELD_VISIBILITY.email;

            const out = {
                _id: u._id,
                displayName: u.displayName,
                profilePictureUrl: u.profilePictureUrl,
                profileVisibility: u.profileVisibility,
            };
            if (!isPrivate && emailSetting !== 'private') {
                out.email = u.email;
            }
            return out;
        });

        res.json(sanitized);
    } catch (err) {
        console.error('User search error:', err.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /api/users/discovery, find classmates based on matching criteria
router.get('/discovery', protect, async (req, res) => {
    try {
        const { q, interests, studyGoals, studyStyle, environment } = req.query;

        // Base query: Public profiles only, excluding self
        const query = {
            profileVisibility: 'public',
            _id: { $ne: req.user._id }
        };

        // If q is provided, filter by displayName
        if (q && q.trim()) {
            query.displayName = new RegExp(q.trim(), 'i');
        }

        const users = await User.find(query)
            .select('displayName email major year bio profilePictureUrl studyPreferences interests studyGoals courses fieldVisibility');

        // Pre-fetch auth user courses for intersection
        const myUser = await User.findById(req.user._id).select('courses studyPreferences interests studyGoals');
        const myCourses = myUser.courses.map(c => c.toString());
        const myInterests = myUser.interests || [];
        const myGoals = myUser.studyGoals || [];
        
        // Define target constraints from query if provided, fallback to my profile preferences
        const targetStudyStyle = studyStyle || myUser.studyPreferences?.studyStyle;
        const targetEnvironment = environment || myUser.studyPreferences?.environment;
        
        // Process strings from comma separated queries
        const targetInterests = interests ? interests.split(',').map(i => i.trim().toLowerCase()) : myInterests.map(i => i.toLowerCase());
        const targetGoals = studyGoals ? studyGoals.split(',').map(g => g.trim().toLowerCase()) : myGoals.map(g => g.toLowerCase());

        // Is field public for u?
        const fieldIsPublic = (u, field) => {
            const fv = u.fieldVisibility && typeof u.fieldVisibility === 'object' ? u.fieldVisibility : {};
            const setting = fv[field] || DEFAULT_FIELD_VISIBILITY[field];
            return setting !== 'private';
        };

        const scoredUsers = users.map(u => {
            let score = 0;
            const highlights = [];

            // Style
            if (targetStudyStyle && u.studyPreferences && u.studyPreferences.studyStyle === targetStudyStyle) {
                score += 3;
                if (fieldIsPublic(u, 'studyPreferences')) {
                    highlights.push(`Study style match: ${targetStudyStyle}`);
                }
            }

            // Environment
            if (targetEnvironment && u.studyPreferences && u.studyPreferences.environment === targetEnvironment) {
                score += 3;
                if (fieldIsPublic(u, 'studyPreferences')) {
                    highlights.push(`Environment match: ${targetEnvironment}`);
                }
            }

            // Interests
            if (u.interests && u.interests.length > 0 && targetInterests.length > 0) {
                const uInterests = u.interests.map(i => i.toLowerCase());
                const overlap = uInterests.filter(i => targetInterests.includes(i));
                if (overlap.length > 0) {
                    score += overlap.length * 2;
                    if (fieldIsPublic(u, 'interests')) {
                        highlights.push(`Shared interests: ${overlap.map(i => i.substring(0, 15)).join(', ')}`);
                    }
                }
            }

            // Goals
            if (u.studyGoals && u.studyGoals.length > 0 && targetGoals.length > 0) {
                const uGoals = u.studyGoals.map(g => g.toLowerCase());
                const overlap = uGoals.filter(g => targetGoals.includes(g));
                if (overlap.length > 0) {
                    score += overlap.length * 2;
                    if (fieldIsPublic(u, 'studyGoals')) {
                        highlights.push(`Shared goals: ${overlap.map(g => g.substring(0, 15)).join(', ')}`);
                    }
                }
            }

            // Courses
            if (u.courses && u.courses.length > 0) {
                const overlap = u.courses.filter(c => myCourses.includes(c.toString()));
                if (overlap.length > 0) {
                    score += overlap.length * 1;
                    if (fieldIsPublic(u, 'courses')) {
                        highlights.push(`Shared classes: ${overlap.length}`);
                    }
                }
            }

            return {
                user: u,
                score,
                matchHighlights: highlights
            };
        });

        // Sort descending by score
        scoredUsers.sort((a, b) => b.score - a.score);

        // Redact private fields per user.
        const results = scoredUsers.slice(0, 20).map(su => {
            const obj = su.user.toObject();
            const fv = obj.fieldVisibility;
            delete obj.fieldVisibility;
            redactPrivateFields(obj, fv);
            return {
                ...obj,
                matchScore: su.score,
                matchHighlights: su.matchHighlights,
            };
        });

        res.json(results);
    } catch (err) {
        console.error('Discovery search error:', err.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /api/users/:id, get user by ID (with tiered privacy)
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('courses');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isSelf = req.user._id.toString() === user._id.toString();

        // Self-view: return full profile
        if (isSelf) {
            return res.json(user);
        }

        // Non-self: look up friendship status
        const Friendship = require('../models/Friendship');
        const friendship = await Friendship.findOne({
            $or: [
                { requester: req.user._id, recipient: user._id },
                { requester: user._id, recipient: req.user._id },
            ],
        });

        let connectionStatus = 'none';
        let friendshipId = null;
        if (friendship) {
            friendshipId = friendship._id;
            if (friendship.status === 'accepted') {
                connectionStatus = 'accepted';
            } else if (friendship.status === 'pending') {
                connectionStatus = friendship.requester.toString() === req.user._id.toString()
                    ? 'pending_outgoing'
                    : 'pending_incoming';
            }
        }

        // Private profile and not friends: return minimal info
        if (user.profileVisibility === 'private' && connectionStatus !== 'accepted') {
            return res.json({
                _id: user._id,
                displayName: user.displayName,
                profilePictureUrl: user.profilePictureUrl,
                profileVisibility: user.profileVisibility,
                connectionStatus,
                friendshipId,
            });
        }

        // Public profile. Strangers get fieldVisibility-redacted view.
        const isFriend = connectionStatus === 'accepted';
        const profile = {
            _id: user._id,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl,
            profileVisibility: user.profileVisibility,
            connectionStatus,
            friendshipId,
            major: user.major,
            year: user.year,
            bio: user.bio,
            courses: user.courses,
            availability: user.availability,
            studyPreferences: user.studyPreferences,
            interests: user.interests,
            linkedResources: user.linkedResources,
            studyGoals: user.studyGoals,
            weeklyStudyGoalMinutes: user.weeklyStudyGoalMinutes,
        };
        if (!isFriend) {
            redactPrivateFields(profile, user.fieldVisibility);
        }
        res.json(profile);
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
        if (req.body.year !== undefined) {
            const validYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
            if (!validYears.includes(req.body.year)) {
                return res.status(400).json({ 
                error: 'Year must be one of: Freshman, Sophomore, Junior, Senior, Graduate' 
            });
    }
        }
        const { displayName, major, year, bio, profileVisibility, notificationPreferences, studyPreferences, interests, linkedResources, studyGoals, weeklyStudyGoalMinutes } = req.body;

    // Build update object based on what's provided
    const updateData = {};
    if (displayName !== undefined) {
        if (!displayName.trim()) return res.status(400).json({ error: 'Display name cannot be empty' });
        updateData.displayName = displayName.trim();
    }
    if (major !== undefined) updateData.major = major.trim();
    if (year !== undefined) updateData.year = year.trim();
    if (bio !== undefined) updateData.bio = bio.trim().substring(0, 300);
    if (profileVisibility !== undefined) {
        if (!['public', 'private'].includes(profileVisibility)) return res.status(400).json({ error: 'Invalid visibility setting.' });
        updateData.profileVisibility = profileVisibility;
    }
    if (notificationPreferences !== undefined) updateData.notificationPreferences = notificationPreferences;

    // Advanced User Story 86 Profile Fields
    if (studyPreferences !== undefined) {
        if (studyPreferences.studyStyle && !['solo', 'group', 'mixed', ''].includes(studyPreferences.studyStyle)) {
            return res.status(400).json({ error: 'Invalid studyStyle.' });
        }
        if (studyPreferences.environment && !['quiet', 'moderate', 'collaborative', ''].includes(studyPreferences.environment)) {
            return res.status(400).json({ error: 'Invalid environment.' });
        }
        updateData.studyPreferences = {
            studyStyle: studyPreferences.studyStyle || '',
            environment: studyPreferences.environment || ''
        };
    }
    if (interests !== undefined && Array.isArray(interests)) {
        updateData.interests = interests.map(i => i.trim()).filter(i => i).slice(0, 10);
    }
    if (linkedResources !== undefined) {
        updateData.linkedResources = {
            github: linkedResources.github ? linkedResources.github.trim() : '',
            linkedin: linkedResources.linkedin ? linkedResources.linkedin.trim() : ''
        };
    }
    if (studyGoals !== undefined && Array.isArray(studyGoals)) {
        updateData.studyGoals = studyGoals.map(g => g.trim()).filter(g => g).slice(0, 10);
    }
    if (weeklyStudyGoalMinutes !== undefined) {
        const goal = Number(weeklyStudyGoalMinutes);
        if (!Number.isFinite(goal) || goal < 0 || goal > 10080) {
            return res.status(400).json({ error: 'Weekly study goal must be between 0 and 10080 minutes.' });
        }
        updateData.weeklyStudyGoalMinutes = Math.round(goal);
    }
        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                major: user.major,
                year: user.year,
                bio: user.bio,
                profilePictureUrl: user.profilePictureUrl,
                studyPreferences: user.studyPreferences,
                interests: user.interests,
                linkedResources: user.linkedResources,
                studyGoals: user.studyGoals,
                weeklyStudyGoalMinutes: user.weeklyStudyGoalMinutes,
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

// PUT /api/users/:id/notifications/preferences — update notification settings
router.put('/:id/notifications/preferences', protect, async (req, res) => {
    try {
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'You can only update your own notification preferences' });
        }

        const allowedFields = ['sessionReminders', 'messages', 'events', 'organizationUpdates', 'globalMute'];
        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (typeof req.body[field] !== 'boolean') {
                    return res.status(400).json({ error: `${field} must be a boolean` });
                }
                updates[`notificationSettings.${field}`] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid notification preference fields provided' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Notification preferences updated',
            notificationSettings: user.notificationSettings,
        });
    } catch (err) {
        console.error('Error updating notification preferences:', err);
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
});

// POST /api/users/:id/courses — set user's courses for the semester
router.post('/:id/courses', protect, handleCourseUpdate);

// PUT /api/users/:id/courses — update user's courses (alias)
router.put('/:id/courses', protect, handleCourseUpdate);

module.exports = router;
