import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    name: String,
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
