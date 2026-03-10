const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');
const { model } = require('../config/gemini');
const { extractTextFromPDF, chunkText, findRelevantChunks } = require('../utils/pdfExtractor');

// Helper function to get all PDF notes for a course, extract text, and get chunks
async function getCourseChunks(courseId) {
    const notes = await Note.find({ courseId, fileType: 'application/pdf' });
    if (notes.length === 0) {
        console.error(`No PDF notes found for course ${courseId}`);
        return [];
    }
    const allChunks = [];
    for (const note of notes) {
        try {
            const text = await extractTextFromPDF(note.fileUrl);
            const chunks = chunkText(text);
            chunks.forEach(chunk => allChunks.push({ text: chunk, source: note.title }));
        } catch (err) {
            console.error(`Failed to extract text from ${note.title}:`, err);
        }
    }
    return allChunks;
}

// POST /api/courses/:id/study-guide, Generate a study guide for a course based on its PDF notes
router.post('/:id/study-guide', protect, async (req, res) => {
    try {
        if (!model) {
            return res.status(500).json({ error: 'AI model not configured' });
        }
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        const chunks = await getCourseChunks(course._id);
        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No PDF notes found for this course' });
        }
        const context = chunks.slice(0, 30).map(c => c.text).join('\n---\n');
        const prompt = `You are a helpful assistant that creates study guides. You are tasked 
        with creating a study guide for the course: "${course.department} ${course.courseCode}: ${course.title}"\n\n
        Based ONLY on the following course materials and NOTHING ELSE, create a concise study guide that:
        1. Lists the key topics covered in the course
        2. Highlights important formulas, definitions, and concepts
        3. Provides a brief summary of each topic
        4. Suggests what to focus on for exam preparation
        5. Best promotes understanding of the material\n\n
        Do NOT use any outside material to create the study guide, only use the provided course materials:${context}.
        Generate the study guide now.`;
        const response = await model.generateContent(prompt);
        const answer = response.response.text();
        res.json({ studyGuide: answer, notesUsed: chunks.length });
    } catch (err) {
        console.error('Error generating study guide:', err);
        res.status(500).json({ error: 'Failed to generate study guide' });
    }
});

module.exports = router;