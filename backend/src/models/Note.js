import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    numVotes: { type: Number, default: 0 },
    votes: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      voteType: { type: String, enum: ['upvote', 'downvote'], required: true },
    }],
  },
  { timestamps: true }
);

export default mongoose.model('Note', noteSchema);