const pdfParse = require('pdf-parse');
const https = require('https');

// Download a file from a URL and return it as a buffer
function downloadBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

// Extract text from a PDF given its URL
async function extractTextFromPDF(url) {
    const buffer = await downloadBuffer(url);
    const data = await pdfParse(buffer);
    return data.text;
}

// Split text into chunks of a specified maximum length with overlap
function chunkText(text, maxLength = 1000, overlap = 200) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength - overlap) {
        const chunk = text.slice(i, i + maxLength);
        chunks.push(chunk);
    }
    return chunks;
}

// Find the most relevant chunks of text based on a query
function findRelevantChunks(chunks, query, topK = 5) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredChunks = chunks.map((chunk, i) => {
        const lower = chunk.toLowerCase();
        const score = queryWords.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
        return { chunk, score, index: i };
    });
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK).map(c => c.chunk);
}
module.exports = { extractTextFromPDF, chunkText, findRelevantChunks };