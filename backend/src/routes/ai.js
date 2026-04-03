const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const Course = require('../models/Course');
const Embedding = require('../models/Embedding');
const StudyGuide = require('../models/StudyGuide');
const { protect } = require('../middleware/auth');
const { model, embeddingModel } = require('../config/gemini');
const { extractTextFromPDF, chunkText, cosineSimilarity } = require('../utils/pdfExtractor');

function calculateCosineSimilarity(a, b) {
    if (typeof cosineSimilarity === 'function') {
        return cosineSimilarity(a, b);
    }

    let dot = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }
    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }
    return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

async function getRelevantChunks(courseId, query, topK = 30) {
    const stored = await Embedding.find({ courseId });
    if (stored.length === 0 || !embeddingModel) {
        return [];
    }

    const queryResult = await embeddingModel.embedContent(query);
    const queryVector = queryResult.embedding.values;
    const scored = stored.map((doc) => ({
        text: doc.text,
        source: doc.source,
        score: calculateCosineSimilarity(queryVector, doc.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

function normalizeDifficulty(value) {
    const difficulty = (value || 'mixed').toString().toLowerCase();
    if (['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) {
        return difficulty;
    }
    return 'mixed';
}

function parseModelJson(text) {
    const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions;
    }
    return [];
}

function sanitizeQuestionItem(item, index) {
    const question = typeof item?.question === 'string' ? item.question.trim() : '';
    const answer = typeof item?.answer === 'string' ? item.answer.trim() : '';
    if (!question || !answer) {
        return null;
    }

    const conciseAnswer = answer.length > 650 ? `${answer.slice(0, 647).trim()}...` : answer;

    return {
        id: item.id || `q${index + 1}`,
        question,
        answer: conciseAnswer,
    };
}

function buildPracticePrompt({ course, count, focus, difficulty, context }) {
    return `You are creating practice questions for students.
Use ONLY the provided course note excerpts.

Return valid JSON only with this shape:
{
  "questions": [
    { "id": "q1", "question": "...", "answer": "..." }
  ]
}

Rules:
- Generate exactly ${count} questions.
- Questions must test understanding of ${course.department} ${course.courseCode}: ${course.title}.
- Difficulty target: ${difficulty}.
- Focus area: ${focus || 'general course coverage'}.
- Do not include long worked derivations.
- Each answer must include the correct final answer and a brief explanation (2-4 sentences).
- If context is missing for a topic, say that briefly in the answer.
- Do not include markdown, code fences, or extra keys.

Course context excerpts:
${context}`;
}

function buildQaPrompt({ course, question, context }) {
    return `You are an AI assistant helping a student study ${course.department} ${course.courseCode}: ${course.title}.
Use ONLY the course note excerpts below.

Student question:
${question}

Answer rules:
- Answer using only the provided notes.
- If the notes do not contain enough information, say that clearly.
- Keep the response concise, readable, and directly helpful.
- Do not mention that you are an AI.
- Do not invent facts or use outside knowledge.

Course note excerpts:
${context}`;
}

async function getCourseChunks(courseId) {
    const notes = await Note.find({ courseId, fileType: 'application/pdf' });
    const allChunks = [];
    for (const note of notes) {
        try {
            const text = await extractTextFromPDF(note.fileUrl);
            const chunks = chunkText(text);
            chunks.forEach((chunk) => allChunks.push({ text: chunk, source: note.title }));
        } catch (err) {
            if (err?.code === 'ENOENT') {
                console.warn(`Skipping missing local file for note ${note.title}`);
            } else {
                console.error(`Failed to extract text from ${note.title}:`, err.message || err);
            }
        }
    }

    if (allChunks.length > 0) {
        return allChunks;
    }

    const embeddedChunks = await Embedding.find({ courseId }).select('text source').lean();
    if (embeddedChunks.length > 0) {
        return embeddedChunks.map((chunk) => ({
            text: chunk.text,
            source: chunk.source || 'embedded-note',
        }));
    }

    if (notes.length === 0) {
        console.error(`No PDF notes found for course ${courseId}`);
    } else {
        console.error(`No readable PDF content found for course ${courseId}`);
    }
    return allChunks;
}

function getRelevantTextChunks(chunks, query, limit = 30) {
    const normalizedQuery = query.toLowerCase();
    const scored = chunks.map((chunk) => {
        const text = String(chunk).toLowerCase();
        let score = 0;
        for (const term of normalizedQuery.split(/\s+/).filter(Boolean)) {
            if (text.includes(term)) {
                score += 1;
            }
        }
        return { text: chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((item) => item.text);
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

        const context = chunks.map((c) => c.text).join('\n---\n');
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

// POST /api/courses/:id/practice-questions, Generate practice questions without full solutions
router.post('/:id/practice-questions', protect, async (req, res) => {
    try {
        if (!model) {
            return res.status(500).json({ error: 'AI model not configured' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const count = Number(req.body?.count) || 5;
        if (count < 1 || count > 10) {
            return res.status(400).json({ error: 'count must be between 1 and 10' });
        }

        const difficulty = normalizeDifficulty(req.body?.difficulty);
        const focus = (req.body?.focus || '').toString().trim();

        const chunks = await getCourseChunks(course._id);
        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No PDF notes found for this course' });
        }

        const contextChunks = focus
            ? getRelevantTextChunks(chunks.map((c) => c.text), focus, 30)
            : chunks.slice(0, 30).map((c) => c.text);
        const context = contextChunks.join('\n---\n');

        const prompt = buildPracticePrompt({
            course,
            count,
            focus,
            difficulty,
            context,
        });

        const response = await model.generateContent(prompt);
        const rawText = response.response.text();
        const parsedQuestions = parseModelJson(rawText);
        const questions = parsedQuestions
            .map(sanitizeQuestionItem)
            .filter(Boolean)
            .slice(0, count);

        if (questions.length === 0) {
            return res.status(502).json({ error: 'AI returned an invalid practice question format' });
        }

        return res.json({ questions, notesUsed: chunks.length });
    } catch (err) {
        console.error('Error generating practice questions:', err);
        return res.status(500).json({ error: 'Failed to generate practice questions' });
    }
});

// POST /api/courses/:id/qa, answer a student question using course note excerpts
router.post('/:id/qa', protect, async (req, res) => {
    try {
        if (!model) {
            return res.status(500).json({ error: 'AI model not configured' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const question = String(req.body?.question || '').trim();
        if (!question) {
            return res.status(400).json({ error: 'question is required' });
        }

        const chunks = await getCourseChunks(course._id);
        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No PDF notes found for this course' });
        }

        const relevantChunks = getRelevantTextChunks(chunks.map((c) => c.text), question, 30);
        const context = relevantChunks.join('\n---\n');
        const prompt = buildQaPrompt({ course, question, context });

        const response = await model.generateContent(prompt);
        const answer = String(response?.response?.text?.() || '').trim();

        if (!answer) {
            return res.status(502).json({ error: 'AI returned an empty answer' });
        }

        return res.json({ answer, notesUsed: chunks.length });
    } catch (err) {
        console.error('Error generating course Q&A:', err);
        return res.status(500).json({ error: 'Failed to answer question' });
    }
});

module.exports = router;