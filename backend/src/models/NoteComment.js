const mongoose = require('mongoose');

const MAX_COMMENT_LENGTH = 2000;

const noteCommentSchema = new mongoose.Schema(
    {
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Note',
            required: [true, 'Note ID is required'],
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },
        content: {
            type: String,
            required: [true, 'Comment content is required'],
            trim: true,
            maxlength: [MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`],
            validate: {
                validator: function (v) {
                    // Ensure content is not empty after trimming
                    return v && v.trim().length > 0;
                },
                message: 'Comment cannot be empty',
            },
        },
    },
    { timestamps: true }
);

// Index for fast retrieval of comments by note, sorted chronologically
noteCommentSchema.index({ noteId: 1, createdAt: 1 });

// Sanitize content before saving to strip HTML/script tags
noteCommentSchema.pre('save', function (next) {
    if (this.isModified('content')) {
        this.content = this.content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    next();
});

module.exports = mongoose.model('NoteComment', noteCommentSchema);
module.exports.MAX_COMMENT_LENGTH = MAX_COMMENT_LENGTH;
