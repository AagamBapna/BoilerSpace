const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Embedding = require('../models/Embedding');
const StudyGuide = require('../models/StudyGuide');
const { protect } = require('../middleware/auth');
const { model, embeddingModel } = require('../config/gemini');
const { cosineSimilarity } = require('../utils/pdfExtractor');

// get top relevant chunks for a course based using cosine similarity to determine relevance
async function getRelevantChunks(courseId, query, topK = 30) {
    const stored = await Embedding.find({ courseId });
    if (stored.length === 0) {
        console.error(`No PDF notes found for course ${courseId}`);
        return [];
    }
    const queryResult = await embeddingModel.embedContent(query);
    const queryVector = queryResult.embedding.values;
    const scored = stored.map(doc => ({
        text: doc.text,
        source: doc.source,
        score: cosineSimilarity(queryVector, doc.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

// POST /api/courses/:id/study-guide, Generate a study guide for a course based on its PDF notes
router.post('/:id/study-guide', protect, async (req, res) => {
    try {
        if (!model || !embeddingModel) {
            return res.status(500).json({ error: 'AI model not configured' });
        }
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        const query = 'key topics, important concepts, formulas, and exam preparation tips for this course';
        const chunks = await getRelevantChunks(course._id, query);
        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No PDF notes found for this course' });
        }
        const context = chunks.map(c => c.text).join('\n---\n');
        const prompt = `You are a helpful assistant that creates study guides. You are tasked 
        with creating a study guide for the course: "${course.department} ${course.courseCode}: ${course.title}"\n\n
        Based ONLY on the following course materials and NOTHING ELSE, create a comprehensive study guide.
        FORMAT REQUIREMENTS ARE AS FOLLOWS:
        1. Start with a "## Key Topics" section listing the most important concepts as bold bullet points
        2. For each key topic, provide a detailed subsection with:
            - Important **definitions** (bolded)
            - Key **formulas** (bolded)
            - Brief summary
        3. End with a "## Exam Focus Areas" section highlighting what to prioritize
        4. Best promotes understanding of the material\n\n
        Use markdown formatting and make important terms **bold**. Do NOT use any outside material to create the study guide, only use the provided course materials:${context}.
        In your response, don't mention that you are an AI or that the study guide was generated. Just provide the study guide content as if you were a student who had read all the notes.
        Title it with the course name and end with a motivational message for students preparing for exams.
        Generate the study guide now.`;
        const response = await model.generateContent(prompt);
        const answer = response.response.text();
        const savedGuide = await StudyGuide.create({
            courseId: course._id,
            userId: req.user._id,
            content: answer,
            notesUsed: chunks.length,
        });
        res.json({ studyGuide: answer, notesUsed: chunks.length, id: savedGuide._id });
    } catch (err) {
        console.error('Error generating study guide:', err);
        res.status(500).json({ error: 'Failed to generate study guide' });
    }
});

// GET /api/courses/:id/study-guides, retrieve all study guides for a course
router.get('/:id/study-guides', protect, async (req, res) => {
    try {
        const guides = await StudyGuide.find({ courseId: req.params.id })
            .sort({ createdAt: -1 })
            .limit(3)
            .select('content notesUsed createdAt');
        res.json(guides);
    } catch (err) {
        console.error('Error fetching study guides:', err);
        res.status(500).json({ error: 'Failed to fetch study guides' });
    }
});

module.exports = router;