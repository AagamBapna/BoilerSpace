import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/boilerspace';
  await mongoose.connect(uri);
}

export default mongoose;
