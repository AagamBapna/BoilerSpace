const express = require('express');
const router = express.Router();
const multer = require('multer');
const Note = require('../models/Note');
const NoteComment = require('../models/NoteComment');
const Course = require('../models/Course');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { bucket } = require('../config/gcs');
const { extractTextFromPDF, chunkText, generateEmbeddings } = require('../utils/pdfExtractor');
const { embeddingModel } = require('../config/gemini');
const Embedding = require('../models/Embedding');

// POST /api/courses/:id/notes — upload a note to a course
router.post('/:id/notes', protect, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        // Handle multer errors (file too large, invalid type)
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds the 16MB limit.' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            // Validate course exists
            const course = await Course.findById(req.params.id);
            if (!course) {
                return res.status(404).json({ error: 'Course not found.' });
            }

            // Validate file was provided
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded. Please attach a PDF or image file.' });
            }
            // Upload to GCS
            const blob = bucket.file(`notes/${Date.now()}-${req.file.originalname}`);
            await new Promise((resolve, reject) => {
                const stream = blob.createWriteStream({ resumable: false, contentType: req.file.mimetype });
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(req.file.buffer);
            });
            const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            const note = await Note.create({
                courseId: course._id,
                uploadedBy: req.user._id,
                title: req.body.title || req.file.originalname,
                description: req.body.description || '',
                fileUrl,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
            });

            // Populate uploader info before returning
            await note.populate('uploadedBy', 'displayName email profilePictureUrl');
            await note.populate('courseId', 'courseCode title');
            if (note.fileType === 'application/pdf' && embeddingModel) {
                (async () => {
                    try {
                        const text = await extractTextFromPDF(note.fileUrl);
                        const chunks = chunkText(text);
                        const embeddings = await generateEmbeddings(chunks, embeddingModel);
                        const docs = chunks.map((chunk, index) => ({
                            courseId: note.courseId,
                            noteId: note._id,
                            chunkIndex: index,
                            text: chunk,
                            embedding: embeddings[index],
                            source: note.title,
                        }));
                        await Embedding.insertMany(docs);
                        console.log(`Generated and stored ${docs.length} embeddings for note ${note.title}`);
                    } catch (error) {
                        console.error('Error generating embeddings:', error.message);
                    }
                })();
            }
            res.status(201).json(note);
        } catch (error) {
            if (error.name === 'CastError') {
                return res.status(404).json({ error: 'Course not found.' });
            }
            console.error('Error uploading note:', error);
            res.status(500).json({ error: 'Failed to upload note.' });
        }
    });
});

// GET /api/courses/:id/notes — retrieve all notes for a course
router.get('/:id/notes', protect, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        const notes = await Note.find({ courseId: course._id })
            .populate('uploadedBy', 'displayName email profilePictureUrl')
            .populate('courseId', 'courseCode title')
            .sort({ voteCount: -1, createdAt: -1 });

        res.json(notes);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ error: 'Course not found.' });
        }
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes.' });
    }
});

// GET /api/notes/:noteId/download — download a note's file
router.get('/:noteId/download', protect, async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        res.redirect(note.fileUrl);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ error: 'Note not found.' });
        }
        console.error('Error downloading note:', error);
        res.status(500).json({ error: 'Failed to download note.' });
    }
});

// DELETE /api/notes/:noteId — delete a note (only the uploader can delete)
router.delete('/:noteId', protect, async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        // Only the uploader can delete their own note
        if (note.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'You can only delete notes you uploaded.' });
        }

        // Delete from GCS
        const fileName = note.fileUrl.replace(`https://storage.googleapis.com/${bucket.name}/`, '');
        await bucket.file(fileName).delete().catch(() => {});

        await note.deleteOne();

        res.json({ message: 'Note deleted successfully.' });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ error: 'Note not found.' });
        }
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note.' });
    }
});

// POST /api/notes/:noteId/vote, vote on a note
router.post('/:noteId/vote', protect, async (req, res) => {
    try {
        const { vote } = req.body;
        if (vote !== 'up' && vote !== 'down') {
            return res.status(400).json({ error: 'Invalid vote type. Must be "up" or "down".' });
        }
        const note = await Note.findById(req.params.noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }
        const existingVoteIndex = note.votes.findIndex(v => v.user.toString() === req.user._id.toString());
        if (existingVoteIndex !== -1) {
            if (note.votes[existingVoteIndex].vote === vote) {
                return res.status(400).json({ error: `You have already ${vote}voted this note.` });
            }
            note.votes[existingVoteIndex].vote = vote;
            if (vote === 'up') {
                note.voteCount += 2;
            } else {
                note.voteCount -= 2;
            }
        } else {
            note.votes.push({ user: req.user._id, vote: vote });
            if (vote === 'up') {
                note.voteCount += 1;
            } else {
                note.voteCount -= 1;
            }
        }
        await note.save();
        res.json({ message: 'Vote recorded.', voteCount: note.voteCount, userVote: vote });
    } catch (error) {
        console.error('Error placing vote:', error);
        res.status(500).json({ error: 'Failed to place vote.' });
    }
});

// DELETE /api/notes/:noteId/vote, remove vote from a note
router.delete('/:noteId/vote', protect, async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }
        const existingVoteIndex = note.votes.findIndex(v => v.user.toString() === req.user._id.toString());
        if (existingVoteIndex === -1) {
            return res.status(400).json({ error: 'You have not voted this note.' });
        }
        const existingVote = note.votes[existingVoteIndex].vote;
        note.votes.splice(existingVoteIndex, 1);
        if (existingVote === 'up') {
            note.voteCount -= 1;
        } else {
            note.voteCount += 1;
        }
        await note.save();
        res.json({ message: 'Vote removed.', voteCount: note.voteCount, userVote: null });
    } catch (error) {
        console.error('Error removing vote:', error);
        res.status(500).json({ error: 'Failed to remove vote.' });
    }
});

// POST /api/notes/:noteId/comments — add a comment to a note
router.post('/:noteId/comments', protect, async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (!note) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required.' });
        }

        if (content.length > 2000) {
            return res.status(400).json({ error: 'Comment cannot exceed 2000 characters.' });
        }

        const comment = await NoteComment.create({
            noteId: note._id,
            userId: req.user._id,
            content: content.trim(),
        });

        await comment.populate('userId', 'displayName email profilePictureUrl');

        res.status(201).json(comment);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ error: 'Note not found.' });
        }
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment.' });
    }
});

module.exports = router;
