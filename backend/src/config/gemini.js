const { GoogleGenerativeAI } = require('@google/generative-ai');
let model = null;
if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
} else {
    console.warn('GEMINI_API_KEY not set — AI features disabled.');
}
module.exports = { model };