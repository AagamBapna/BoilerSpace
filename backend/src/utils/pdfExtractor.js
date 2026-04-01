const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Download a file from a URL and return it as a buffer
function downloadBuffer(url) {
    if (url.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '../../', url);
        return fs.promises.readFile(localPath);
    }

    const client = url.startsWith('http://') ? http : https;
    return new Promise((resolve, reject) => {
        client.get(url, (response) => {
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

// Generate embeddings for an array of text chunks using Gemini embedding model
async function generateEmbeddings(chunks, embeddingModel) {
    const embeddings = [];
    for (const chunk of chunks) {
        const response = await embeddingModel.embedContent({ content: { parts: [{ text: chunk }] } });
        embeddings.push(response.embedding.values);
    }
    return embeddings;
}

// Find consine similarity between two vectors
function cosineSimilarity(a, b) {
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

module.exports = { extractTextFromPDF, chunkText, generateEmbeddings, cosineSimilarity };